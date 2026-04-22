import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { isPremiumEmail } from "@/lib/auth";
import { sumOverridesForDay, sumOverridesForMonth } from "@/lib/overrides";

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

/**
 * Budget caps for a given user. Premium emails (ALLOWED_EMAIL +
 * anything in PREMIUM_EMAILS) get the bumped set. Non-premium users
 * run on the standard per-user allowance.
 */
export function budgetCaps(email?: string | null) {
  const premium = isPremiumEmail(email);
  const mult = premium ? 10 : 1;
  const concMult = premium ? 2 : 1;
  const hourlyMult = premium ? 3 : 1;
  return {
    premium,
    maxDailyCents:   envNumber("MAX_DAILY_USD", 10)  * 100 * mult,
    maxMonthlyCents: envNumber("MAX_MONTHLY_USD", 50) * 100 * mult,
    maxConcurrent:   envNumber("MAX_CONCURRENT_GENERATIONS", 3) * concMult,
    maxGenPerHour:   envNumber("MAX_GENERATIONS_PER_HOUR", 20) * hourlyMult,
    maxChatPerHour:  envNumber("MAX_CHAT_PER_HOUR", 60) * hourlyMult,
  };
}

// ---------- checks ----------

export type BudgetCheckResult =
  | { ok: true }
  | { ok: false; reason: string; code: "daily_cap" | "monthly_cap" | "rate_limit" | "concurrent_cap" };

/**
 * Check daily + monthly spend against caps for a specific user.
 * Returns ok:true if spend is within budget for a new action of the
 * given estimated cost.
 */
export async function checkSpendCap({
  admin,
  estimateCents,
  userId,
  email,
}: {
  admin: SB;
  estimateCents: number;
  userId: string;
  email?: string | null;
}): Promise<BudgetCheckResult> {
  const caps = budgetCaps(email);
  const now = new Date();
  const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [daily, monthly, dayOverrideCents, monthOverrideCents] = await Promise.all([
    admin
      .from("usage")
      .select("cost_usd_cents")
      .eq("user_id", userId)
      .gte("created_at", dayStart.toISOString()),
    admin
      .from("usage")
      .select("cost_usd_cents")
      .eq("user_id", userId)
      .gte("created_at", monthStart.toISOString()),
    sumOverridesForDay({ admin, userId }),
    sumOverridesForMonth({ admin, userId }),
  ]);

  const sum = (rows: { cost_usd_cents: number }[] | null | undefined) =>
    (rows ?? []).reduce((s, r) => s + (r.cost_usd_cents ?? 0), 0);

  const dayTotal = sum(daily.data);
  const monthTotal = sum(monthly.data);
  const effectiveDailyCap = caps.maxDailyCents + dayOverrideCents;
  const effectiveMonthlyCap = caps.maxMonthlyCents + monthOverrideCents;

  if (dayTotal + estimateCents > effectiveDailyCap) {
    return {
      ok: false,
      code: "daily_cap",
      reason: `Daily spend cap reached ($${(effectiveDailyCap / 100).toFixed(
        2,
      )}). Add $ via the top-up button, or raise MAX_DAILY_USD.`,
    };
  }
  if (monthTotal + estimateCents > effectiveMonthlyCap) {
    return {
      ok: false,
      code: "monthly_cap",
      reason: `Monthly spend cap reached ($${(effectiveMonthlyCap / 100).toFixed(
        2,
      )}). Add $ via the top-up button, or raise MAX_MONTHLY_USD.`,
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
  userId,
}: {
  admin: SB;
  actions: Array<"generate" | "regenerate" | "chat" | "critique">;
  maxPerHour: number;
  userId: string;
}): Promise<BudgetCheckResult> {
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count, error } = await admin
    .from("usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
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
 * Concurrent Replicate predictions in flight. Only counts clips that:
 *   1. Have a replicate_prediction_id (i.e. a VIDEO prediction has
 *      actually been dispatched — stills-only draft rows don't count).
 *   2. Were created in the last 10 minutes (stale predictions from
 *      dev sessions where the webhook never fired don't block new work).
 *
 * The cleanup endpoint (/api/clips/cleanup-stuck) handles truly
 * abandoned clips; this gate just avoids counting them.
 */
const STALE_THRESHOLD_MS = 10 * 60 * 1000;

export async function checkConcurrentGenerations({
  admin,
  userId,
  email,
}: {
  admin: SB;
  userId: string;
  email?: string | null;
}): Promise<BudgetCheckResult> {
  const caps = budgetCaps(email);
  const cutoff = new Date(Date.now() - STALE_THRESHOLD_MS).toISOString();

  // Concurrent is measured across projects the user owns — via a
  // project_id subquery would be ideal, but for single-user-per-app
  // pragmatism we instead fetch user's project ids first and filter.
  const { data: projectRows } = await admin
    .from("projects")
    .select("id")
    .eq("user_id", userId);
  const projectIds = (projectRows ?? []).map((p) => p.id);
  if (projectIds.length === 0) return { ok: true };

  const { count, error } = await admin
    .from("clips")
    .select("*", { count: "exact", head: true })
    .in("project_id", projectIds)
    .in("status", ["queued", "processing"])
    .not("replicate_prediction_id", "is", null)
    .gte("created_at", cutoff);

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
      }). Wait for one to finish, or tap 'clear stuck' if any have been sitting for more than 10 minutes.`,
    };
  }
  return { ok: true };
}

// ---------- recording ----------

export interface RecordUsageArgs {
  admin: SB;
  userId: string;
  projectId: string | null;
  provider: "replicate" | "openrouter" | "openai";
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

type GateArgs = { admin: SB; userId: string; email?: string | null };

export async function gateGeneration(
  args: GateArgs,
): Promise<BudgetCheckResult> {
  const concurrent = await checkConcurrentGenerations(args);
  if (!concurrent.ok) return concurrent;

  const caps = budgetCaps(args.email);
  const rate = await checkRateLimit({
    ...args,
    actions: ["generate", "regenerate"],
    maxPerHour: caps.maxGenPerHour,
  });
  if (!rate.ok) return rate;

  return checkSpendCap({
    ...args,
    estimateCents: ESTIMATE_CENTS_PER_GENERATION,
  });
}

export async function gateChat(args: GateArgs): Promise<BudgetCheckResult> {
  const caps = budgetCaps(args.email);
  const rate = await checkRateLimit({
    ...args,
    actions: ["chat"],
    maxPerHour: caps.maxChatPerHour,
  });
  if (!rate.ok) return rate;

  return checkSpendCap({
    ...args,
    estimateCents: ESTIMATE_CENTS_PER_CHAT_TURN,
  });
}

export async function gateCritique(
  args: GateArgs,
): Promise<BudgetCheckResult> {
  return checkSpendCap({
    ...args,
    estimateCents: ESTIMATE_CENTS_PER_CRITIQUE,
  });
}
