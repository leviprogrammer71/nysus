import { createPrediction, fetchReplicateOutputAsBlob, getPrediction } from "@/lib/replicate";

/**
 * Image generation via Replicate (openai/gpt-image-2).
 *
 * We route through Replicate — not the OpenAI direct API — because
 * Replicate hosts `openai/gpt-image-2` with a stable surface, billing,
 * and regional access that "just works" once REPLICATE_API_TOKEN is set.
 *
 * The input shape here matches Replicate's schema for this model, NOT
 * OpenAI's native /v1/images/generations shape. Specifically:
 *   - aspect_ratio  ("1:1" | "3:2" | "2:3"), not `size` (e.g. "1024x1536")
 *   - number_of_images, not `n`
 *   - quality:  "auto" | "low" | "medium" | "high"
 *   - output_format: "png" | "jpg" | "webp"
 *
 * Model override: OPENAI_IMAGE_MODEL. Default is the pinned version
 * slug from `npx create-replicate --model=openai/gpt-image-2` so we
 * don't drift if Replicate rolls a new head.
 */

// Pinned version hash from `npx create-replicate --model=openai/gpt-image-2`
// Override with OPENAI_IMAGE_MODEL env (e.g. "openai/gpt-image-2" to
// follow the latest version, or a different pinned SHA).
export const OPENAI_IMAGE_MODEL =
  process.env.OPENAI_IMAGE_MODEL ??
  "openai/gpt-image-2:875d2396848b8447d556115adaa81d4d0508d03a0b61c9d51da0d069efd00c35";

export const OPENAI_IMAGE_QUALITY =
  (process.env.OPENAI_IMAGE_QUALITY ?? "high") as
    | "auto"
    | "low"
    | "medium"
    | "high";

/**
 * Normalize the app's aspect_ratio values to ones gpt-image-2 accepts.
 * Replicate's gpt-image-2 currently only accepts: "1:1", "3:2", "2:3".
 * Map everything else to the closest match.
 */
function gptImageAspect(aspect: string): string {
  // Direct pass-through for the three accepted values.
  const supported = new Set(["1:1", "3:2", "2:3"]);
  if (supported.has(aspect)) return aspect;

  // Map common app ratios to the nearest accepted bucket.
  // Portrait-ish (taller than wide) → "2:3"
  // Landscape-ish (wider than tall)  → "3:2"
  // Square                           → "1:1"
  const portraitLike = new Set(["9:16", "3:4", "4:5"]);
  const landscapeLike = new Set(["16:9", "4:3", "5:4", "21:9"]);
  if (portraitLike.has(aspect)) return "2:3";
  if (landscapeLike.has(aspect)) return "3:2";

  // Fallback: parse the ratio and pick based on orientation.
  const [a, b] = aspect.split(":").map(Number);
  if (a && b) {
    if (a === b) return "1:1";
    return a < b ? "2:3" : "3:2";
  }
  return "2:3"; // app default is portrait
}

export function hasOpenAIImageKey(): boolean {
  // Kept for API compatibility with the rest of the codebase. The
  // Replicate route only requires REPLICATE_API_TOKEN.
  return Boolean((process.env.REPLICATE_API_TOKEN ?? "").trim());
}

export interface GeneratedImage {
  blob: Blob;
  contentType: string;
  width: number;
  height: number;
  model: string;
}

function describeFetchError(err: unknown): string {
  if (!(err instanceof Error)) return String(err);
  const cause = (err as { cause?: unknown }).cause;
  if (cause instanceof Error) {
    const code = (cause as { code?: string }).code;
    return `${err.message}: ${code ? `${code} · ` : ""}${cause.message}`;
  }
  return err.message;
}

/**
 * Generate a still. Single path: create a Replicate prediction on
 * openai/gpt-image-2 with the model's native input shape, poll,
 * download the produced image.
 */
export async function generateOpenAIImage({
  prompt,
  aspect_ratio,
  signal,
  draft = false,
}: {
  prompt: string;
  aspect_ratio: string;
  signal?: AbortSignal;
  draft?: boolean;
}): Promise<GeneratedImage> {
  const ratio = draft ? "1:1" : gptImageAspect(aspect_ratio);
  const quality = draft ? "low" : OPENAI_IMAGE_QUALITY;

  let prediction;
  try {
    prediction = await createPrediction({
      model: OPENAI_IMAGE_MODEL,
      // Hold the request open up to 60s — gpt-image-2 frequently
      // finishes inside that window and we skip the poll entirely.
      preferWaitSeconds: 60,
      input: {
        prompt,
        aspect_ratio: ratio,
        quality,
        background: "auto",
        moderation: "auto",
        // Replicate's gpt-image-2 schema accepts "png" | "jpeg" | "webp".
        // We use "jpeg" so Seedance + Kling don't reject the still
        // downstream (they refuse webp).
        output_format: "jpeg",
        number_of_images: 1,
        output_compression: 90,
      },
    });
  } catch (err) {
    throw new Error(
      `gpt-image-2 create prediction — ${describeFetchError(err)}`,
    );
  }

  // Poll up to 90s. gpt-image-2 on "high" typically settles in 15-30s
  // but a cold GPU can push past a minute.
  const deadline = Date.now() + 90_000;
  let final = prediction;
  while (
    (final.status === "starting" || final.status === "processing") &&
    Date.now() < deadline
  ) {
    if (signal?.aborted) throw new Error("Aborted");
    await new Promise((r) => setTimeout(r, 1500));
    try {
      final = await getPrediction(prediction.id);
    } catch (err) {
      throw new Error(`gpt-image-2 poll — ${describeFetchError(err)}`);
    }
  }

  if (final.status !== "succeeded") {
    const err = String(final.error ?? `gpt-image-2 ${final.status}`);
    throw new Error(err);
  }

  const output = final.output;
  const outputUrl =
    typeof output === "string"
      ? output
      : Array.isArray(output) && typeof output[0] === "string"
      ? (output[0] as string)
      : null;
  if (!outputUrl) {
    throw new Error(
      `gpt-image-2 returned no image URL: ${JSON.stringify(output).slice(0, 400)}`,
    );
  }

  const { blob, contentType } = await fetchReplicateOutputAsBlob(outputUrl);

  // Rough width/height based on the requested ratio at 1024 long-edge.
  const { width, height } = aspectToWH(ratio);
  return { blob, contentType, width, height, model: OPENAI_IMAGE_MODEL };
}

function aspectToWH(r: string): { width: number; height: number } {
  const [a, b] = r.split(":").map(Number);
  if (!a || !b) return { width: 1024, height: 1024 };
  if (a >= b) return { width: 1536, height: Math.round((1536 * b) / a) };
  return { width: Math.round((1536 * a) / b), height: 1536 };
}
