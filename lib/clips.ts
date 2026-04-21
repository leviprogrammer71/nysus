import type { SupabaseClient } from "@supabase/supabase-js";
import {
  fetchReplicateOutputAsBlob,
  getPrediction,
  type Prediction,
} from "@/lib/replicate";
import type { Database } from "@/lib/supabase/types";

type SB = SupabaseClient<Database>;

/**
 * Mirror a finished Replicate prediction into our Supabase Storage
 * bucket and update the clip row to `complete` (or `failed`).
 *
 * Idempotent — re-running for an already-complete clip is a no-op.
 * Used by both the webhook handler and the cron fallback.
 */
export async function mirrorPredictionToClip({
  admin,
  clipId,
  projectId,
  prediction,
}: {
  admin: SB;
  clipId: string;
  projectId: string;
  prediction: Prediction<unknown, unknown>;
}): Promise<
  | { kind: "still_running"; status: Prediction["status"] }
  | { kind: "complete"; videoUrl: string }
  | { kind: "failed"; error: string }
> {
  if (prediction.status === "starting" || prediction.status === "processing") {
    await admin
      .from("clips")
      .update({ status: "processing" })
      .eq("id", clipId);
    return { kind: "still_running", status: prediction.status };
  }

  if (prediction.status === "failed" || prediction.status === "canceled") {
    const error =
      prediction.error ??
      (prediction.status === "canceled" ? "Prediction canceled" : "Unknown failure");
    await admin
      .from("clips")
      .update({ status: "failed", error_message: String(error) })
      .eq("id", clipId);
    return { kind: "failed", error: String(error) };
  }

  // succeeded — extract the video URL from output. Seedance returns
  // either a string URL or an array with one URL depending on version.
  const output = prediction.output;
  const outputUrl =
    typeof output === "string"
      ? output
      : Array.isArray(output) && typeof output[0] === "string"
      ? (output[0] as string)
      : null;

  if (!outputUrl) {
    await admin
      .from("clips")
      .update({
        status: "failed",
        error_message: `Prediction succeeded but no video URL in output: ${JSON.stringify(
          output,
        ).slice(0, 400)}`,
      })
      .eq("id", clipId);
    return { kind: "failed", error: "No video URL in Replicate output." };
  }

  // Mirror the video into our own storage so we don't lose it when
  // the Replicate signed URL expires (~1h).
  const { blob, contentType } = await fetchReplicateOutputAsBlob(outputUrl);
  const ext = contentType.includes("webm") ? "webm" : "mp4";
  const storagePath = `${projectId}/${clipId}/video.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("clips")
    .upload(storagePath, blob, {
      contentType,
      upsert: true,
    });

  if (uploadError) {
    await admin
      .from("clips")
      .update({
        status: "failed",
        error_message: `Storage upload failed: ${uploadError.message}`,
      })
      .eq("id", clipId);
    return { kind: "failed", error: uploadError.message };
  }

  const { data: publicUrlData } = admin.storage
    .from("clips")
    .getPublicUrl(storagePath);
  // Bucket is private; public URL won't actually be reachable. We sign
  // on demand when rendering (see /api/clips/[id]/signed-url in Phase 5).
  // For now, store the storage path in video_url so the frontend can
  // ask for a signed URL.
  const videoUrl = publicUrlData.publicUrl;

  await admin
    .from("clips")
    .update({
      status: "complete",
      video_url: videoUrl,
    })
    .eq("id", clipId);

  return { kind: "complete", videoUrl };
}

/**
 * Pull the latest prediction status from Replicate and mirror. Used by
 * both the client-side poll endpoint and the cron fallback.
 */
export async function refreshClipFromReplicate({
  admin,
  clipId,
}: {
  admin: SB;
  clipId: string;
}) {
  const { data: clip, error } = await admin
    .from("clips")
    .select("id, project_id, status, replicate_prediction_id")
    .eq("id", clipId)
    .single();

  if (error || !clip) throw error ?? new Error("Clip not found");
  if (!clip.replicate_prediction_id) {
    return { kind: "no_prediction" as const };
  }
  if (clip.status === "complete" || clip.status === "failed") {
    return { kind: "terminal" as const, status: clip.status };
  }

  const prediction = await getPrediction(clip.replicate_prediction_id);
  return mirrorPredictionToClip({
    admin,
    clipId: clip.id,
    projectId: clip.project_id,
    prediction,
  });
}
