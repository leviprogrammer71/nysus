import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import {
  createPrediction,
  fetchReplicateOutputAsBlob,
  getPrediction,
} from "@/lib/replicate";
import { fluxInputSchema, FLUX_MODEL, FLUX_DRAFT_MODEL } from "@/lib/flux";
import {
  generateOpenAIImage,
  hasOpenAIImageKey,
  OPENAI_IMAGE_MODEL,
} from "@/lib/openai-images";
import { shotPromptSchema } from "@/lib/shot-prompt";
import {
  checkSpendCap,
  ESTIMATE_CENTS_PER_GENERATION,
  recordUsage,
} from "@/lib/budget";
import { awardEvent } from "@/lib/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  project_id: z.string().uuid(),
  clip_id: z.string().uuid().optional(),
  shot: shotPromptSchema.optional(),
  image_prompt: z.string().min(1).max(4000).optional(),
  aspect_ratio: z
    .enum(["9:16", "16:9", "1:1", "4:3", "3:4", "21:9"])
    .optional(),
});

/**
 * POST /api/stills/generate
 *
 * Provider routing:
 *   OPENAI_API_KEY set → OpenAI gpt-image-1 (DALL-E lineage) — preferred.
 *   Otherwise → Replicate Flux fallback.
 *
 * Either way the output is uploaded to Storage at
 * {project}/stills/{clip}/image.png and the clip row is updated with
 * still_image_url + seed_image_url so animate can pick it up.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid payload" },
      { status: 400 },
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, draft_mode")
    .eq("id", body.project_id)
    .maybeSingle();
  if (projectError || !project) {
    return NextResponse.json(
      { error: projectError?.message ?? "Project not found" },
      { status: 404 },
    );
  }
  const draft = Boolean(project.draft_mode);

  const admin = createServiceRoleClient();
  const gate = await checkSpendCap({
    admin,
    userId: user.id,
    email: user.email,
    estimateCents: ESTIMATE_CENTS_PER_GENERATION,
  });
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason, code: gate.code },
      { status: 429 },
    );
  }

  // --- Resolve clip row (create if needed) ----------------------------
  let clipId: string;
  let imagePrompt: string;
  let aspectRatio: z.infer<typeof fluxInputSchema>["aspect_ratio"];

  if (body.clip_id) {
    const { data: existing, error: readErr } = await supabase
      .from("clips")
      .select("id, still_prompt, prompt, shot_metadata")
      .eq("id", body.clip_id)
      .maybeSingle();
    if (readErr || !existing) {
      return NextResponse.json(
        { error: readErr?.message ?? "Clip not found" },
        { status: 404 },
      );
    }
    clipId = existing.id;
    imagePrompt =
      body.image_prompt ?? existing.still_prompt ?? existing.prompt;
    aspectRatio = body.aspect_ratio ?? "9:16";
  } else {
    const shot = body.shot;
    if (!shot) {
      return NextResponse.json(
        { error: "Provide either clip_id or shot." },
        { status: 400 },
      );
    }
    const { data: lastClip } = await supabase
      .from("clips")
      .select("order_index")
      .eq("project_id", project.id)
      .order("order_index", { ascending: false })
      .limit(1)
      .maybeSingle();
    const orderIndex = (lastClip?.order_index ?? -1) + 1;

    imagePrompt = body.image_prompt ?? shot.image_prompt ?? shot.prompt;
    aspectRatio = body.aspect_ratio ?? "9:16";

    const { data: inserted, error: insertErr } = await supabase
      .from("clips")
      .insert({
        project_id: project.id,
        order_index: orderIndex,
        prompt: shot.prompt,
        still_prompt: shot.image_prompt || null,
        narration: shot.narration || null,
        shot_metadata: {
          shot_type: shot.shot_type,
          shot_number: shot.shot_number,
          duration: shot.duration,
          continuity_notes: shot.continuity_notes,
          voice_direction: shot.voice_direction,
          suggested_seed_behavior: shot.suggested_seed_behavior,
          image_prompt: shot.image_prompt,
          narration: shot.narration,
          animation_model: shot.animation_model,
        },
        status: "queued",
        still_status: "queued",
      })
      .select("id")
      .single();

    if (insertErr || !inserted) {
      return NextResponse.json(
        { error: insertErr?.message ?? "Failed to create clip" },
        { status: 500 },
      );
    }
    clipId = inserted.id;
  }

  await admin
    .from("clips")
    .update({ still_status: "processing", still_prompt: imagePrompt })
    .eq("id", clipId);

  // --- Generate via OpenAI or Flux ------------------------------------
  const useOpenAI = hasOpenAIImageKey();
  const provider: "openai" | "flux" = useOpenAI ? "openai" : "flux";
  const modelSlug = useOpenAI
    ? OPENAI_IMAGE_MODEL
    : draft
    ? FLUX_DRAFT_MODEL
    : FLUX_MODEL;

  try {
    let imageBlob: Blob;
    let imageContentType: string;
    let predictionId: string | null = null;

    if (useOpenAI) {
      const img = await generateOpenAIImage({
        prompt: imagePrompt,
        aspect_ratio: aspectRatio,
        draft,
      });
      imageBlob = img.blob;
      imageContentType = img.contentType;
    } else {
      const inputValidated = fluxInputSchema.parse({
        prompt: imagePrompt,
        aspect_ratio: aspectRatio,
        ...(draft ? { output_quality: 80 } : {}),
      });
      const prediction = await createPrediction({
        model: modelSlug,
        input: inputValidated,
      });
      predictionId = prediction.id;
      await admin
        .from("clips")
        .update({ still_replicate_prediction_id: prediction.id })
        .eq("id", clipId);

      const deadline = Date.now() + 45_000;
      let final = prediction;
      while (
        (final.status === "starting" || final.status === "processing") &&
        Date.now() < deadline
      ) {
        await new Promise((r) => setTimeout(r, 1500));
        final = await getPrediction(prediction.id);
      }
      if (final.status !== "succeeded") {
        throw new Error(String(final.error ?? `Flux ${final.status}`));
      }
      const output = final.output;
      const outputUrl =
        typeof output === "string"
          ? output
          : Array.isArray(output) && typeof output[0] === "string"
          ? (output[0] as string)
          : null;
      if (!outputUrl) throw new Error("Flux returned no image URL");
      const fetched = await fetchReplicateOutputAsBlob(outputUrl);
      imageBlob = fetched.blob;
      imageContentType = fetched.contentType;
    }

    // --- Mirror to Storage ----------------------------------------------
    const ext = imageContentType.includes("jpeg") ? "jpg" : "png";
    const storagePath = `${project.id}/stills/${clipId}/image.${ext}`;

    const { error: uploadErr } = await admin.storage
      .from("clips")
      .upload(storagePath, imageBlob, {
        contentType: imageContentType,
        upsert: true,
      });
    if (uploadErr) {
      await admin
        .from("clips")
        .update({
          still_status: "failed",
          error_message: `Upload failed: ${uploadErr.message}`,
        })
        .eq("id", clipId);
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }

    const { data: signed } = await admin.storage
      .from("clips")
      .createSignedUrl(storagePath, 60 * 60 * 6);
    const finalUrl = signed?.signedUrl ?? null;

    await admin
      .from("clips")
      .update({
        still_status: "complete",
        still_image_url: finalUrl,
        seed_image_url: finalUrl,
        seed_source: "auto",
        error_message: null,
      })
      .eq("id", clipId);

    void recordUsage({
      admin,
      userId: user.id,
      projectId: project.id,
      provider: provider === "openai" ? "openai" : "replicate",
      action: "generate",
      metadata: {
        clip_id: clipId,
        prediction_id: predictionId,
        model: modelSlug,
        kind: "still",
        image_provider: provider,
        draft,
      },
    });

    // XP + achievement hook — best-effort.
    void awardEvent({
      admin,
      userId: user.id,
      kind: "still_generated",
      meta: { project_id: project.id },
    });

    return NextResponse.json({
      ok: true,
      clip_id: clipId,
      still_image_url: finalUrl,
      prediction_id: predictionId,
      provider,
      model: modelSlug,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin
      .from("clips")
      .update({ still_status: "failed", error_message: msg })
      .eq("id", clipId);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
