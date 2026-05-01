import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { refreshClipFromReplicate } from "@/lib/clips";
import { cancelPrediction } from "@/lib/replicate";
import type { SceneBibleOverrides } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

/**
 * PATCH /api/clips/[id] — narrow scene-level edits the user makes from
 * Mae's tabbed scene cards. Currently supports updating bible_overrides
 * (Notes tab) — extend cautiously, since /api/chat is the canonical
 * surface for prompt edits.
 */
const patchSchema = z
  .object({
    bible_overrides: z
      .object({
        disable_character_ids: z.array(z.string()).optional(),
        disable_style: z.boolean().optional(),
        notes: z.string().max(2000).optional(),
      })
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: z.infer<typeof patchSchema>;
  try {
    body = patchSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid payload" },
      { status: 400 },
    );
  }

  const update: { bible_overrides?: SceneBibleOverrides } = {};
  if (body.bible_overrides) {
    const o: SceneBibleOverrides = {};
    if (body.bible_overrides.disable_character_ids) {
      const ids = body.bible_overrides.disable_character_ids
        .map((s) => s.trim())
        .filter(Boolean);
      if (ids.length > 0) o.disable_character_ids = ids;
    }
    if (typeof body.bible_overrides.disable_style === "boolean") {
      o.disable_style = body.bible_overrides.disable_style;
    }
    if (body.bible_overrides.notes !== undefined) {
      const n = body.bible_overrides.notes.trim();
      if (n.length > 0) o.notes = n;
    }
    update.bible_overrides = o;
  }

  const { data, error } = await supabase
    .from("clips")
    .update(update)
    .eq("id", id)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const { data: clip } = await supabase
    .from("clips")
    .select("id, project_id, status, replicate_prediction_id")
    .eq("id", id)
    .maybeSingle();
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Cancel in-flight Replicate prediction so we don't burn credits on
  // a clip we're about to throw away.
  if (
    clip.replicate_prediction_id &&
    (clip.status === "queued" || clip.status === "processing")
  ) {
    try {
      await cancelPrediction(clip.replicate_prediction_id);
    } catch {
      // best-effort cancel; proceed with delete
    }
  }

  // Remove stored media from the bucket (best-effort).
  const admin = createServiceRoleClient();
  try {
    const prefix = `${clip.project_id}/${clip.id}/`;
    const { data: files } = await admin.storage.from("clips").list(prefix);
    if (files && files.length > 0) {
      await admin.storage
        .from("clips")
        .remove(files.map((f) => `${prefix}${f.name}`));
    }
  } catch {
    // keep going — row delete is the important part
  }

  const { error } = await supabase.from("clips").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}

/**
 * Client-side poll endpoint. Returns the current clip row (RLS-gated
 * via the authenticated user) and, if the clip is still pending,
 * proactively refreshes its status from Replicate. This makes dev
 * without a webhook tunnel "just work" — every poll may push the
 * clip one step forward.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  // Fetch via the RLS'd client first to enforce ownership.
  const { data: clip, error } = await supabase
    .from("clips")
    .select(
      "id, project_id, order_index, prompt, status, seed_image_url, seed_source, video_url, last_frame_url, sampled_frames_urls, replicate_prediction_id, error_message, bible_overrides, created_at, shot_metadata, still_image_url, still_prompt, still_status, still_replicate_prediction_id, narration",
    )
    .eq("id", id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // If pending, proactively refresh from Replicate using the service
  // role (so even if the webhook hasn't fired, the client's next poll
  // picks up the final state).
  if (
    (clip.status === "queued" || clip.status === "processing") &&
    clip.replicate_prediction_id
  ) {
    try {
      const admin = createServiceRoleClient();
      await refreshClipFromReplicate({ admin, clipId: clip.id });
      const { data: refreshed } = await supabase
        .from("clips")
        .select(
          "id, project_id, order_index, prompt, status, seed_image_url, seed_source, video_url, last_frame_url, sampled_frames_urls, replicate_prediction_id, error_message, bible_overrides, created_at, shot_metadata, still_image_url, still_prompt, still_status, still_replicate_prediction_id, narration",
        )
        .eq("id", id)
        .single();
      if (refreshed) return NextResponse.json(refreshed);
    } catch {
      // Swallow — return the stale clip and let the next poll retry.
    }
  }

  return NextResponse.json(clip);
}
