import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { budgetCaps } from "@/lib/budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/usage — returns spend totals for today + this month, split
 * by provider + action, plus the current caps. Used by the home
 * budget strip and future usage dashboard.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();

  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  const [dailyR, monthlyR, hourlyGenR, hourlyChatR, concurrentR] = await Promise.all([
    admin.from("usage").select("provider, action, cost_usd_cents").gte("created_at", dayStart.toISOString()),
    admin.from("usage").select("provider, action, cost_usd_cents").gte("created_at", monthStart.toISOString()),
    admin
      .from("usage")
      .select("*", { count: "exact", head: true })
      .in("action", ["generate", "regenerate"])
      .gte("created_at", hourAgo.toISOString()),
    admin
      .from("usage")
      .select("*", { count: "exact", head: true })
      .eq("action", "chat")
      .gte("created_at", hourAgo.toISOString()),
    admin
      .from("clips")
      .select("*", { count: "exact", head: true })
      .in("status", ["queued", "processing"]),
  ]);

  const sum = (rows: { cost_usd_cents: number }[] | null | undefined) =>
    (rows ?? []).reduce((s, r) => s + (r.cost_usd_cents ?? 0), 0);

  const caps = budgetCaps();
  const dailyCents = sum(dailyR.data);
  const monthlyCents = sum(monthlyR.data);

  return NextResponse.json({
    spend: {
      today_cents: dailyCents,
      today_usd: (dailyCents / 100).toFixed(2),
      month_cents: monthlyCents,
      month_usd: (monthlyCents / 100).toFixed(2),
    },
    caps: {
      daily_usd: (caps.maxDailyCents / 100).toFixed(2),
      monthly_usd: (caps.maxMonthlyCents / 100).toFixed(2),
      concurrent_generations: caps.maxConcurrent,
      generations_per_hour: caps.maxGenPerHour,
      chat_per_hour: caps.maxChatPerHour,
    },
    rate_limits: {
      generations_last_hour: hourlyGenR.count ?? 0,
      chat_last_hour: hourlyChatR.count ?? 0,
      concurrent_clips_in_flight: concurrentR.count ?? 0,
    },
  });
}
