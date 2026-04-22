import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Accept extracted frames from the client and store them in the
 * `clips` bucket. Expects multipart/form-data with:
 *
 *   last:       jpg blob (final frame — used to seed the next shot)
 *   sample_0:   jpg blob (~1s in)
 *   sample_1:   jpg blob (~mid)
 *   sample_2:   jpg blob (end — same as `last`, or slightly earlier)
 *
 * The client extracts these with FFmpeg.wasm the first time the clip
 * is opened after completion. Frames are stored silently and NEVER
 * sent to Claude unless the user taps "Consult the chorus".
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { data: clip } = await supabase
    .from("clips")
    .select("id, project_id, status, last_frame_url, sampled_frames_urls")
    .eq("id", id)
    .maybeSingle();
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (clip.status !== "complete") {
    return NextResponse.json({ error: "Clip not complete" }, { status: 400 });
  }

  // If we already have frames, don't reupload — idempotent.
  if (clip.last_frame_url && clip.sampled_frames_urls.length === 3) {
    return NextResponse.json({ ok: true, note: "already uploaded" });
  }

  const form = await request.formData();
  const files = {
    last: form.get("last"),
    sample_0: form.get("sample_0"),
    sample_1: form.get("sample_1"),
    sample_2: form.get("sample_2"),
  };

  const admin = createServiceRoleClient();
  const uploads: Record<string, string> = {};
  const sampledSigned: string[] = [];

  for (const [key, value] of Object.entries(files)) {
    if (!(value instanceof Blob)) {
      return NextResponse.json(
        { error: `Missing field: ${key}` },
        { status: 400 },
      );
    }
    const path =
      key === "last"
        ? `${clip.project_id}/${clip.id}/last.jpg`
        : `${clip.project_id}/${clip.id}/${key}.jpg`;

    const { error } = await admin.storage
      .from("clips")
      .upload(path, value, { contentType: "image/jpeg", upsert: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    uploads[key] = path;

    // For the sampled_frames_urls column we store signed URLs (valid
    // ~1h). They'll be re-signed on demand if the user asks the chorus.
    if (key.startsWith("sample_")) {
      const { data } = await admin.storage
        .from("clips")
        .createSignedUrl(path, 60 * 60);
      if (data?.signedUrl) sampledSigned.push(data.signedUrl);
    }
  }

  // Sign the last-frame URL too so the workspace can use it as the
  // default seed on the next Generate.
  const { data: lastSigned } = await admin.storage
    .from("clips")
    .createSignedUrl(uploads.last, 60 * 60 * 6);

  await supabase
    .from("clips")
    .update({
      last_frame_url: lastSigned?.signedUrl ?? null,
      sampled_frames_urls: sampledSigned,
    })
    .eq("id", clip.id);

  return NextResponse.json({
    ok: true,
    last_frame_url: lastSigned?.signedUrl ?? null,
    sampled_frames_urls: sampledSigned,
  });
}
