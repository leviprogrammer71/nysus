import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import { env } from "@/lib/env";
import { cancelPrediction, createPrediction } from "@/lib/replicate";
import { buildSeedanceInput, SEEDANCE_MODEL } from "@/lib/seedance";
import { shotPromptSchema } from "@/lib/shot-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Regenerate an existing clip in place. Reuses the same prompt + seed
 * unless the caller overrides them.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { data: clip, error } = await supabase
    .from("clips")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cancel a lingering in-flight prediction before starting a new one.
  if (
    clip.replicate_prediction_id &&
    (clip.status === "queued" || clip.status === "processing")
  ) {
    try {
      await cancelPrediction(clip.replicate_prediction_id);
    } catch {
      /* ignore */
    }
  }

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

  const webhookUrl =
    `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/replicate/webhook` +
    `?clip_id=${clip.id}&secret=${encodeURIComponent(env.CRON_SECRET)}`;

  const input = buildSeedanceInput({
    shot,
    seedImageUrl: clip.seed_image_url,
  });

  try {
    const prediction = await createPrediction({
      model: SEEDANCE_MODEL,
      input,
      webhook: webhookUrl,
      webhook_events_filter: ["completed"],
    });

    const admin = createServiceRoleClient();
    const { data: updated } = await admin
      .from("clips")
      .update({
        status: prediction.status === "starting" ? "queued" : "processing",
        replicate_prediction_id: prediction.id,
        video_url: null,
        last_frame_url: null,
        sampled_frames_urls: [],
        error_message: null,
      })
      .eq("id", clip.id)
      .select("*")
      .single();

    return NextResponse.json({ clip: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("clips")
      .update({ status: "failed", error_message: msg })
      .eq("id", clip.id);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
