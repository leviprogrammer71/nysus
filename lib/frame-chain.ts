import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type SB = SupabaseClient<Database>;

/**
 * Frame chaining: when a scene is animated with seed_source='auto' and
 * the user hasn't explicitly provided a seed, use the final frame of
 * the previous scene (ordered by order_index). That single trick is the
 * biggest lever we have for coherence across a chained sequence — the
 * character's pose/lighting/composition on frame 1 of clip N matches
 * frame N of clip N-1.
 *
 * Signed URLs on last_frame_url expire (~6h) so we always re-sign from
 * the known storage convention: {project_id}/{clip_id}/last.jpg.
 */
export async function resolvePriorLastFrame({
  admin,
  projectId,
  currentOrderIndex,
  ttlSeconds = 60 * 60 * 6,
}: {
  admin: SB;
  projectId: string;
  currentOrderIndex: number;
  ttlSeconds?: number;
}): Promise<string | null> {
  if (currentOrderIndex <= 0) return null;

  const { data: prior } = await admin
    .from("clips")
    .select("id, last_frame_url")
    .eq("project_id", projectId)
    .eq("order_index", currentOrderIndex - 1)
    .maybeSingle();

  if (!prior || !prior.last_frame_url) return null;

  const path = `${projectId}/${prior.id}/last.jpg`;
  const { data: signed } = await admin.storage
    .from("clips")
    .createSignedUrl(path, ttlSeconds);

  // Fall back to the stored URL if re-signing fails (storage object
  // might have been deleted manually; at least give the caller *something*).
  return signed?.signedUrl ?? prior.last_frame_url;
}
