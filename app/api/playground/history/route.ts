import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { refreshGenerationFromReplicate } from "@/lib/generations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/playground/history — recent project-less generations.
 *
 * Each call also opportunistically refreshes any pending animation
 * predictions so the user's history strip walks itself forward without
 * a webhook.
 */
export async function GET(_req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { data, error } = await supabase
    .from("generations")
    .select(
      "id, kind, model_id, prompt, output_url, status, error, created_at, completed_at, replicate_prediction_id",
    )
    .is("project_id", null)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(40);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Refresh anything still in flight. Best-effort — a failed refresh
  // just leaves the row in its prior state for the next poll.
  const admin = createServiceRoleClient();
  const pending = (data ?? []).filter(
    (g) =>
      (g.status === "queued" || g.status === "processing") &&
      g.replicate_prediction_id,
  );
  if (pending.length > 0) {
    await Promise.all(
      pending.map((g) =>
        refreshGenerationFromReplicate({
          admin,
          generationId: g.id,
        }).catch(() => undefined),
      ),
    );
    const { data: refreshed } = await supabase
      .from("generations")
      .select(
        "id, kind, model_id, prompt, output_url, status, error, created_at, completed_at, replicate_prediction_id",
      )
      .is("project_id", null)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(40);
    return NextResponse.json({ generations: refreshed ?? [] });
  }

  return NextResponse.json({ generations: data ?? [] });
}
