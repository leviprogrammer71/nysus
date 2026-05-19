import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_MONTHLY_USD = Number(process.env.MAX_MONTHLY_USD ?? 50);

/**
 * GET /api/usage/summary — small JSON consumed by the WorkspaceShell
 * sidebar to draw the "monthly forge" usage bar. Best-effort: returns
 * { percent: 0 } if anything errors so the UI never blocks.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!isAuthenticated(user)) {
      return NextResponse.json({ percent: 0 });
    }
    const admin = createServiceRoleClient();
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0),
    ).toISOString();

    const { data } = await admin
      .from("usage")
      .select("cost_usd_cents")
      .eq("user_id", user.id)
      .gte("created_at", monthStart);

    const cents = (data ?? []).reduce(
      (acc, row) => acc + (row.cost_usd_cents ?? 0),
      0,
    );
    const capCents = DEFAULT_MONTHLY_USD * 100;
    const percent = capCents > 0 ? Math.min(100, (cents / capCents) * 100) : 0;
    return NextResponse.json({ percent, cents, cap_cents: capCents });
  } catch {
    return NextResponse.json({ percent: 0 });
  }
}
