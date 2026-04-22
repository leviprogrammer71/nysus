import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import { env } from "@/lib/env";
import { createPrediction } from "@/lib/replicate";
import { buildSeedanceInput, SEEDANCE_MODEL } from "@/lib/seedance";
import { shotPromptSchema } from "@/lib/shot-prompt";
import { gateGeneration, recordUsage } from "@/lib/budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/clips/[id]/animate
 *
 * Kicks off Seedance for an existing clip — the typical path after
 * /api/stills/generate has produced the seed image for the scene.
 * Uses the clip's own still_image_url (auto-set as seed_image_url
 * by the stills endpoint) so every scene animates from its own
 * generated still. One clip row per scene, always.
 *
 * If the clip has already been animated and is in flight, this is a
 * no-op that returns the existing state. If it's failed or complete,
 * it clears and starts a fresh prediction.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
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

  // If the video is already in flight, don't double-dispatch.
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
  const gate = await gateGeneration(admin);
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason, code: gate.code },
      { status: 429 },
    );
  }

  // Build the shot packet we need for Seedance from what's stored on
  // the clip. shot_metadata was persisted at creation time; we rehydrate
  // the strict schema so Seedance gets proper defaults.
  const shotMeta = clip.shot_metadata ?? {
    shot_type: "shot_prompt" as const,
    shot_number: clip.order_index + 1,
    duration: 15,
    continuity_notes: "",
    voice_direction: "",
    suggested_seed_behavior: "auto" as const,
  };

  const shot = shotPromptSchema.parse({
    ...shotMeta,
    prompt: clip.prompt,
  });

  // Always prefer the clip's own still — that's what makes each scene
  // self-contained and consistent with its generated image.
  const seedUrl = clip.still_image_url ?? clip.seed_image_url;

  const input = buildSeedanceInput({
    shot,
    seedImageUrl: seedUrl,
  });

  const webhookUrl =
    `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/replicate/webhook` +
    `?clip_id=${clip.id}&secret=${encodeURIComponent(env.CRON_SECRET)}`;

  try {
    const prediction = await createPrediction({
      model: SEEDANCE_MODEL,
      input,
      webhook: webhookUrl,
      webhook_events_filter: ["completed"],
    });

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
        model: SEEDANCE_MODEL,
        animated_from_still: Boolean(clip.still_image_url),
      },
    });

    return NextResponse.json({
      ok: true,
      clip: updated,
      prediction_id: prediction.id,
      status: prediction.status,
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
