import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";

/**
 * OAuth / magic-link callback (vestigial — kept for backward compat
 * if any legacy link flows still route here; the main auth path is
 * now password sign-in through /login).
 *
 * Exchanges the code for a session, verifies we have an authenticated
 * user, redirects to the requested next page (defaults to /dashboard).
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next") ?? "/dashboard";

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

  const { data: { user } } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/login?error=no_session", url.origin));
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
