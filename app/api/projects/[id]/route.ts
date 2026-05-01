import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import type { CharacterSheet, AestheticBible } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    description: z
      .string()
      .trim()
      .max(2000)
      .optional()
      .transform((v) => (v === undefined ? undefined : v.length > 0 ? v : null)),
    character_sheet: z.unknown().optional(),
    aesthetic_bible: z.unknown().optional(),
    draft_mode: z.boolean().optional(),
    current_stage: z
      .enum(["concept", "script", "scenes", "image", "animate", "stitch"])
      .optional(),
  })
  .refine((v) => Object.keys(v).length > 0, {
    message: "No fields to update",
  });

/**
 * GET /api/projects/[id] — returns a narrow project row for UI
 * toggles (draft mode, share state). RLS-gated so only the owner
 * can read.
 */
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("projects")
    .select("id, title, description, draft_mode, share_token, share_enabled, current_stage, updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

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

  // Build a narrow update payload — the Supabase type needs a
  // concrete `Projects.Update` shape, not Record<string, unknown>.
  const update: {
    title?: string;
    description?: string | null;
    character_sheet?: CharacterSheet;
    aesthetic_bible?: AestheticBible;
    draft_mode?: boolean;
    current_stage?:
      | "concept"
      | "script"
      | "scenes"
      | "image"
      | "animate"
      | "stitch";
  } = {};
  if (body.title !== undefined) update.title = body.title;
  if (body.description !== undefined) update.description = body.description;
  if (body.character_sheet !== undefined)
    update.character_sheet = body.character_sheet as CharacterSheet;
  if (body.aesthetic_bible !== undefined)
    update.aesthetic_bible = body.aesthetic_bible as AestheticBible;
  if (body.draft_mode !== undefined) update.draft_mode = body.draft_mode;
  if (body.current_stage !== undefined)
    update.current_stage = body.current_stage;

  const { data, error } = await supabase
    .from("projects")
    .update(update)
    .eq("id", id)
    .select("id")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ ok: true });
}
