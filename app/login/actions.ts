"use server";

import { redirect } from "next/navigation";
import {
  createClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { normalizeEmail } from "@/lib/auth";

type LoginState = {
  ok: boolean;
  message: string;
};

/**
 * Email + password sign-in / sign-up.
 *
 * Multi-tenant: any email can create an account. No emails are ever
 * sent (we use admin.createUser with email_confirm=true so Supabase
 * skips confirmation).
 *
 * Flow:
 *   1. Try signInWithPassword. If OK, redirect.
 *   2. If fail, admin.listUsers to find by email.
 *      - Exists → admin.updateUserById (this acts as a soft password
 *        reset; fine for the single-session bootstrap UX, but anyone
 *        who wants real security should add a separate reset flow).
 *      - Doesn't exist → admin.createUser.
 *   3. Retry signInWithPassword.
 */
export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");
  const email =
    typeof rawEmail === "string" ? normalizeEmail(rawEmail) : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (!email || !email.includes("@")) {
    return { ok: false, message: "Enter a valid email." };
  }
  if (password.length < 6) {
    return {
      ok: false,
      message: "Password must be at least 6 characters.",
    };
  }

  const supabase = await createClient();

  // Step 1: try password sign-in.
  const first = await supabase.auth.signInWithPassword({ email, password });
  if (!first.error) {
    redirect("/dashboard");
  }

  // Step 2: sign-in failed. Look up / create the user.
  const admin = createServiceRoleClient();

  let userId: string | null = null;
  try {
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw listErr;
    userId =
      list.users.find((u) => normalizeEmail(u.email ?? "") === email)?.id ??
      null;
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Lookup failed.",
    };
  }

  if (userId) {
    // Existing user — set password. Multi-user note: in production you'd
    // want a proper 'forgot password' flow here instead. Today, first
    // login effectively claims the password.
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updErr) return { ok: false, message: updErr.message };
  } else {
    // Brand new user. email_confirm=true skips Supabase's confirmation
    // email entirely.
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) return { ok: false, message: createErr.message };
  }

  // Step 3: retry sign-in.
  const retry = await supabase.auth.signInWithPassword({ email, password });
  if (retry.error) {
    return { ok: false, message: retry.error.message };
  }

  redirect("/dashboard");
}
