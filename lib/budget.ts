import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type SB = SupabaseClient<Database>;

/**
 * Usage tracking + budget enforcement.
 *
 * Centralized so /api/generate, /api/clips/[id]/regenerate,
 * /api/chat, and /api/clips/[id]/critique all go through the same
 * gate and leave the same audit trail.
 *
 * Costs are estimates — Replicate and OpenRouter don't return exact
 * per-call pricing in the response, so we charge a conservative
 * flat rate per action. Tighten if you wire the billing APIs.
 */

// ---------- estimates ----------

/** Replicate Seedance 2.0 per 15-second 720p clip. Conservative. */
export const ESTIMATE_CENTS_PER_GENERATION = 30;
/** OpenRouter Claude opus-4 chat turn (average 1.5k in + 600 out). */
export const ESTIMATE_CENTS_PER_CHAT_TURN = 5;
/** Vision critique (3 frames + prompt + 1.5k response). */
export const ESTIMATE_CENTS_PER_CRITIQUE = 10;

// ---------- env defaults ----------

function envNumber(name: string, fallback: number): number {
  const v = process.env[name];
  if (!v) return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function budgetCaps() {
  return {
    maxDailyCents:   envNumber("MAX_DAILY_USD", 10)  * 100,  // $10/day default
    maxMonthlyCents: envNumber("MAX_MONTHLY_USD", 50) * 100, // $50/mo default
    maxConcurrent:   envNumber("MAX_CONCURRENT_GENERATIONS", 3),
    maxGenPerHour:   envNumber("MAX_GENERATIONS_PER_HOUR", 20),
    maxChatPerHour:  envNumber("MAX_CHAT_PER_HOUR", 60),
  };
}

// ---------- checks ----------

export type BudgetCheckResult =
  | { ok: true }
  | { ok: false; reason: string; code: "daily_cap" | "monthly_cap" | "rate_limit" | "concurrent_cap" };

/**
 * Check daily + monthly spend against caps. Returns ok:true if spend
 * is within budget for a new action of the given estimated cost.
 */
export async function checkSpendCap({
  admin,
  estimateCents,
}: {
  admin: SB;
  estimateCents: number;
}): Promise<BudgetCheckResult> {
  const caps = budgetCaps();
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [daily, monthly] = await Promise.all([
    admin.from("usage").select("cost_usd_cents").gte("created_at", dayStart.toISOString()),
    admin.from("usage").select("cost_usd_cents").gte("created_at", monthStart.toISOString()),
  ]);

  const sum = (rows: { cost_usd_cents: number }[] | null | undefined) =>
    (rows ?? []).reduce((s, r) => s + (r.cost_usd_cents ?? 0), 0);

  const dayTotal = sum(daily.data);
  const monthTotal = sum(monthly.data);

  if (dayTotal + estimateCents > caps.maxDailyCents) {
    return {
      ok: false,
      code: "daily_cap",
      reason: `Daily spend cap reached ($${(caps.maxDailyCents / 100).toFixed(
        2,
      )}). Raise MAX_DAILY_USD if you mean to go higher.`,
    };
  }
  if (monthTotal + estimateCents > caps.maxMonthlyCents) {
    return {
      ok: false,
      code: "monthly_cap",
      reason: `Monthly spend cap reached ($${(caps.maxMonthlyCents / 100).toFixed(
        2,
      )}). Raise MAX_MONTHLY_USD if you mean to go higher.`,
    };
  }
  return { ok: true };
}

/**
 * Rate limit by action-kind per hour. Uses the usage table as the
 * source of truth so we don't need a separate rate_limits table.
 */
export async function checkRateLimit({
  admin,
  actions,
  maxPerHour,
}: {
  admin: SB;
  actions: Array<"generate" | "regenerate" | "chat" | "critique">;
  maxPerHour: number;
}): Promise<BudgetCheckResult> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("usage")
    .select("*", { count: "exact", head: true })
    .in("action", actions)
    .gte("created_at", hourAgo);

  if (error) {
    // Don't fail closed on a transient issue — note and proceed.
    console.warn("checkRateLimit:", error.message);
    return { ok: true };
  }
  if ((count ?? 0) >= maxPerHour) {
    return {
      ok: false,
      code: "rate_limit",
      reason: `Rate limit: ${maxPerHour}/hour reached for ${actions.join(
        ", ",
      )}. Try again later.`,
    };
  }
  return { ok: true };
}

/**
 * Concurrent Replicate predictions in flight. Uses clips rows in
 * 'queued' or 'processing' state.
 */
export async function checkConcurrentGenerations({
  admin,
}: {
  admin: SB;
}): Promise<BudgetCheckResult> {
  const caps = budgetCaps();
  const { count, error } = await admin
    .from("clips")
    .select("*", { count: "exact", head: true })
    .in("status", ["queued", "processing"]);

  if (error) {
    console.warn("checkConcurrentGenerations:", error.message);
    return { ok: true };
  }
  if ((count ?? 0) >= caps.maxConcurrent) {
    return {
      ok: false,
      code: "concurrent_cap",
      reason: `Already ${count} clip${count === 1 ? "" : "s"} in flight (max ${
        caps.maxConcurrent
      }). Wait for one to finish.`,
    };
  }
  return { ok: true };
}

// ---------- recording ----------

export interface RecordUsageArgs {
  admin: SB;
  userId: string;
  projectId: string | null;
  provider: "replicate" | "openrouter";
  action: "generate" | "regenerate" | "chat" | "critique";
  costCents?: number;
  tokensIn?: number;
  tokensOut?: number;
  metadata?: Record<string, unknown>;
}

/**
 * Record a paid call. Fire-and-forget is fine; the returned promise
 * logs errors but callers don't need to await it unless they want to
 * enforce ordering.
 */
export async function recordUsage(args: RecordUsageArgs): Promise<void> {
  const { admin, userId, projectId, provider, action, costCents, tokensIn, tokensOut, metadata } = args;

  const { error } = await admin.from("usage").insert({
    user_id: userId,
    project_id: projectId,
    provider,
    action,
    cost_usd_cents: costCents ?? estimateCost(action),
    tokens_in: tokensIn ?? null,
    tokens_out: tokensOut ?? null,
    metadata: metadata ?? {},
  });
  if (error) {
    // Not fatal — we don't want to fail a user's chat because of a
    // metrics-insert hiccup. Log loudly instead.
    console.warn("recordUsage failed:", error.message);
  }
}

export function estimateCost(
  action: "generate" | "regenerate" | "chat" | "critique",
): number {
  switch (action) {
    case "generate":
    case "regenerate":
      return ESTIMATE_CENTS_PER_GENERATION;
    case "chat":
      return ESTIMATE_CENTS_PER_CHAT_TURN;
    case "critique":
      return ESTIMATE_CENTS_PER_CRITIQUE;
  }
}

// ---------- helper: combined gate used by generation paths ----------

export async function gateGeneration(admin: SB): Promise<BudgetCheckResult> {
  const concurrent = await checkConcurrentGenerations({ admin });
  if (!concurrent.ok) return concurrent;

  const caps = budgetCaps();
  const rate = await checkRateLimit({
    admin,
    actions: ["generate", "regenerate"],
    maxPerHour: caps.maxGenPerHour,
  });
  if (!rate.ok) return rate;

  return checkSpendCap({ admin, estimateCents: ESTIMATE_CENTS_PER_GENERATION });
}

export async function gateChat(admin: SB): Promise<BudgetCheckResult> {
  const caps = budgetCaps();
  const rate = await checkRateLimit({
    admin,
    actions: ["chat"],
    maxPerHour: caps.maxChatPerHour,
  });
  if (!rate.ok) return rate;

  return checkSpendCap({ admin, estimateCents: ESTIMATE_CENTS_PER_CHAT_TURN });
}

export async function gateCritique(admin: SB): Promise<BudgetCheckResult> {
  return checkSpendCap({ admin, estimateCents: ESTIMATE_CENTS_PER_CRITIQUE });
}
