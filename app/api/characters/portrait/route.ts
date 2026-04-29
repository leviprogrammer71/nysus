import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated, normalizeEmail } from "@/lib/auth";
import {
  generateOpenAIImage,
  OPENAI_IMAGE_MODEL,
} from "@/lib/openai-images";
import {
  checkSpendCap,
  ESTIMATE_CENTS_PER_GENERATION,
  recordUsage,
} from "@/lib/budget";
import { awardEvent } from "@/lib/progress";
import type { CharacterSheet, AestheticBible } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// gpt-image-2 cold runs land in the 120-150s range. 300s gives us
// plenty of headroom past the 180s poll deadline in
// lib/openai-images.ts.
export const maxDuration = 300;

const bodySchema = z.object({
  project_id: z.string().uuid(),
  character_name: z.string().trim().min(1).max(120),
  /** Optional override prompt — otherwise composed from the sheet. */
  prompt: z.string().min(1).max(4000).optional(),
});

/**
 * POST /api/characters/portrait
 *
 * Generates a portrait reference sheet for the named character. This
 * is typically the FIRST image every project produces — Dio calls it
 * right after creating the character via update_character_sheet or
 * add_character, so downstream scene stills have a consistent face
 * to reference.
 *
 * The generated image is uploaded to {project}/portraits/<slug>.png
 * and appended to that character's reference_images list so every
 * subsequent chat turn sees it labeled ('<name> reference:').
 *
 * Uses Replicate's openai/gpt-image-2 as the single image provider.
 * REPLICATE_API_TOKEN must be set.
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

  const { data: project, error: projectErr } = await supabase
    .from("projects")
    .select("id, character_sheet, aesthetic_bible")
    .eq("id", body.project_id)
    .maybeSingle();
  if (projectErr || !project) {
    return NextResponse.json(
      { error: projectErr?.message ?? "Project not found" },
      { status: 404 },
    );
  }

  const admin = createServiceRoleClient();
  const gate = await checkSpendCap({
    admin,
    userId: user.id,
    email: user.email,
    estimateCents: ESTIMATE_CENTS_PER_GENERATION,
  });
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason, code: gate.code },
      { status: 429 },
    );
  }

  const sheet = (project.character_sheet ?? {}) as CharacterSheet;
  const bible = (project.aesthetic_bible ?? {}) as AestheticBible;
  const characters = sheet.characters ?? [];

  const nameLower = body.character_name.trim().toLowerCase();
  const charIdx = characters.findIndex(
    (c) => (c.name ?? "").trim().toLowerCase() === nameLower,
  );
  if (charIdx === -1) {
    return NextResponse.json(
      {
        error: `No character named '${body.character_name}'. Add the character first.`,
      },
      { status: 404 },
    );
  }
  const character = characters[charIdx];

  // --- Compose the portrait prompt -----------------------------------
  const prompt =
    body.prompt ??
    composePortraitPrompt(
      character.name ?? body.character_name,
      character,
      bible,
    );

  // --- Generate ------------------------------------------------------
  // Single provider: Replicate's openai/gpt-image-2. No Flux fallback.
  let imageBlob: Blob;
  let imageContentType: string;
  let modelSlug = OPENAI_IMAGE_MODEL;
  try {
    const img = await generateOpenAIImage({
      prompt,
      aspect_ratio: "3:4", // taller portrait framing
    });
    imageBlob = img.blob;
    imageContentType = img.contentType;
    modelSlug = img.model;
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    const cause = err instanceof Error
      ? ((err as { cause?: unknown }).cause as Error | undefined)
      : undefined;
    const causeMsg = cause
      ? `${(cause as { code?: string }).code ?? ""} ${cause.message ?? ""}`.trim()
      : "";
    const msg = causeMsg && rawMsg === "fetch failed"
      ? `Upstream unreachable — ${causeMsg}`
      : causeMsg
      ? `${rawMsg} (${causeMsg})`
      : rawMsg;
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // --- Upload to Storage + append to character.reference_images -----
  const slug = slugify(character.name ?? body.character_name);
  // gpt-image-2 returns jpg; never store webp so video models can use
  // this portrait directly as a seed.
  const ext = imageContentType.includes("png") ? "png" : "jpg";
  const finalContentType = ext === "png" ? "image/png" : "image/jpeg";
  const storagePath = `${project.id}/portraits/${slug}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from("clips")
    .upload(storagePath, imageBlob, {
      contentType: finalContentType,
      upsert: true,
    });
  if (uploadErr) {
    return NextResponse.json({ error: uploadErr.message }, { status: 500 });
  }

  const nextCharacters = [...characters];
  const existingRefs = nextCharacters[charIdx].reference_images ?? [];
  // Keep the portrait at index 0 so it's the canonical face reference.
  // Remove any prior copy of this exact path to keep the list clean.
  const filtered = existingRefs.filter((p) => p !== storagePath);
  nextCharacters[charIdx] = {
    ...nextCharacters[charIdx],
    reference_images: [storagePath, ...filtered].slice(0, 8),
  };
  const nextSheet: CharacterSheet = {
    ...sheet,
    characters: nextCharacters as CharacterSheet["characters"],
  };

  const { error: patchErr } = await supabase
    .from("projects")
    .update({ character_sheet: nextSheet })
    .eq("id", project.id);
  if (patchErr) {
    return NextResponse.json({ error: patchErr.message }, { status: 500 });
  }

  const { data: signed } = await admin.storage
    .from("clips")
    .createSignedUrl(storagePath, 60 * 60 * 6);

  void recordUsage({
    admin,
    userId: user.id,
    projectId: project.id,
    provider: "replicate",
    action: "generate",
    metadata: {
      kind: "character_portrait",
      character: character.name ?? body.character_name,
      model: modelSlug,
      image_provider: "replicate_openai_gpt_image_2",
    },
  });

  void awardEvent({
    admin,
    userId: user.id,
    kind: "character_portrait",
    meta: { project_id: project.id },
  });

  return NextResponse.json({
    ok: true,
    character_name: character.name ?? body.character_name,
    path: storagePath,
    preview_url: signed?.signedUrl ?? null,
    provider: "replicate",
    model: modelSlug,
  });
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "character";
}

/**
 * Compose a portrait prompt from the character's sheet + the project's
 * aesthetic bible. Concrete and long: portrait work needs specificity.
 */
function composePortraitPrompt(
  name: string,
  c: NonNullable<CharacterSheet["characters"]>[number],
  bible: AestheticBible,
): string {
  const parts: string[] = [];
  parts.push(`Character portrait reference sheet of ${name},`);
  if (c.age) parts.push(c.age + ",");
  if (c.ethnicity) parts.push(c.ethnicity + ",");
  if (c.appearance) parts.push(c.appearance + ",");
  if (c.wardrobe) parts.push("wearing " + c.wardrobe + ",");
  parts.push(
    "three-quarter portrait framing, neutral studio lighting, plain soft background,",
  );
  parts.push(
    "sharp focus on the face, accurate wardrobe detail, consistent face geometry,",
  );
  if (bible.visual_style) parts.push("style: " + bible.visual_style + ",");
  if (bible.palette) parts.push("palette: " + bible.palette + ",");
  parts.push(
    "photorealistic, cinematic film grain, 35mm, high detail, reference-quality.",
  );
  return parts.join(" ").replace(/\s+/g, " ").trim();
}

// Make normalizeEmail usage visible to TS (imported for side effect).
void normalizeEmail;
