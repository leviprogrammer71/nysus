import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024; // 12MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

/**
 * POST /api/playground/attach
 *
 * Project-less variant of /api/chat/attach for the threshold (the
 * Playground). Uploads a source image under
 *   playground/{user_id}/inputs/{rand}.{ext}
 * and returns a 30-minute signed URL the user can pass to
 * /api/playground/generate as source_image_url.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const form = await request.formData();
  const file = form.get("file");
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
  const rand = crypto.randomUUID();
  const path = `playground/${user.id}/inputs/${rand}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from("clips")
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const { data: signed, error: signErr } = await admin.storage
    .from("clips")
    .createSignedUrl(path, 60 * 30);
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
