import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import {
  addRefPath,
  countRefs,
  MAX_REFERENCES_PER_PROJECT,
  parseRefTarget,
} from "@/lib/references";
import type { CharacterSheet, AestheticBible } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
]);

/**
 * POST /api/references/upload
 *
 * multipart/form-data
 *   project_id:  uuid
 *   target:      "bible" | "character:<name>"
 *   file:        image blob
 *
 * Uploads the image into the clips bucket at {project_id}/ref/{uuid}.{ext}
 * and atomically patches the project's character_sheet or
 * aesthetic_bible JSONB so the path is now part of that target's
 * reference_images list. Returns the stored path + a 30-min signed
 * preview URL for the edit UI.
 *
 * The chat route reads these paths on every user turn, re-signs them,
 * and injects them as image_url parts on the current user message.
 * That's how the director "sees" them on the next prompt.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const form = await request.formData();
  const projectId = form.get("project_id");
  const target = parseRefTarget(form.get("target"));
  const file = form.get("file");

  if (typeof projectId !== "string") {
    return NextResponse.json({ error: "Missing project_id" }, { status: 400 });
  }
  if (!target) {
    return NextResponse.json(
      { error: "Invalid target (expected 'bible' or 'character:<name>')" },
      { status: 400 },
    );
  }
  if (!(file instanceof Blob)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large (max ${Math.round(MAX_BYTES / 1024 / 1024)}MB)` },
      { status: 413 },
    );
  }
  if (file.type && !ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: `Unsupported type: ${file.type}` },
      { status: 415 },
    );
  }

  // RLS-gated read of the project.
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, character_sheet, aesthetic_bible")
    .eq("id", projectId)
    .maybeSingle();
  if (projectError || !project) {
    return NextResponse.json(
      { error: projectError?.message ?? "Project not found" },
      { status: 404 },
    );
  }

  const currentSheet = (project.character_sheet ?? {}) as CharacterSheet;
  const currentBible = (project.aesthetic_bible ?? {}) as AestheticBible;

  if (countRefs(currentSheet, currentBible) >= MAX_REFERENCES_PER_PROJECT) {
    return NextResponse.json(
      {
        error: `Reference image cap reached (${MAX_REFERENCES_PER_PROJECT} per project). Remove one before adding another.`,
      },
      { status: 409 },
    );
  }

  // Write to storage via service role.
  const admin = createServiceRoleClient();
  const ext =
    file.type === "image/png"
      ? "png"
      : file.type === "image/webp"
      ? "webp"
      : file.type === "image/gif"
      ? "gif"
      : file.type === "image/heic" || file.type === "image/heif"
      ? "heic"
      : "jpg";
  const uuid = crypto.randomUUID();
  const path = `${project.id}/ref/${uuid}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from("clips")
    .upload(path, file, {
      contentType: file.type || "image/jpeg",
      upsert: false,
    });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  // Patch the JSONB to include the new path under the right slot.
  const { sheet: nextSheet, bible: nextBible, applied } = addRefPath(
    target,
    path,
    currentSheet,
    currentBible,
  );
  if (!applied) {
    // Character by that name not found. Roll back the upload so we
    // don't leave an orphan file.
    await admin.storage.from("clips").remove([path]).catch(() => {});
    return NextResponse.json(
      {
        error:
          target.kind === "character"
            ? `No character named '${target.name}' — add the character first.`
            : "Could not apply target.",
      },
      { status: 409 },
    );
  }

  const { error: patchErr } = await supabase
    .from("projects")
    .update({
      character_sheet: nextSheet,
      aesthetic_bible: nextBible,
    })
    .eq("id", project.id);
  if (patchErr) {
    await admin.storage.from("clips").remove([path]).catch(() => {});
    return NextResponse.json({ error: patchErr.message }, { status: 500 });
  }

  const { data: signed } = await admin.storage
    .from("clips")
    .createSignedUrl(path, 60 * 30);

  return NextResponse.json({
    ok: true,
    path,
    preview_url: signed?.signedUrl ?? null,
    bytes: file.size,
    type: file.type,
  });
}
