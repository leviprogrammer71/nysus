import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import type {
  CharacterSheet,
  AestheticBible,
} from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  kind: z.enum(["still", "portrait", "character_ref", "bible_ref", "video"]),
  project_id: z.string().uuid(),
  clip_id: z.string().uuid().optional(),
  character_name: z.string().optional(),
  ref_index: z.number().int().min(0).optional(),
  bible_index: z.number().int().min(0).optional(),
  path: z.string(),
});

/**
 * POST /api/photos/delete
 *
 * Removes a single media item: deletes the storage object AND detaches
 * it from the row that referenced it (clip still, character ref,
 * bible ref). Project is verified for ownership via RLS through the
 * authenticated supabase client; the storage delete uses service role.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid payload" },
      { status: 400 },
    );
  }

  // Ownership check via RLS — any project read here proves access.
  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("id, character_sheet, aesthetic_bible")
    .eq("id", body.project_id)
    .maybeSingle();
  if (projectErr) {
    return NextResponse.json({ error: projectErr.message }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // Storage path must live under this project's prefix; otherwise we
  // refuse — protects from path-injection from a tampered client.
  if (!body.path.startsWith(`${project.id}/`)) {
    return NextResponse.json(
      { error: "Path doesn't belong to this project." },
      { status: 400 },
    );
  }

  const admin = createServiceRoleClient();

  // Detach references first so the UI sees the row update even if the
  // storage delete is delayed.
  if (body.kind === "character_ref" || body.kind === "portrait") {
    if (!body.character_name || body.ref_index === undefined) {
      return NextResponse.json(
        { error: "character_name + ref_index required" },
        { status: 400 },
      );
    }
    const sheet = (project.character_sheet ?? {}) as CharacterSheet;
    const chars = sheet.characters ?? [];
    const lower = body.character_name.toLowerCase();
    const idx = chars.findIndex(
      (c) => (c.name ?? "").toLowerCase() === lower,
    );
    if (idx >= 0) {
      const refs = (chars[idx].reference_images ?? []).slice();
      if (body.ref_index < refs.length && refs[body.ref_index] === body.path) {
        refs.splice(body.ref_index, 1);
        chars[idx] = { ...chars[idx], reference_images: refs };
        await supabase
          .from("projects")
          .update({
            character_sheet: { ...sheet, characters: chars } as CharacterSheet,
          })
          .eq("id", project.id);
      }
    }
  } else if (body.kind === "bible_ref") {
    if (body.bible_index === undefined) {
      return NextResponse.json({ error: "bible_index required" }, { status: 400 });
    }
    const bible = (project.aesthetic_bible ?? {}) as AestheticBible;
    const refs = (bible.reference_images ?? []).slice();
    if (body.bible_index < refs.length && refs[body.bible_index] === body.path) {
      refs.splice(body.bible_index, 1);
      await supabase
        .from("projects")
        .update({
          aesthetic_bible: { ...bible, reference_images: refs } as AestheticBible,
        })
        .eq("id", project.id);
    }
  } else if (body.kind === "still") {
    if (!body.clip_id) {
      return NextResponse.json({ error: "clip_id required" }, { status: 400 });
    }
    await admin
      .from("clips")
      .update({
        still_image_url: null,
        still_status: "none",
        seed_image_url: null,
      })
      .eq("id", body.clip_id);
  } else if (body.kind === "video") {
    if (!body.clip_id) {
      return NextResponse.json({ error: "clip_id required" }, { status: 400 });
    }
    await admin
      .from("clips")
      .update({
        video_url: null,
        last_frame_url: null,
        sampled_frames_urls: [],
        status: "queued",
      })
      .eq("id", body.clip_id);
  }

  // Now delete the storage object. Best-effort — if the object is
  // already gone, the row update above is what mattered.
  await admin.storage.from("clips").remove([body.path]);

  return NextResponse.json({ ok: true });
}
