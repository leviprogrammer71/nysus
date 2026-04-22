"use server";

import { redirect } from "next/navigation";
import {
  createClient,
  createServiceRoleClient,
} from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";

type LoginState = {
  ok: boolean;
  message: string;
};

/**
 * Email + password sign-in.
 *
 * No emails ever go out. Flow:
 *   1. Gate by ALLOWED_EMAIL.
 *   2. Try `signInWithPassword`. If it succeeds, redirect.
 *   3. If it fails, use the service-role admin client to either
 *      create the user (first run) or update their password (they
 *      had a passwordless magic-link user from before the auth
 *      switch, or they simply forgot). `email_confirm: true` means
 *      no confirmation email is ever sent.
 *   4. Retry signInWithPassword.
 *
 * Because every step is gated by ALLOWED_EMAIL matching server-side,
 * the "update password on failure" behavior is safe — only the one
 * allowed email can reach this path.
 */
export async function signIn(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const rawPassword = formData.get("password");
  const email =
    typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
  const password = typeof rawPassword === "string" ? rawPassword : "";

  if (!isAllowedEmail(email)) {
    return {
      ok: false,
      message: "Not authorized. This app is single-user.",
    };
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
    // Success — clear redirect.
    redirect("/");
  }

  // Step 2: sign-in failed. Inspect whether the user exists, then
  // either create them or update their password. The admin client
  // bypasses RLS so this works even before the projects/clips tables
  // exist.
  const admin = createServiceRoleClient();

  let userId: string | null = null;
  try {
    // listUsers paginates (default 50). For a single-user app this
    // covers everything we need. Cap at 200 so even test noise is fine.
    const { data: list, error: listErr } = await admin.auth.admin.listUsers({
      page: 1,
      perPage: 200,
    });
    if (listErr) throw listErr;
    userId =
      list.users.find(
        (u) => (u.email ?? "").trim().toLowerCase() === email,
      )?.id ?? null;
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Lookup failed.",
    };
  }

  if (userId) {
    // User exists (probably from a prior magic-link sign-in or a
    // password we want to replace). Set the password, mark confirmed,
    // then retry. This doubles as a "forgot password" path — safe
    // here because only ALLOWED_EMAIL can reach it.
    const { error: updErr } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    });
    if (updErr) return { ok: false, message: updErr.message };
  } else {
    // User doesn't exist — bootstrap them. email_confirm=true tells
    // Supabase to skip the confirmation email entirely.
    const { error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (createErr) return { ok: false, message: createErr.message };
  }

  // Step 3: retry sign-in. Should succeed now.
  const retry = await supabase.auth.signInWithPassword({ email, password });
  if (retry.error) {
    return { ok: false, message: retry.error.message };
  }

  redirect("/");
}
