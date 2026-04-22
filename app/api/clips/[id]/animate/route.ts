import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { createPrediction } from "@/lib/replicate";
import { buildSeedanceInput, SEEDANCE_MODEL } from "@/lib/seedance";
import { buildKlingInput, KLING_MODEL } from "@/lib/kling";
import { shotPromptSchema } from "@/lib/shot-prompt";
import { gateGeneration, recordUsage } from "@/lib/budget";
import type { AestheticBible } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/clips/[id]/animate
 *
 * Routes to Seedance or Kling based on shot_metadata.animation_model
 * (and a hard guardrail: realistic projects are always Seedance).
 * Uses the clip's own still as the seed so each scene animates from
 * its generated frame (OpenAI gpt-image-1 or Flux).
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { data: clip, error: readErr } = await supabase
    .from("clips")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  if (!clip) {
    return NextResponse.json({ error: "Clip not found" }, { status: 404 });
  }

  if (
    (clip.status === "queued" || clip.status === "processing") &&
    clip.replicate_prediction_id
  ) {
    return NextResponse.json({
      ok: true,
      already_in_flight: true,
      clip_id: clip.id,
      prediction_id: clip.replicate_prediction_id,
      status: clip.status,
    });
  }

  const admin = createServiceRoleClient();
  const gate = await gateGeneration({
    admin,
    userId: user.id,
    email: user.email,
  });
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason, code: gate.code },
      { status: 429 },
    );
  }

  const shotMeta = clip.shot_metadata ?? {
    shot_type: "shot_prompt" as const,
    shot_number: clip.order_index + 1,
    duration: 15,
    continuity_notes: "",
    voice_direction: "",
    suggested_seed_behavior: "auto" as const,
  };
  const shot = shotPromptSchema.parse({ ...shotMeta, prompt: clip.prompt });

  // --- Model routing -------------------------------------------------
  // Hard rule: realistic projects ALWAYS use Seedance 2.0. Kling only
  // fires for stylized / 3D aesthetics.
  const { data: project } = await admin
    .from("projects")
    .select("aesthetic_bible")
    .eq("id", clip.project_id)
    .single();
  const bible = (project?.aesthetic_bible ?? {}) as AestheticBible;
  const styleText = [bible.visual_style ?? "", bible.palette ?? ""]
    .join(" ")
    .toLowerCase();
  const looksRealistic =
    /realis|photoreal|cinematic\s+35mm|documentar|naturalism/i.test(styleText);

  const requested = shot.animation_model ?? "seedance";
  const model: "seedance" | "kling" = looksRealistic ? "seedance" : requested;

  const seedUrl = clip.still_image_url ?? clip.seed_image_url;

  const webhookUrl =
    `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/replicate/webhook` +
    `?clip_id=${clip.id}&secret=${encodeURIComponent(env.CRON_SECRET)}`;

  try {
    let prediction;
    let modelSlug: string;
    if (model === "kling") {
      modelSlug = KLING_MODEL;
      const input = buildKlingInput({ shot, seedImageUrl: seedUrl });
      prediction = await createPrediction({
        model: modelSlug,
        input,
        webhook: webhookUrl,
        webhook_events_filter: ["completed"],
      });
    } else {
      modelSlug = SEEDANCE_MODEL;
      const input = buildSeedanceInput({ shot, seedImageUrl: seedUrl });
      prediction = await createPrediction({
        model: modelSlug,
        input,
        webhook: webhookUrl,
        webhook_events_filter: ["completed"],
      });
    }

    const { data: updated } = await admin
      .from("clips")
      .update({
        status: prediction.status === "starting" ? "queued" : "processing",
        replicate_prediction_id: prediction.id,
        video_url: null,
        last_frame_url: null,
        sampled_frames_urls: [],
        error_message: null,
        seed_image_url: seedUrl ?? clip.seed_image_url,
        seed_source: seedUrl ? "auto" : clip.seed_source,
      })
      .eq("id", clip.id)
      .select("*")
      .single();

    void recordUsage({
      admin,
      userId: user.id,
      projectId: clip.project_id,
      provider: "replicate",
      action: "generate",
      metadata: {
        clip_id: clip.id,
        prediction_id: prediction.id,
        model: modelSlug,
        animation_model: model,
        animated_from_still: Boolean(clip.still_image_url),
        forced_realistic: looksRealistic && requested !== "seedance",
      },
    });

    return NextResponse.json({
      ok: true,
      clip: updated,
      prediction_id: prediction.id,
      status: prediction.status,
      model,
      model_slug: modelSlug,
      forced_realistic: looksRealistic && requested !== "seedance",
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin
      .from("clips")
      .update({ status: "failed", error_message: msg })
      .eq("id", clip.id);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
