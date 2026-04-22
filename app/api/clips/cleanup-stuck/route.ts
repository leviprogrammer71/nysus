import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import { cancelPrediction } from "@/lib/replicate";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/clips/cleanup-stuck
 *
 * Marks any clip that's been 'queued' or 'processing' for more than
 * 10 minutes as 'failed' so the budget gate stops counting it, and
 * cancels the associated Replicate prediction best-effort so we don't
 * keep paying for ghost renders. Safe to call repeatedly.
 *
 * Optional body: { project_id } to scope cleanup to a single project.
 */
const STALE_MS = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let projectId: string | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      project_id?: string;
    };
    if (typeof body.project_id === "string") projectId = body.project_id;
  } catch {
    /* no body is fine */
  }

  const admin = createServiceRoleClient();
  const cutoff = new Date(Date.now() - STALE_MS).toISOString();

  let q = admin
    .from("clips")
    .select("id, project_id, replicate_prediction_id, still_replicate_prediction_id")
    .in("status", ["queued", "processing"])
    .lt("created_at", cutoff);
  if (projectId) q = q.eq("project_id", projectId);

  const { data: stale, error } = await q;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let cancelled = 0;
  for (const clip of stale ?? []) {
    // Best-effort cancel of any hanging Replicate predictions.
    if (clip.replicate_prediction_id) {
      try {
        await cancelPrediction(clip.replicate_prediction_id);
      } catch {
        /* prediction may already be finished */
      }
    }
    if (clip.still_replicate_prediction_id) {
      try {
        await cancelPrediction(clip.still_replicate_prediction_id);
      } catch {
        /* ignore */
      }
    }
    cancelled++;
  }

  // Flip status.
  if (stale && stale.length > 0) {
    const ids = stale.map((s) => s.id);
    await admin
      .from("clips")
      .update({
        status: "failed",
        error_message: "Marked failed by cleanup (stale > 10 min).",
      })
      .in("id", ids);
    // If a still was also stuck, flip that too.
    await admin
      .from("clips")
      .update({ still_status: "failed" })
      .in("id", ids)
      .in("still_status", ["queued", "processing"]);
  }

  return NextResponse.json({
    ok: true,
    cleaned: stale?.length ?? 0,
    cancelled,
  });
}
