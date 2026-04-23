import { createServiceRoleClient } from "@/lib/supabase/server";
import type { CharacterSheet, AestheticBible } from "@/lib/supabase/types";

export interface GalleryEntry {
  id: string;
  title: string;
  description: string | null;
  share_token: string;
  updated_at: string;
  thumb_url: string | null;
  video_url: string | null;
  author: string;
  visual_style: string | null;
  scene_count: number;
  like_count: number;
}

/**
 * Load the public gallery — every project with share_enabled=true
 * across all users. Used by /gallery and the dashboard/landing
 * strips to prove the app is a shared platform (not one person's
 * sketchpad).
 *
 * No auth required. Runs service-role since the rows we need already
 * opted themselves into the public view.
 */
export async function loadGallery({
  limit = 24,
  excludeUserId,
}: {
  limit?: number;
  /** Skip projects owned by this user (useful for dashboard strips). */
  excludeUserId?: string;
} = {}): Promise<GalleryEntry[]> {
  const admin = createServiceRoleClient();

  let q = admin
    .from("projects")
    .select(
      "id, user_id, title, description, character_sheet, aesthetic_bible, share_token, share_enabled, updated_at",
    )
    .eq("share_enabled", true)
    .not("share_token", "is", null)
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (excludeUserId) q = q.neq("user_id", excludeUserId);
  const { data: projects } = await q;

  const rows = projects ?? [];
  if (rows.length === 0) return [];

  // Fetch a thumbnail per project (latest complete still) + scene count
  // in two cheap parallel queries rather than N + 1.
  const projectIds = rows.map((p) => p.id);
  const [thumbsR, countsR, likesR] = await Promise.all([
    admin
      .from("clips")
      .select("project_id, still_image_url, video_url, status, still_status, order_index, created_at")
      .in("project_id", projectIds)
      .order("created_at", { ascending: false }),
    admin
      .from("clips")
      .select("project_id, id")
      .in("project_id", projectIds)
      .eq("status", "complete"),
    admin
      .from("gallery_likes")
      .select("project_id")
      .in("project_id", projectIds),
  ]);

  const likeCountByProject: Record<string, number> = {};
  for (const l of likesR.data ?? []) {
    if (!l.project_id) continue;
    likeCountByProject[l.project_id] =
      (likeCountByProject[l.project_id] ?? 0) + 1;
  }

  const thumbByProject: Record<string, { still: string | null; video: string | null }> =
    {};
  for (const c of thumbsR.data ?? []) {
    if (!c.project_id) continue;
    if (thumbByProject[c.project_id]) continue;
    thumbByProject[c.project_id] = {
      still:
        c.still_status === "complete" && c.still_image_url
          ? c.still_image_url
          : null,
      video: c.status === "complete" ? c.video_url : null,
    };
  }

  const countByProject: Record<string, number> = {};
  for (const c of countsR.data ?? []) {
    if (!c.project_id) continue;
    countByProject[c.project_id] = (countByProject[c.project_id] ?? 0) + 1;
  }

  return rows
    .filter((p): p is typeof p & { share_token: string } =>
      Boolean(p.share_token),
    )
    .map((p) => {
      const bible = (p.aesthetic_bible ?? {}) as AestheticBible;
      const sheet = (p.character_sheet ?? {}) as CharacterSheet;
      return {
        id: p.id,
        title: p.title,
        description: p.description,
        share_token: p.share_token as string,
        updated_at: p.updated_at,
        thumb_url: thumbByProject[p.id]?.still ?? null,
        video_url: thumbByProject[p.id]?.video ?? null,
        // We don't leak user email — show a derived author string.
        // If the project has a leading character, surface that; otherwise
        // a neutral "anonymous director".
        author: sheet.characters?.[0]?.name
          ? `featuring ${sheet.characters[0].name}`
          : "anonymous director",
        visual_style: bible.visual_style ?? null,
        scene_count: countByProject[p.id] ?? 0,
        like_count: likeCountByProject[p.id] ?? 0,
      };
    });
}
