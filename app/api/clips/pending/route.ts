import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { refreshClipFromReplicate } from "@/lib/clips";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cron fallback — runs every minute via Vercel Cron. Polls Replicate
 * for any queued/processing clip that's been in flight for more than
 * a minute (to let the webhook fire first in the happy path).
 *
 * Auth: CRON_SECRET in either an Authorization header or ?secret= query.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const header = request.headers.get("authorization");
  const querySecret = url.searchParams.get("secret");

  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : null;
  const ok = bearer === env.CRON_SECRET || querySecret === env.CRON_SECRET;

  if (!ok) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = createServiceRoleClient();
  const cutoff = new Date(Date.now() - 60 * 1000).toISOString();

  const { data: pending, error } = await admin
    .from("clips")
    .select("id")
    .in("status", ["queued", "processing"])
    .not("replicate_prediction_id", "is", null)
    .lt("created_at", cutoff)
    .limit(20);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results = [];
  for (const clip of pending ?? []) {
    try {
      const r = await refreshClipFromReplicate({ admin, clipId: clip.id });
      results.push({ clip_id: clip.id, ...r });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ clip_id: clip.id, kind: "error" as const, error: msg });
    }
  }

  return NextResponse.json({ checked: results.length, results });
}
