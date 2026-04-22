import { env } from "@/lib/env";

/**
 * Auth helpers for multi-user Nysus.
 *
 * The app used to gate everything behind a single ALLOWED_EMAIL.
 * It's now multi-tenant: any signed-in user can create projects.
 * ALLOWED_EMAIL + PREMIUM_EMAILS remain as a *budget* privilege —
 * they get larger daily/monthly caps.
 */

type UserLike = { email?: string | null } | null | undefined;

export function normalizeEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

/**
 * Any authenticated user with an email is authorized for basic app
 * operations. Paired with RLS, this is the one gate API routes need.
 */
export function isAuthenticated(user: UserLike): user is { email: string } {
  return Boolean(user?.email && user.email.length > 0);
}

/**
 * Premium emails get the bumped budget caps. Includes ALLOWED_EMAIL
 * (the owner's email, for backward compat) plus anything listed in
 * PREMIUM_EMAILS (comma-separated in env).
 */
export function isPremiumEmail(email: string | null | undefined): boolean {
  const normalized = normalizeEmail(email);
  if (!normalized) return false;

  // ALLOWED_EMAIL — owner — always premium.
  try {
    if (normalized === env.ALLOWED_EMAIL) return true;
  } catch {
    /* ALLOWED_EMAIL not configured — skip */
  }

  const raw = process.env.PREMIUM_EMAILS;
  if (!raw) return false;
  const list = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(normalized);
}

// --- legacy shims (kept so old call sites compile while we migrate) ---

/** @deprecated use isAuthenticated(user) — any authenticated user is allowed. */
export function isAllowedEmail(email: string | null | undefined): boolean {
  return Boolean(email && email.trim().length > 0);
}

/** @deprecated */
export function assertAllowedEmail(email: string | null | undefined): string {
  const normalized = normalizeEmail(email);
  if (!normalized) throw new Error("Not authenticated.");
  return normalized;
}
