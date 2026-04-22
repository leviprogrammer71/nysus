import { NextResponse } from "next/server";
import {
  createServiceRoleClient,
  createClient,
} from "@/lib/supabase/server";
import { envStatus, isSupabaseConfigured } from "@/lib/env";
import { isAllowedEmail } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Diagnostic endpoint — tells the UI exactly what's wrong when the
 * user lands on a broken state (env missing, migration not run,
 * auth misconfigured, etc.).
 *
 * No secrets are ever echoed — only booleans and error codes.
 */
export async function GET() {
  const env = envStatus();

  // Schema probe: try a cheap select on each table we rely on. We use
  // the service-role client so we don't fail for an unauth'd visitor,
  // and so RLS doesn't mask a missing table with an empty result.
  const result: {
    env_configured: boolean;
    env: ReturnType<typeof envStatus>;
    tables: Record<string, { ok: boolean; error?: string }>;
    all_tables_present: boolean;
    auth_reachable: boolean;
    auth_error?: string;
    next_step: string;
  } = {
    env_configured: isSupabaseConfigured(),
    env,
    tables: {},
    all_tables_present: false,
    auth_reachable: false,
    next_step: "",
  };

  if (!isSupabaseConfigured()) {
    result.next_step =
      "Populate NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local.";
    return NextResponse.json(result, { status: 200 });
  }

  let admin;
  try {
    admin = createServiceRoleClient();
  } catch (err) {
    result.next_step = err instanceof Error ? err.message : String(err);
    return NextResponse.json(result, { status: 200 });
  }

  const tableNames = ["projects", "clips", "messages"] as const;
  let allOk = true;
  for (const t of tableNames) {
    const { error } = await admin.from(t).select("id").limit(1);
    if (error) {
      allOk = false;
      result.tables[t] = { ok: false, error: error.message };
    } else {
      result.tables[t] = { ok: true };
    }
  }
  result.all_tables_present = allOk;

  // Auth reachability — does the anon cookies-based client at least boot?
  try {
    const supabase = await createClient();
    await supabase.auth.getSession();
    result.auth_reachable = true;
  } catch (err) {
    result.auth_error = err instanceof Error ? err.message : String(err);
  }

  if (!allOk) {
    result.next_step =
      "Run supabase/migrations/0001_init.sql in your Supabase project's SQL editor, then reload.";
  } else if (!result.auth_reachable) {
    result.next_step =
      "Auth client couldn't initialize — double-check NEXT_PUBLIC_SUPABASE_URL.";
  } else {
    result.next_step = "ok";
  }

  return NextResponse.json(result, { status: 200 });
}

/**
 * POST /api/health — gated by ALLOWED_EMAIL. Returns a non-paginated
 * summary safe to call from authenticated UIs.
 */
export async function POST() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  return GET();
}
