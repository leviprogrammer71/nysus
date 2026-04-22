import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * Sign a short-lived URL for the clip's video (or a frame).
 *
 * Query:
 *   kind = "video" (default) | "last_frame" | "sampled_0..2"
 *
 * Bucket `clips` is private, so we re-sign on demand rather than
 * storing public URLs that would leak access if someone got the row.
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const kind = (new URL(request.url).searchParams.get("kind") ?? "video") as
    | "video"
    | "still"
    | "last_frame"
    | "sampled_0"
    | "sampled_1"
    | "sampled_2";

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { data: clip } = await supabase
    .from("clips")
    .select("id, project_id, status")
    .eq("id", id)
    .maybeSingle();

  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const admin = createServiceRoleClient();

  const path =
    kind === "video"
      ? `${clip.project_id}/${clip.id}/video.mp4`
      : kind === "still"
      ? `${clip.project_id}/stills/${clip.id}/image.png`
      : kind === "last_frame"
      ? `${clip.project_id}/${clip.id}/last.jpg`
      : kind === "sampled_0"
      ? `${clip.project_id}/${clip.id}/sample_0.jpg`
      : kind === "sampled_1"
      ? `${clip.project_id}/${clip.id}/sample_1.jpg`
      : `${clip.project_id}/${clip.id}/sample_2.jpg`;

  const { data, error } = await admin.storage
    .from("clips")
    .createSignedUrl(path, 60 * 60); // 1 hour

  if (error || !data) {
    return NextResponse.json(
      { error: error?.message ?? "Sign failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ url: data.signedUrl, expires_in: 3600 });
}
