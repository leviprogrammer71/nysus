import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { awardEvent } from "@/lib/progress";
import type { CharacterSheet, AestheticBible } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  /** Accepts the source's share_token or project_id (owner-only path). */
  source_token: z.string().min(6).max(64).optional(),
  source_project_id: z.string().uuid().optional(),
});

/**
 * POST /api/projects/remix
 *
 * Create a new project owned by the current user, seeded with the
 * source's character_sheet + aesthetic_bible. The source is anyone's
 * shared project (via share_token) or your own. Title becomes
 * "Remix of [original]" with a fresh description.
 *
 * Awards XP to both the remixer (remix_created) and the original
 * author (project_remixed).
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
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 },
    );
  }

  const admin = createServiceRoleClient();

  // Resolve the source project. By token if public, by id only if owner.
  let q = admin
    .from("projects")
    .select(
      "id, user_id, title, character_sheet, aesthetic_bible, share_enabled",
    );
  if (body.source_token) {
    q = q.eq("share_token", body.source_token).eq("share_enabled", true);
  } else if (body.source_project_id) {
    q = q.eq("id", body.source_project_id).eq("user_id", user.id);
  } else {
    return NextResponse.json(
      { error: "Provide source_token or source_project_id" },
      { status: 400 },
    );
  }

  const { data: source, error: srcErr } = await q.maybeSingle();
  if (srcErr) {
    return NextResponse.json({ error: srcErr.message }, { status: 500 });
  }
  if (!source) {
    return NextResponse.json(
      { error: "Source project not found or not shareable" },
      { status: 404 },
    );
  }

  // Insert the new project (owned by the remixer).
  const remixTitle = source.title.startsWith("Remix of ")
    ? source.title
    : `Remix of ${source.title}`;

  const { data: inserted, error: insertErr } = await supabase
    .from("projects")
    .insert({
      user_id: user.id,
      title: remixTitle,
      description: `Started from "${source.title}".`,
      // Deep-copy to avoid the Supabase client sharing jsonb objects.
      character_sheet: JSON.parse(
        JSON.stringify(source.character_sheet ?? {}),
      ) as CharacterSheet,
      aesthetic_bible: JSON.parse(
        JSON.stringify(source.aesthetic_bible ?? {}),
      ) as AestheticBible,
    })
    .select("id")
    .single();

  if (insertErr || !inserted) {
    return NextResponse.json(
      { error: insertErr?.message ?? "Remix failed" },
      { status: 500 },
    );
  }

  // XP hooks — remixer gets credit, original author gets credit when
  // someone other than themselves remixes. Best-effort, fire and forget.
  void awardEvent({
    admin,
    userId: user.id,
    kind: "remix_created",
    meta: { project_id: inserted.id },
  });
  if (source.user_id && source.user_id !== user.id) {
    void awardEvent({
      admin,
      userId: source.user_id,
      kind: "project_remixed",
      meta: { project_id: source.id },
    });
  }

  return NextResponse.json({
    ok: true,
    project_id: inserted.id,
    url: `/projects/${inserted.id}`,
  });
}
