import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import { removeRefPath } from "@/lib/references";
import type { CharacterSheet, AestheticBible } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const deleteSchema = z.object({
  project_id: z.string().uuid(),
  path: z.string().min(1),
});

/**
 * DELETE /api/references
 *
 * body: { project_id, path }
 *
 * Removes the storage path from the project's character_sheet /
 * aesthetic_bible JSONB wherever it appears, and removes the file
 * from storage. Safe to call idempotently.
 */
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: z.infer<typeof deleteSchema>;
  try {
    body = deleteSchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid payload" },
      { status: 400 },
    );
  }

  // Belt + suspenders: the path must live under the project we own.
  if (!body.path.startsWith(`${body.project_id}/ref/`)) {
    return NextResponse.json(
      { error: "Path does not belong to this project." },
      { status: 400 },
    );
  }

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, character_sheet, aesthetic_bible")
    .eq("id", body.project_id)
    .maybeSingle();
  if (projectError || !project) {
    return NextResponse.json(
      { error: projectError?.message ?? "Project not found" },
      { status: 404 },
    );
  }

  const currentSheet = (project.character_sheet ?? {}) as CharacterSheet;
  const currentBible = (project.aesthetic_bible ?? {}) as AestheticBible;

  const { sheet, bible, found } = removeRefPath(
    body.path,
    currentSheet,
    currentBible,
  );

  if (found) {
    const { error: patchErr } = await supabase
      .from("projects")
      .update({
        character_sheet: sheet,
        aesthetic_bible: bible,
      })
      .eq("id", project.id);
    if (patchErr) {
      return NextResponse.json({ error: patchErr.message }, { status: 500 });
    }
  }

  // Remove the file regardless — it's either unreferenced now or was
  // already orphaned.
  const admin = createServiceRoleClient();
  await admin.storage.from("clips").remove([body.path]).catch(() => {});

  return NextResponse.json({ ok: true, was_in_jsonb: found });
}
