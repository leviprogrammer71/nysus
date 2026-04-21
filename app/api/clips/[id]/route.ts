import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import { refreshClipFromReplicate } from "@/lib/clips";
import { cancelPrediction } from "@/lib/replicate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { data: clip } = await supabase
    .from("clips")
    .select("id, project_id, status, replicate_prediction_id")
    .eq("id", id)
    .maybeSingle();
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cancel in-flight Replicate prediction so we don't burn credits on
  // a clip we're about to throw away.
  if (
    clip.replicate_prediction_id &&
    (clip.status === "queued" || clip.status === "processing")
  ) {
    try {
      await cancelPrediction(clip.replicate_prediction_id);
    } catch {
      // best-effort cancel; proceed with delete
    }
  }

  // Remove stored media from the bucket (best-effort).
  const admin = createServiceRoleClient();
  try {
    const prefix = `${clip.project_id}/${clip.id}/`;
    const { data: files } = await admin.storage.from("clips").list(prefix);
    if (files && files.length > 0) {
      await admin.storage
        .from("clips")
        .remove(files.map((f) => `${prefix}${f.name}`));
    }
  } catch {
    // keep going — row delete is the important part
  }

  const { error } = await supabase.from("clips").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/**
 * Client-side poll endpoint. Returns the current clip row (RLS-gated
 * via the authenticated user) and, if the clip is still pending,
 * proactively refreshes its status from Replicate. This makes dev
 * without a webhook tunnel "just work" — every poll may push the
 * clip one step forward.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  // Fetch via the RLS'd client first to enforce ownership.
  const { data: clip, error } = await supabase
    .from("clips")
    .select(
      "id, project_id, order_index, prompt, status, seed_image_url, seed_source, video_url, last_frame_url, sampled_frames_urls, replicate_prediction_id, error_message, created_at, shot_metadata",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If pending, proactively refresh from Replicate using the service
  // role (so even if the webhook hasn't fired, the client's next poll
  // picks up the final state).
  if (
    (clip.status === "queued" || clip.status === "processing") &&
    clip.replicate_prediction_id
  ) {
    try {
      const admin = createServiceRoleClient();
      await refreshClipFromReplicate({ admin, clipId: clip.id });
      const { data: refreshed } = await supabase
        .from("clips")
        .select(
          "id, project_id, order_index, prompt, status, seed_image_url, seed_source, video_url, last_frame_url, sampled_frames_urls, replicate_prediction_id, error_message, created_at, shot_metadata",
        )
        .eq("id", id)
        .single();
      if (refreshed) return NextResponse.json(refreshed);
    } catch {
      // Swallow — return the stale clip and let the next poll retry.
    }
  }

  return NextResponse.json(clip);
}
