import { createPrediction, fetchReplicateOutputAsBlob, getPrediction } from "@/lib/replicate";

/**
 * Image generation via Replicate (openai/gpt-image-2).
 *
 * We route the image call through Replicate — not the OpenAI direct
 * API — because Replicate hosts `openai/gpt-image-2` with a stable
 * surface, billing, and regional access that "just works" once
 * REPLICATE_API_TOKEN is set. No Flux, no fallback chain.
 *
 * Model override: OPENAI_IMAGE_MODEL env (e.g. "openai/gpt-image-1" to
 * pin to the older model). Default is the current one.
 */

export const OPENAI_IMAGE_MODEL =
  process.env.OPENAI_IMAGE_MODEL ?? "openai/gpt-image-2";
export const OPENAI_IMAGE_QUALITY =
  (process.env.OPENAI_IMAGE_QUALITY ?? "high") as "low" | "medium" | "high";

/**
 * Map shot aspect_ratio → the gpt-image-2 native size bucket.
 * openai/gpt-image-2 accepts { 1024x1024, 1024x1536, 1536x1024 }.
 */
function gptImageSize(aspect: string): "1024x1024" | "1024x1536" | "1536x1024" {
  if (aspect === "9:16" || aspect === "3:4") return "1024x1536";
  if (aspect === "16:9" || aspect === "4:3" || aspect === "21:9")
    return "1536x1024";
  return "1024x1024";
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

/**
 * Unwrap undici's "fetch failed" so the caller sees the real network
 * error cause, and collapse a few common Replicate failure shapes
 * into a single string.
 */
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
 * openai/gpt-image-2, poll, download the produced image.
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
  const size = draft ? ("1024x1024" as const) : gptImageSize(aspect_ratio);
  const [w, h] = size.split("x").map(Number);
  const quality = draft ? "low" : OPENAI_IMAGE_QUALITY;

  let prediction;
  try {
    prediction = await createPrediction({
      model: OPENAI_IMAGE_MODEL,
      input: {
        prompt,
        // gpt-image-2 on Replicate accepts the native OpenAI shape.
        // Keep the payload minimal + future-proof — unknown fields are
        // rejected by strict schemas but OpenAI's endpoint ignores
        // them.
        size,
        quality,
        output_format: "png",
        n: 1,
      },
    });
  } catch (err) {
    throw new Error(`gpt-image-2 create prediction — ${describeFetchError(err)}`);
  }

  // Poll up to 60s. gpt-image-2 on "high" typically settles in 15-25s.
  const deadline = Date.now() + 60_000;
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
  return {
    blob,
    contentType,
    width: w,
    height: h,
    model: OPENAI_IMAGE_MODEL,
  };
}
