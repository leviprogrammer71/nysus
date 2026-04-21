import { env } from "@/lib/env";

/**
 * ALLOWED_EMAIL gate.
 *
 * Nysus is single-user. Magic-link auth will still _technically_ allow
 * any Supabase-configured email to sign up, so we enforce the gate at
 * three layers:
 *
 *   1. Login form — refuse to send the magic link for other emails.
 *   2. Auth callback — if an unexpected user shows up at
 *      /auth/callback, immediately sign them out.
 *   3. Middleware — double-check on every request.
 *
 * This is paranoid on purpose. Losing the gate means anyone can
 * provision clips in our Supabase project and burn the Replicate quota.
 */
export function isAllowedEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === env.ALLOWED_EMAIL;
}

export function assertAllowedEmail(email: string | null | undefined): string {
  const normalized = (email ?? "").trim().toLowerCase();
  if (!isAllowedEmail(normalized)) {
    throw new Error("Not authorized.");
  }
  return normalized;
}
