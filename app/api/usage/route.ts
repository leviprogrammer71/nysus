import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { budgetCaps } from "@/lib/budget";
import { sumOverridesForDay, sumOverridesForMonth } from "@/lib/overrides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/usage — returns spend totals for today + this month scoped
 * to the authenticated user, the current caps (bumped for premium
 * emails), and any Stripe top-ups already applied to today / this month.
 *
 * Used by the home header's tiny UsageStrip and the dashboard's larger
 * UsageMeter card.
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
  const dayStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const monthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  );
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Scope concurrent to projects owned by this user so we don't leak
  // other users' in-flight counts.
  const { data: projectIdsRows } = await admin
    .from("projects")
    .select("id")
    .eq("user_id", user.id);
  const projectIds = (projectIdsRows ?? []).map((p) => p.id);

  const concurrentQ =
    projectIds.length === 0
      ? Promise.resolve({ count: 0 })
      : admin
          .from("clips")
          .select("*", { count: "exact", head: true })
          .in("project_id", projectIds)
          .in("status", ["queued", "processing"])
          .not("replicate_prediction_id", "is", null);

  const [
    dailyR,
    monthlyR,
    hourlyGenR,
    hourlyChatR,
    concurrentR,
    dayOverrideCents,
    monthOverrideCents,
  ] = await Promise.all([
    admin
      .from("usage")
      .select("provider, action, cost_usd_cents")
      .eq("user_id", user.id)
      .gte("created_at", dayStart.toISOString()),
    admin
      .from("usage")
      .select("provider, action, cost_usd_cents")
      .eq("user_id", user.id)
      .gte("created_at", monthStart.toISOString()),
    admin
      .from("usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .in("action", ["generate", "regenerate"])
      .gte("created_at", hourAgo.toISOString()),
    admin
      .from("usage")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("action", "chat")
      .gte("created_at", hourAgo.toISOString()),
    concurrentQ,
    sumOverridesForDay({ admin, userId: user.id }),
    sumOverridesForMonth({ admin, userId: user.id }),
  ]);

  const sum = (rows: { cost_usd_cents: number }[] | null | undefined) =>
    (rows ?? []).reduce((s, r) => s + (r.cost_usd_cents ?? 0), 0);

  const caps = budgetCaps(user.email);
  const dailyCents = sum(dailyR.data);
  const monthlyCents = sum(monthlyR.data);
  const effectiveDailyCents = caps.maxDailyCents + dayOverrideCents;
  const effectiveMonthlyCents = caps.maxMonthlyCents + monthOverrideCents;

  return NextResponse.json({
    spend: {
      today_cents: dailyCents,
      today_usd: (dailyCents / 100).toFixed(2),
      month_cents: monthlyCents,
      month_usd: (monthlyCents / 100).toFixed(2),
    },
    caps: {
      daily_usd: (effectiveDailyCents / 100).toFixed(2),
      monthly_usd: (effectiveMonthlyCents / 100).toFixed(2),
      concurrent_generations: caps.maxConcurrent,
      generations_per_hour: caps.maxGenPerHour,
      chat_per_hour: caps.maxChatPerHour,
      premium: caps.premium,
    },
    overrides: {
      day_cents: dayOverrideCents,
      month_cents: monthOverrideCents,
    },
    rate_limits: {
      generations_last_hour: hourlyGenR.count ?? 0,
      chat_last_hour: hourlyChatR.count ?? 0,
      concurrent_clips_in_flight: concurrentR.count ?? 0,
    },
  });
}
