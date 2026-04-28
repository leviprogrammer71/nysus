import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { isAuthenticated } from "@/lib/auth";
import { isSupabaseConfigured } from "@/lib/env";

/**
 * Paths anyone can hit without an auth session:
 *   /         public landing (showcase + try-Dio preview)
 *   /login    sign in / sign up
 *   /setup    env checklist before Supabase is wired
 *   /auth/**  OAuth / signout redirects
 *   /api/health  health probe
 */
const PUBLIC_EXACT = new Set<string>([
  "/",
  "/login",
  "/setup",
  "/gallery",
  "/pricing",
]);
const PUBLIC_PREFIXES = [
  "/auth/",
  "/login/",
  "/setup/",
  "/api/health",
  "/share/",
  "/gallery/",
  "/sw.js",
];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Before Phase 1 env is populated, every page that touches Supabase
  // would explode. Send everyone to /setup instead so the public
  // landing isn't required to work with zero config.
  if (!isSupabaseConfigured()) {
    if (pathname === "/setup") return NextResponse.next();
    return NextResponse.redirect(new URL("/setup", request.url));
  }

  const { supabaseResponse, user } = await updateSession(request);

  // Signed-in users visiting the public landing go straight to their
  // dashboard — no need to see the marketing page twice.
  if (pathname === "/" && isAuthenticated(user)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // Public paths don't require a session.
  if (isPublicPath(pathname)) return supabaseResponse;

  // Everything else requires authentication.
  if (!isAuthenticated(user)) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/" && pathname !== "/dashboard") {
      loginUrl.searchParams.set("next", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  // Signed in but on /login → dashboard.
  if (pathname === "/login") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons/|video/|showcase/|illustrations/|manifest.webmanifest|og-image.png|.*\\..*).*)",
  ],
};
