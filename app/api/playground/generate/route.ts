import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import {
  checkSpendCap,
  ESTIMATE_CENTS_PER_GENERATION,
  recordUsage,
} from "@/lib/budget";
import {
  IMAGE_MODELS,
  ANIMATION_MODELS,
  type ImageModelId,
  type AnimationModelId,
} from "@/lib/models";
import {
  createPrediction,
  fetchReplicateOutputAsBlob,
  type Prediction,
} from "@/lib/replicate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// gpt-image-2 lands in 25-130s; cap above that with headroom for the
// occasional cold start. Animations begin async — we kick off the
// prediction and return its id without waiting.
export const maxDuration = 300;

/**
 * POST /api/playground/generate — the threshold.
 *
 * A project-less generation surface. The user picks any image or
 * animation model from the registry and runs it. Outputs land in
 * the `generations` table with project_id = null so they show up in
 * /playground's history strip without ever touching a project.
 *
 *   kind=image     → synchronous, mirrored to playground/{user}/{id}.{ext}
 *   kind=animation → kicks off prediction, returns id; user polls /history.
 */

const bodySchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("image"),
    model_id: z.string().min(1),
    prompt: z.string().min(1).max(4000),
    aspect_ratio: z.string().optional(),
    quality: z.enum(["auto", "low", "medium", "high"]).optional(),
    source_image_url: z.string().url().optional(),
  }),
  z.object({
    kind: z.literal("animation"),
    model_id: z.string().min(1),
    prompt: z.string().min(1).max(4000),
    duration: z.number().int().min(3).max(15).optional(),
    aspect_ratio: z.string().optional(),
    /** Required by every animation model — the start frame. */
    source_image_url: z.string().url(),
  }),
]);

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

  if (body.kind === "image") {
    return runImage(body, { admin, userId: user.id });
  }
  return runAnimation(body, { admin, userId: user.id });
}

// ---------------------------------------------------------------------
// Image — synchronous when fast.
// ---------------------------------------------------------------------

async function runImage(
  body: Extract<z.infer<typeof bodySchema>, { kind: "image" }>,
  ctx: { admin: ReturnType<typeof createServiceRoleClient>; userId: string },
): Promise<Response> {
  const def = IMAGE_MODELS[body.model_id as ImageModelId];
  if (!def) {
    return NextResponse.json(
      { error: `Unknown image model: ${body.model_id}` },
      { status: 400 },
    );
  }

  const aspect = pickAspectRatio(def.aspect_ratios, body.aspect_ratio);

  const input: Record<string, unknown> = {
    prompt: body.prompt,
    output_format: "jpeg",
  };
  if (aspect) input.aspect_ratio = aspect;
  if (def.quality && body.quality) input.quality = body.quality;
  if (def.accepts_input_image && body.source_image_url) {
    const field = def.input_image_field ?? "input_images";
    if (field === "input_images") {
      input[field] = [body.source_image_url];
    } else {
      input[field] = body.source_image_url;
    }
  }

  // Pre-insert a generations row in queued state so the history strip
  // shows the in-flight call immediately. We patch it on completion.
  const { data: row, error: insertErr } = await ctx.admin
    .from("generations")
    .insert({
      user_id: ctx.userId,
      project_id: null,
      kind: "image",
      model_id: def.id,
      prompt: body.prompt,
      input_params: input,
      status: "processing",
    })
    .select("id")
    .single();
  if (insertErr || !row) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to log generation" },
      { status: 500 },
    );
  }

  try {
    const prediction = await createPrediction<typeof input>({
      model: def.replicate_slug,
      input,
      preferWaitSeconds: 60,
    });

    const final = prediction.status === "succeeded"
      ? prediction
      : await waitForPrediction(prediction.id, 180_000);

    if (final.status !== "succeeded") {
      throw new Error(final.error ?? `prediction ended ${final.status}`);
    }

    const outputUrl = pickOutputUrl(final.output);
    if (!outputUrl) {
      throw new Error("Model returned no output URL.");
    }

    // Mirror to storage so the URL outlives Replicate's CDN expiry.
    const fetched = await fetchReplicateOutputAsBlob(outputUrl);
    const ext = fetched.contentType.includes("png") ? "png" : "jpg";
    const path = `playground/${ctx.userId}/${row.id}.${ext}`;
    const { error: upErr } = await ctx.admin.storage
      .from("clips")
      .upload(path, fetched.blob, {
        contentType: fetched.contentType,
        upsert: true,
      });
    if (upErr) throw new Error(`Storage upload: ${upErr.message}`);
    const { data: signed } = await ctx.admin.storage
      .from("clips")
      .createSignedUrl(path, 60 * 60 * 6);
    const finalUrl = signed?.signedUrl ?? outputUrl;

    await ctx.admin
      .from("generations")
      .update({
        status: "succeeded",
        output_url: finalUrl,
        replicate_prediction_id: prediction.id,
        completed_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    void recordUsage({
      admin: ctx.admin,
      userId: ctx.userId,
      projectId: null,
      provider: "replicate",
      action: "generate",
      metadata: {
        kind: "playground_image",
        model: def.id,
      },
    });

    return NextResponse.json({
      ok: true,
      generation_id: row.id,
      output_url: finalUrl,
      model: def.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.admin
      .from("generations")
      .update({
        status: "failed",
        error: msg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

// ---------------------------------------------------------------------
// Animation — kick off async; the user polls history.
// ---------------------------------------------------------------------

async function runAnimation(
  body: Extract<z.infer<typeof bodySchema>, { kind: "animation" }>,
  ctx: { admin: ReturnType<typeof createServiceRoleClient>; userId: string },
): Promise<Response> {
  const def = ANIMATION_MODELS[body.model_id as AnimationModelId];
  if (!def) {
    return NextResponse.json(
      { error: `Unknown animation model: ${body.model_id}` },
      { status: 400 },
    );
  }

  const aspect = pickAspectRatio(def.aspect_ratios, body.aspect_ratio);
  const duration = body.duration ?? def.durations[0];

  const input: Record<string, unknown> = {
    prompt: body.prompt,
    [def.start_image_field]: body.source_image_url,
    duration,
  };
  if (aspect) input.aspect_ratio = aspect;

  const { data: row, error: insertErr } = await ctx.admin
    .from("generations")
    .insert({
      user_id: ctx.userId,
      project_id: null,
      kind: "animation",
      model_id: def.id,
      prompt: body.prompt,
      input_params: input,
      status: "queued",
    })
    .select("id")
    .single();
  if (insertErr || !row) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Failed to log generation" },
      { status: 500 },
    );
  }

  try {
    const prediction = await createPrediction<typeof input>({
      model: def.replicate_slug,
      input,
    });
    await ctx.admin
      .from("generations")
      .update({
        status: "processing",
        replicate_prediction_id: prediction.id,
      })
      .eq("id", row.id);

    void recordUsage({
      admin: ctx.admin,
      userId: ctx.userId,
      projectId: null,
      provider: "replicate",
      action: "generate",
      metadata: {
        kind: "playground_animation",
        model: def.id,
      },
    });

    return NextResponse.json({
      ok: true,
      generation_id: row.id,
      prediction_id: prediction.id,
      model: def.id,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await ctx.admin
      .from("generations")
      .update({
        status: "failed",
        error: msg,
        completed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

// ---------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------

function pickAspectRatio(
  allowed: string[],
  requested: string | undefined,
): string | null {
  if (requested && allowed.includes(requested)) return requested;
  return allowed[0] ?? null;
}

function pickOutputUrl(output: unknown): string | null {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const first = output.find((o) => typeof o === "string");
    return typeof first === "string" ? first : null;
  }
  if (output && typeof output === "object") {
    const candidate = (output as Record<string, unknown>).url;
    if (typeof candidate === "string") return candidate;
  }
  return null;
}

async function waitForPrediction(
  id: string,
  deadlineMs: number,
): Promise<Prediction> {
  const started = Date.now();
  let delay = 750;
  while (Date.now() - started < deadlineMs) {
    const cur = await fetch(`https://api.replicate.com/v1/predictions/${id}`, {
      headers: {
        Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN ?? ""}`,
      },
      cache: "no-store",
    });
    if (cur.ok) {
      const json = (await cur.json()) as Prediction;
      if (
        json.status === "succeeded" ||
        json.status === "failed" ||
        json.status === "canceled"
      ) {
        return json;
      }
    }
    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 1.4, 4_000);
  }
  throw new Error("playground prediction timed out");
}
