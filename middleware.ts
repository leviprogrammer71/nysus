import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isAllowedEmail } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

// Paths that are reachable without a session.
const PUBLIC_PATHS = [
  "/login",
  "/auth/callback",
  "/auth/signout", // POST-only; handler redirects to /login
  "/setup", // env-not-configured landing
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Before Phase 1 env is populated, every page that touches Supabase
  // would explode. Send everyone to /setup instead so Phase 0 scaffold
  // can still be verified with zero configuration.
  if (!isSupabaseConfigured()) {
    if (pathname === "/setup") return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  const { supabaseResponse, user } = await updateSession(request);

  // Not signed in → bounce to /login (unless already on a public path).
  if (!user) {
    if (isPublicPath(pathname)) return supabaseResponse;
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Signed in but not the allowed user → force sign-out.
  if (!isAllowedEmail(user.email)) {
    const signOutUrl = new URL("/auth/signout", request.url);
    return NextResponse.redirect(signOutUrl);
  }

  // Signed in & allowed: if they're on /login, send them home.
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    // Run middleware on everything except static assets and _next internals.
    "/((?!_next/static|_next/image|favicon.ico|icons/|manifest.webmanifest|.*\\..*).*)",
  ],
};
