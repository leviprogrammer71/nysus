import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024; // 12MB — generous for a chat paste
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

/**
 * Upload an image attachment for a chat message.
 *
 * Body: multipart/form-data
 *   project_id: uuid
 *   file:       image blob
 *
 * Stores under `clips` bucket at
 *   {project_id}/chat/{yyyy-mm}/{rand}.{ext}
 * and returns a 30-minute signed URL + the storage path. The client
 * keeps the URL with the draft message until Send, at which point
 * /api/chat receives `attached_image_urls` and sends them to Claude
 * as vision parts.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const form = await request.formData();
  const projectId = form.get("project_id");
  const file = form.get("file");

  if (typeof projectId !== "string") {
    return NextResponse.json({ error: "Missing project_id" }, { status: 400 });
  }
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB)` },
      { status: 413 },
    );
  }
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported type: ${file.type}` },
      { status: 415 },
    );
  }

  // Verify the project is ours (RLS-gated read — service role is for
  // storage writes only).
  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const admin = createServiceRoleClient();
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
      ? "webp"
      : file.type === "image/gif"
      ? "gif"
      : file.type === "image/heic" || file.type === "image/heif"
      ? "heic"
      : "jpg";

  const now = new Date();
  const yyyyMm = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  const rand = crypto.randomUUID();
  const path = `${projectId}/chat/${yyyyMm}/${rand}.${ext}`;

  const { error: uploadError } = await admin.storage
    .from("clips")
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: signed, error: signErr } = await admin.storage
    .from("clips")
    .createSignedUrl(path, 60 * 30); // 30 minutes — only need this for the in-flight chat call
  if (signErr || !signed) {
    return NextResponse.json(
      { error: signErr?.message ?? "Sign failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    ok: true,
    path,
    url: signed.signedUrl,
    bytes: file.size,
    type: file.type,
  });
}
