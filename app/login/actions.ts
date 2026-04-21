"use server";

import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { isAllowedEmail } from "@/lib/auth";

type LoginState = {
  ok: boolean;
  message: string;
};

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const rawEmail = formData.get("email");
  const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";

  // Gate at the door. We could return the same response regardless to
  // avoid user enumeration, but this is single-user — no one's scraping
  // us, and the clearer error is more useful.
  if (!isAllowedEmail(email)) {
    return {
      ok: false,
      message: "Not authorized. This app is single-user.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${env.NEXT_PUBLIC_APP_URL}/auth/callback`,
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return {
    ok: true,
    message: "Magic link sent. Check your inbox.",
  };
}
