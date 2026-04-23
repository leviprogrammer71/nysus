import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  project_id: z.string().uuid().optional(),
  share_token: z.string().min(6).max(64).optional(),
  action: z.enum(["like", "unlike"]).default("like"),
});

/**
 * POST /api/gallery/like
 *
 * Toggle a like on a public project (share_enabled=true). Uniqueness
 * is enforced by a db index, so re-calling "like" is a no-op and
 * "unlike" drops the row. The response includes the fresh aggregate
 * count so the UI can update without a separate fetch.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json(
      { error: "Sign in to like." },
      { status: 401 },
    );
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 },
    );
  }

  const admin = createServiceRoleClient();

  // Resolve project — either by id (owner/any auth'd user, RLS OK since
  // we service-role) or by share_token for public tiles.
  let projectId = body.project_id ?? null;
  if (!projectId && body.share_token) {
    const { data: p } = await admin
      .from("projects")
      .select("id, share_enabled")
      .eq("share_token", body.share_token)
      .maybeSingle();
    if (!p || !p.share_enabled) {
      return NextResponse.json(
        { error: "Project not found or not shared" },
        { status: 404 },
      );
    }
    projectId = p.id;
  }
  if (!projectId) {
    return NextResponse.json(
      { error: "Provide project_id or share_token" },
      { status: 400 },
    );
  }

  if (body.action === "like") {
    await admin
      .from("gallery_likes")
      .upsert(
        { project_id: projectId, user_id: user.id },
        { onConflict: "project_id,user_id" },
      );
  } else {
    await admin
      .from("gallery_likes")
      .delete()
      .eq("project_id", projectId)
      .eq("user_id", user.id);
  }

  const { count } = await admin
    .from("gallery_likes")
    .select("*", { count: "exact", head: true })
    .eq("project_id", projectId);

  return NextResponse.json({
    ok: true,
    project_id: projectId,
    liked: body.action === "like",
    count: count ?? 0,
  });
}

/**
 * GET /api/gallery/like?project_id=...&share_token=...
 *
 * Returns { liked, count } for the current viewer. Liked is false
 * when unauthenticated.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const share_token = url.searchParams.get("share_token");
  const project_id = url.searchParams.get("project_id");

  const admin = createServiceRoleClient();
  let resolvedId = project_id ?? null;
  if (!resolvedId && share_token) {
    const { data: p } = await admin
      .from("projects")
      .select("id, share_enabled")
      .eq("share_token", share_token)
      .maybeSingle();
    if (p && p.share_enabled) resolvedId = p.id;
  }
  if (!resolvedId) return NextResponse.json({ liked: false, count: 0 });

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ count }, mineR] = await Promise.all([
    admin
      .from("gallery_likes")
      .select("*", { count: "exact", head: true })
      .eq("project_id", resolvedId),
    user
      ? admin
          .from("gallery_likes")
          .select("id")
          .eq("project_id", resolvedId)
          .eq("user_id", user.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  return NextResponse.json({
    liked: Boolean(mineR?.data),
    count: count ?? 0,
  });
}
