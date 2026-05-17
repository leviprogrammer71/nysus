import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/projects/recent — the WorkspaceShell sidebar's project
 * switcher loads this on mount. Returns the user's most recently
 * touched projects (RLS-gated so each user sees their own).
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ projects: [] });
  }
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(8);
  if (error) {
    return NextResponse.json({ projects: [] });
  }
  return NextResponse.json({ projects: data ?? [] });
}
