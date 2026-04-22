import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated, normalizeEmail } from "@/lib/auth";
import {
  createPrediction,
  fetchReplicateOutputAsBlob,
  getPrediction,
} from "@/lib/replicate";
import { fluxInputSchema, FLUX_MODEL } from "@/lib/flux";
import {
  generateOpenAIImage,
  hasOpenAIImageKey,
  OPENAI_IMAGE_MODEL,
} from "@/lib/openai-images";
import {
  checkSpendCap,
  ESTIMATE_CENTS_PER_GENERATION,
  recordUsage,
} from "@/lib/budget";
import type { CharacterSheet, AestheticBible } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
 * Uses OpenAI gpt-image-1 when OPENAI_API_KEY is set, falls back to
 * Replicate Flux.
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
  const useOpenAI = hasOpenAIImageKey();
  const provider: "openai" | "flux" = useOpenAI ? "openai" : "flux";
  const modelSlug = useOpenAI ? OPENAI_IMAGE_MODEL : FLUX_MODEL;

  let imageBlob: Blob;
  let imageContentType: string;
  let predictionId: string | null = null;

  try {
    if (useOpenAI) {
      const img = await generateOpenAIImage({
        prompt,
        aspect_ratio: "3:4", // taller portrait framing
      });
      imageBlob = img.blob;
      imageContentType = img.contentType;
    } else {
      const prediction = await createPrediction({
        model: FLUX_MODEL,
        input: fluxInputSchema.parse({
          prompt,
          aspect_ratio: "3:4",
        }),
      });
      predictionId = prediction.id;

      const deadline = Date.now() + 45_000;
      let final = prediction;
      while (
        (final.status === "starting" || final.status === "processing") &&
        Date.now() < deadline
      ) {
        await new Promise((r) => setTimeout(r, 1500));
        final = await getPrediction(prediction.id);
      }
      if (final.status !== "succeeded") {
        throw new Error(String(final.error ?? `Flux ${final.status}`));
      }
      const output = final.output;
      const outputUrl =
        typeof output === "string"
          ? output
          : Array.isArray(output) && typeof output[0] === "string"
          ? (output[0] as string)
          : null;
      if (!outputUrl) throw new Error("Flux returned no image URL");
      const fetched = await fetchReplicateOutputAsBlob(outputUrl);
      imageBlob = fetched.blob;
      imageContentType = fetched.contentType;
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // --- Upload to Storage + append to character.reference_images -----
  const slug = slugify(character.name ?? body.character_name);
  const ext = imageContentType.includes("jpeg") ? "jpg" : "png";
  const storagePath = `${project.id}/portraits/${slug}.${ext}`;

  const { error: uploadErr } = await admin.storage
    .from("clips")
    .upload(storagePath, imageBlob, {
      contentType: imageContentType,
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
    provider: provider === "openai" ? "openai" : "replicate",
    action: "generate",
    metadata: {
      kind: "character_portrait",
      character: character.name ?? body.character_name,
      model: modelSlug,
      prediction_id: predictionId,
    },
  });

  return NextResponse.json({
    ok: true,
    character_name: character.name ?? body.character_name,
    path: storagePath,
    preview_url: signed?.signedUrl ?? null,
    provider,
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
