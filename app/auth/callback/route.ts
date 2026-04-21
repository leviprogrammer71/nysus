import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";

/**
 * Magic-link callback.
 *
 * Supabase redirects here with `?code=<otp>`. We exchange it for a
 * session, then double-check the resulting user's email matches
 * ALLOWED_EMAIL. If anyone else somehow obtains a valid link, we sign
 * them out immediately and redirect them to /login with an error.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/";

  if (!code) {
    return NextResponse.redirect(new URL("/login?error=missing_code", url.origin));
  }

  const supabase = await createClient();

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(
      new URL(`/login?error=${encodeURIComponent(error.message)}`, url.origin),
    );
  }

  // Belt + suspenders: confirm the session belongs to ALLOWED_EMAIL.
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAllowedEmail(user?.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=not_authorized", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
