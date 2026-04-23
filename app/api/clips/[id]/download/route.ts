import { type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

type Kind = "video" | "still" | "narration" | "last_frame";

/**
 * GET /api/clips/[id]/download?kind=video|still|narration|last_frame
 *
 * Streams the requested file with Content-Disposition: attachment so
 * mobile Safari — which ignores <a download> on cross-origin signed
 * URLs — actually saves the media instead of opening it inline.
 *
 * Streams through our server rather than redirecting to the signed URL
 * so the attachment header sticks (Safari respects our origin's header,
 * not Supabase's CDN response).
 */
export async function GET(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const kind = (new URL(request.url).searchParams.get("kind") ?? "video") as Kind;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return new Response("Not authorized", { status: 401 });
  }

  const { data: clip } = await supabase
    .from("clips")
    .select("id, project_id, order_index")
    .eq("id", id)
    .maybeSingle();
  if (!clip) return new Response("Not found", { status: 404 });

  const paths: Record<Kind, { path: string; filename: string; contentType: string }> = {
    video: {
      path: `${clip.project_id}/${clip.id}/video.mp4`,
      filename: `nysus-scene-${clip.order_index + 1}.mp4`,
      contentType: "video/mp4",
    },
    still: {
      path: `${clip.project_id}/stills/${clip.id}/image.png`,
      filename: `nysus-scene-${clip.order_index + 1}.png`,
      contentType: "image/png",
    },
    narration: {
      path: `${clip.project_id}/narration/${clip.id}.mp3`,
      filename: `nysus-scene-${clip.order_index + 1}.mp3`,
      contentType: "audio/mpeg",
    },
    last_frame: {
      path: `${clip.project_id}/${clip.id}/last.jpg`,
      filename: `nysus-scene-${clip.order_index + 1}-last-frame.jpg`,
      contentType: "image/jpeg",
    },
  };
  const target = paths[kind];
  if (!target) return new Response("Bad kind", { status: 400 });

  const admin = createServiceRoleClient();
  const { data: file, error } = await admin.storage
    .from("clips")
    .download(target.path);
  if (error || !file) {
    return new Response(error?.message ?? "Download failed", { status: 404 });
  }

  return new Response(file, {
    headers: {
      "Content-Type": target.contentType,
      "Content-Disposition": `attachment; filename="${target.filename}"`,
      "Cache-Control": "private, max-age=0, no-store",
    },
  });
}
