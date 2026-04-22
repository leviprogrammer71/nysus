import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { mirrorPredictionToClip } from "@/lib/clips";
import { sendPushToUser } from "@/lib/push";
import type { Prediction } from "@/lib/replicate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Replicate webhook. Authenticated via a shared secret in the query
 * string — we control the URL we hand Replicate so the secret doesn't
 * leave our system. If this app graduates beyond single-user, swap to
 * Replicate-Webhook-Signature HMAC (see their docs § Webhook signing).
 */
export async function POST(request: NextRequest) {
  const url = new URL(request.url);
  const secret = url.searchParams.get("secret");
  const clipId = url.searchParams.get("clip_id");

  if (!secret || secret !== env.CRON_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!clipId) {
    return NextResponse.json({ error: "Missing clip_id" }, { status: 400 });
  }

  let payload: Prediction;
  try {
    payload = (await request.json()) as Prediction;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const admin = createServiceRoleClient();

  const { data: clip } = await admin
    .from("clips")
    .select("id, project_id, replicate_prediction_id")
    .eq("id", clipId)
    .single();

  if (!clip) {
    // Prediction for a deleted clip — 200 so Replicate doesn't keep retrying.
    return NextResponse.json({ ok: true, note: "clip gone" });
  }

  // If Replicate's payload is for a different prediction than we expect
  // (unlikely, but an attacker with the secret could try), refuse.
  if (
    clip.replicate_prediction_id &&
    payload.id &&
    clip.replicate_prediction_id !== payload.id
  ) {
    return NextResponse.json({ error: "Prediction mismatch" }, { status: 409 });
  }

  try {
    const result = await mirrorPredictionToClip({
      admin,
      clipId: clip.id,
      projectId: clip.project_id,
      prediction: payload,
    });

    // Fire a push if the clip just finished. We look up the project
    // owner to route the notification. Best-effort — don't block the
    // webhook response on it.
    if (result.kind === "complete" || result.kind === "failed") {
      const { data: proj } = await admin
        .from("projects")
        .select("user_id, title")
        .eq("id", clip.project_id)
        .maybeSingle();
      if (proj?.user_id) {
        void sendPushToUser({
          admin,
          userId: proj.user_id,
          title: result.kind === "complete" ? "Clip ready" : "Clip failed",
          body:
            result.kind === "complete"
              ? `A scene in "${proj.title}" just finished rendering.`
              : `A scene in "${proj.title}" failed: ${result.error.slice(0, 120)}`,
          url: `/projects/${clip.project_id}`,
          tag: `clip-${clip.id}`,
        });
      }
    }

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin
      .from("clips")
      .update({ status: "failed", error_message: msg })
      .eq("id", clip.id);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
