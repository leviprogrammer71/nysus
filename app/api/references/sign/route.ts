import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  project_id: z.string().uuid(),
  paths: z.array(z.string()).min(1).max(20),
});

/**
 * POST /api/references/sign
 *
 * body: { project_id, paths[] }
 *
 * Returns a map of path → short-lived signed URL so the edit form
 * can render thumbnail previews without having to bake URLs into
 * the JSONB (which would go stale).
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid payload" },
      { status: 400 },
    );
  }

  // Every requested path must belong to this project. Refuse wild
  // paths even if the caller somehow has another project's path.
  const prefix = `${body.project_id}/`;
  const clean = body.paths.filter((p) => p.startsWith(prefix));

  // Confirm project ownership via RLS.
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", body.project_id)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const admin = createServiceRoleClient();
  const out: Record<string, string | null> = {};

  for (const path of clean) {
    const { data } = await admin.storage
      .from("clips")
      .createSignedUrl(path, 60 * 60);
    out[path] = data?.signedUrl ?? null;
  }

  return NextResponse.json({ urls: out });
}
