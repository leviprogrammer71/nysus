import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import type { SeedSource } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Upload a chosen seed frame for a clip and set it as the clip's
 * `seed_image_url`. Used by the "change seed frame" action in
 * ClipDetailSheet for:
 *
 *   - `manual_frame`: a JPG extracted from a prior clip's video
 *   - `upload`:       a JPG the user picked from their filesystem
 *                     or pasted from the clipboard (iOS screenshots)
 *
 * Body: multipart form-data
 *   frame:  Blob  — the JPG/PNG to use as the seed
 *   source: "manual_frame" | "upload"
 *
 * If you want to clear the seed back to `none`, DELETE this endpoint.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { data: clip } = await supabase
    .from("clips")
    .select("id, project_id")
    .eq("id", id)
    .maybeSingle();
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const form = await request.formData();
  const frame = form.get("frame");
  const sourceRaw = form.get("source");
  if (!(frame instanceof Blob)) {
    return NextResponse.json({ error: "Missing `frame` blob" }, { status: 400 });
  }
  const source: SeedSource =
    sourceRaw === "manual_frame" || sourceRaw === "upload" ? sourceRaw : "upload";

  const admin = createServiceRoleClient();
  const path = `${clip.project_id}/${clip.id}/seed.jpg`;

  const { error: uploadError } = await admin.storage
    .from("clips")
    .upload(path, frame, { contentType: "image/jpeg", upsert: true });
  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: signed } = await admin.storage
    .from("clips")
    .createSignedUrl(path, 60 * 60 * 6);

  const seedUrl = signed?.signedUrl ?? null;

  const { error: updateError } = await supabase
    .from("clips")
    .update({ seed_image_url: seedUrl, seed_source: source })
    .eq("id", clip.id);
  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, seed_image_url: seedUrl, seed_source: source });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { error } = await supabase
    .from("clips")
    .update({ seed_image_url: null, seed_source: "none" })
    .eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
