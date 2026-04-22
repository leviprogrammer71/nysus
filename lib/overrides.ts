import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type SB = SupabaseClient<Database>;

/**
 * Helpers for reading user_budget_overrides (Stripe-backed top-ups).
 * Overrides ADD to the env-based caps; they don't replace them. We
 * store them per-UTC-day (scope='day', period='YYYY-MM-DD') or
 * per-UTC-month (scope='month', period='YYYY-MM').
 */

export function todayPeriod(d: Date = new Date()): string {
  return (
    d.getUTCFullYear() +
    "-" +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

export function monthPeriod(d: Date = new Date()): string {
  return (
    d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0")
  );
}

export async function sumOverridesForDay({
  admin,
  userId,
  day = todayPeriod(),
}: {
  admin: SB;
  userId: string;
  day?: string;
}): Promise<number> {
  const { data } = await admin
    .from("user_budget_overrides")
    .select("extra_cents")
    .eq("user_id", userId)
    .eq("scope", "day")
    .eq("period", day);
  return (data ?? []).reduce((s, r) => s + (r.extra_cents ?? 0), 0);
}

export async function sumOverridesForMonth({
  admin,
  userId,
  month = monthPeriod(),
}: {
  admin: SB;
  userId: string;
  month?: string;
}): Promise<number> {
  const { data } = await admin
    .from("user_budget_overrides")
    .select("extra_cents")
    .eq("user_id", userId)
    .eq("scope", "month")
    .eq("period", month);
  return (data ?? []).reduce((s, r) => s + (r.extra_cents ?? 0), 0);
}
