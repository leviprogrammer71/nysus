import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  fetchReplicateOutputAsBlob,
  getPrediction,
} from "@/lib/replicate";

/**
 * Generations log helpers.
 *
 * The `generations` table records every Replicate call — image,
 * animation, playground. /api/playground/history calls this on each
 * page load to walk pending predictions forward without a webhook.
 *
 * Mirroring policy:
 *   image     — store as jpg/png under playground/{user}/{id}.{ext}
 *   animation — store as mp4 under playground/{user}/{id}.mp4
 */

export async function refreshGenerationFromReplicate({
  admin,
  generationId,
}: {
  admin: SupabaseClient<Database>;
  generationId: string;
}): Promise<void> {
  const { data: row } = await admin
    .from("generations")
    .select("id, user_id, kind, status, replicate_prediction_id, output_url")
    .eq("id", generationId)
    .single();
  if (!row || !row.replicate_prediction_id) return;
  if (row.status !== "queued" && row.status !== "processing") return;

  const pred = await getPrediction(row.replicate_prediction_id);
  if (
    pred.status === "starting" ||
    pred.status === "processing"
  ) {
    return;
  }

  if (pred.status !== "succeeded") {
    await admin
      .from("generations")
      .update({
        status: pred.status === "canceled" ? "canceled" : "failed",
        error: pred.error ?? `prediction ${pred.status}`,
        completed_at: pred.completed_at ?? new Date().toISOString(),
      })
      .eq("id", row.id);
    return;
  }

  const url = pickOutputUrl(pred.output);
  if (!url) {
    await admin
      .from("generations")
      .update({
        status: "failed",
        error: "Model returned no output URL.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
    return;
  }

  // Mirror to storage so the URL doesn't expire on the user's history strip.
  try {
    const fetched = await fetchReplicateOutputAsBlob(url);
    const ext =
      row.kind === "animation"
        ? "mp4"
        : fetched.contentType.includes("png")
        ? "png"
        : "jpg";
    const path = `playground/${row.user_id}/${row.id}.${ext}`;
    const { error: upErr } = await admin.storage
      .from("clips")
      .upload(path, fetched.blob, {
        contentType: fetched.contentType,
        upsert: true,
      });
    if (upErr) throw new Error(upErr.message);
    const { data: signed } = await admin.storage
      .from("clips")
      .createSignedUrl(path, 60 * 60 * 6);
    const finalUrl = signed?.signedUrl ?? url;
    await admin
      .from("generations")
      .update({
        status: "succeeded",
        output_url: finalUrl,
        completed_at: pred.completed_at ?? new Date().toISOString(),
      })
      .eq("id", row.id);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await admin
      .from("generations")
      .update({
        status: "failed",
        error: `mirror failed: ${msg}`,
        completed_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }
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
