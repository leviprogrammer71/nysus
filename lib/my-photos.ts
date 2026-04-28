import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, CharacterSheet, AestheticBible } from "@/lib/supabase/types";

type SB = SupabaseClient<Database>;

export type PhotoKind =
  | "still"
  | "portrait"
  | "character_ref"
  | "bible_ref"
  | "video";

export interface MyPhoto {
  id: string;
  kind: PhotoKind;
  /** Storage path under the `clips` bucket — we sign on demand. */
  path: string;
  /** Pre-signed url for inline rendering (~6h). */
  signed_url: string | null;
  /** Project this photo belongs to. */
  project_id: string;
  project_title: string;
  /** Stable display label. */
  label: string;
  created_at: string;
  /**
   * The clip + character info needed for the delete buttons. Either
   * is set depending on `kind`.
   */
  clip_id?: string;
  character_name?: string;
  /** Index inside the character's reference_images list (so we can
   *  splice it out on delete). */
  ref_index?: number;
  /** Index inside the bible's reference_images list. */
  bible_index?: number;
}

/**
 * Aggregate every image (and short videos) the current user owns
 * across all their projects. Used by /my-photos.
 *
 * We don't have a single table of "all media"; we walk projects and
 * collect: clip stills, character reference_images, bible
 * reference_images, and video URLs.
 */
export async function loadMyPhotos({
  admin,
  userId,
  limit = 200,
}: {
  admin: SB;
  userId: string;
  limit?: number;
}): Promise<MyPhoto[]> {
  const { data: projects } = await admin
    .from("projects")
    .select(
      "id, title, character_sheet, aesthetic_bible, updated_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });
  const projectRows = projects ?? [];
  if (projectRows.length === 0) return [];

  const projectIds = projectRows.map((p) => p.id);
  const { data: clips } = await admin
    .from("clips")
    .select(
      "id, project_id, order_index, still_image_url, still_status, video_url, status, created_at",
    )
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  const projById = new Map(projectRows.map((p) => [p.id, p]));
  const out: MyPhoto[] = [];

  // 1. Stills (per clip)
  for (const c of clips ?? []) {
    const proj = projById.get(c.project_id);
    if (!proj) continue;
    if (c.still_image_url && c.still_status === "complete") {
      const path = `${c.project_id}/stills/${c.id}/image.jpg`;
      const { data: signed } = await admin.storage
        .from("clips")
        .createSignedUrl(path, 60 * 60 * 6);
      out.push({
        id: `still-${c.id}`,
        kind: "still",
        path,
        signed_url: signed?.signedUrl ?? c.still_image_url,
        project_id: c.project_id,
        project_title: proj.title,
        label: `Scene ${c.order_index + 1} still`,
        created_at: c.created_at,
        clip_id: c.id,
      });
    }
    if (c.video_url && c.status === "complete") {
      out.push({
        id: `video-${c.id}`,
        kind: "video",
        path: `${c.project_id}/${c.id}/video.mp4`,
        signed_url: c.video_url,
        project_id: c.project_id,
        project_title: proj.title,
        label: `Scene ${c.order_index + 1} clip`,
        created_at: c.created_at,
        clip_id: c.id,
      });
    }
  }

  // 2. Character portraits + character reference images
  for (const proj of projectRows) {
    const sheet = (proj.character_sheet ?? {}) as CharacterSheet;
    const characters = sheet.characters ?? [];
    for (const ch of characters) {
      const refs = ch.reference_images ?? [];
      for (let i = 0; i < refs.length; i++) {
        const path = refs[i];
        if (!path) continue;
        const { data: signed } = await admin.storage
          .from("clips")
          .createSignedUrl(path, 60 * 60 * 6);
        const isPortrait = path.includes("/portraits/");
        out.push({
          id: `ref-${proj.id}-${ch.name}-${i}`,
          kind: isPortrait ? "portrait" : "character_ref",
          path,
          signed_url: signed?.signedUrl ?? null,
          project_id: proj.id,
          project_title: proj.title,
          label: isPortrait
            ? `${ch.name ?? "Character"} portrait`
            : `${ch.name ?? "Character"} reference ${i + 1}`,
          created_at: proj.updated_at,
          character_name: ch.name,
          ref_index: i,
        });
      }
    }
  }

  // 3. Bible mood-board references
  for (const proj of projectRows) {
    const bible = (proj.aesthetic_bible ?? {}) as AestheticBible;
    const refs = bible.reference_images ?? [];
    for (let i = 0; i < refs.length; i++) {
      const path = refs[i];
      if (!path) continue;
      const { data: signed } = await admin.storage
        .from("clips")
        .createSignedUrl(path, 60 * 60 * 6);
      out.push({
        id: `bible-${proj.id}-${i}`,
        kind: "bible_ref",
        path,
        signed_url: signed?.signedUrl ?? null,
        project_id: proj.id,
        project_title: proj.title,
        label: `Aesthetic ref ${i + 1}`,
        created_at: proj.updated_at,
        bible_index: i,
      });
    }
  }

  // Sort: most recent first, capped.
  out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return out.slice(0, limit);
}
