import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { awardEvent } from "@/lib/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  action: z.enum(["enable", "disable", "rotate"]).default("enable"),
});

/**
 * POST /api/projects/[id]/share
 *
 * Mint / rotate / revoke a project share token. The token lets anyone
 * with the link view a public read-only timeline at /share/[token].
 *
 *   action=enable  → ensure token exists and share_enabled=true
 *   action=rotate  → new token, replacing the old
 *   action=disable → share_enabled=false (keep token so re-enabling
 *                    uses the same link)
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema> = { action: "enable" };
  try {
    const raw = await request.json().catch(() => ({}));
    body = bodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 },
    );
  }

  const { data: current, error: readErr } = await supabase
    .from("projects")
    .select("id, share_token, share_enabled")
    .eq("id", id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  if (!current) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let token = current.share_token;
  let enabled = current.share_enabled;

  if (body.action === "rotate" || (body.action === "enable" && !token)) {
    token = mintToken();
  }
  if (body.action === "enable" || body.action === "rotate") {
    enabled = true;
  }
  if (body.action === "disable") {
    enabled = false;
  }

  const { error: updErr } = await supabase
    .from("projects")
    .update({ share_token: token, share_enabled: enabled })
    .eq("id", id);
  if (updErr) {
    return NextResponse.json({ error: updErr.message }, { status: 500 });
  }

  // XP hook — only on transitions into enabled so repeated toggles
  // don't farm points.
  if (enabled && !current.share_enabled) {
    const admin = createServiceRoleClient();
    void awardEvent({
      admin,
      userId: user.id,
      kind: "project_shared",
      meta: { project_id: id },
    });
  }

  return NextResponse.json({
    ok: true,
    share_token: token,
    share_enabled: enabled,
    url: enabled && token ? `/share/${token}` : null,
  });
}

function mintToken(): string {
  // 18-byte token → 24 url-safe chars. Collision-free in practice.
  const bytes = new Uint8Array(18);
  crypto.getRandomValues(bytes);
  let b64 = "";
  for (let i = 0; i < bytes.length; i++) b64 += String.fromCharCode(bytes[i]);
  return btoa(b64)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
