import { env } from "@/lib/env";

/**
 * OpenAI image generation.
 *
 * Defaults to gpt-image-2 (successor to gpt-image-1). Preferred over
 * Replicate Flux when OPENAI_API_KEY is set. Returns a Blob ready to
 * upload straight to Supabase Storage, matching the stills endpoint's
 * contract with Flux.
 *
 * If gpt-image-2 is not available on the caller's OpenAI org (returns
 * model_not_found / invalid_request_error), we transparently retry
 * with gpt-image-1 so the user isn't stuck behind a rollout gate.
 *
 * Fallback model override: OPENAI_IMAGE_FALLBACK_MODEL (defaults to
 * gpt-image-1). Primary override: OPENAI_IMAGE_MODEL.
 */

export const OPENAI_IMAGE_MODEL =
  process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2";
export const OPENAI_IMAGE_FALLBACK_MODEL =
  process.env.OPENAI_IMAGE_FALLBACK_MODEL ?? "gpt-image-1";
export const OPENAI_IMAGE_QUALITY =
  (process.env.OPENAI_IMAGE_QUALITY ?? "medium") as "low" | "medium" | "high";

function openAiSize(aspect: string): "1024x1024" | "1024x1536" | "1536x1024" {
  if (aspect === "9:16" || aspect === "3:4") return "1024x1536";
  if (aspect === "16:9" || aspect === "4:3" || aspect === "21:9")
    return "1536x1024";
  return "1024x1024";
}

export function hasOpenAIImageKey(): boolean {
  try {
    return env.OPENAI_API_KEY.length > 0;
  } catch {
    return false;
  }
}

export interface GeneratedImage {
  blob: Blob;
  contentType: string;
  width: number;
  height: number;
  /** Model that actually produced the image (post-fallback). */
  model: string;
}

/**
 * Unwrap undici's "fetch failed" wrapper so the user sees the actual
 * network error instead of a useless one-liner. Works on both Node 20+
 * (Error.cause) and older transports.
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

async function callOpenAIImages({
  model,
  prompt,
  size,
  quality,
  signal,
}: {
  model: string;
  prompt: string;
  size: "1024x1024" | "1024x1536" | "1536x1024";
  quality: "low" | "medium" | "high";
  signal?: AbortSignal;
}): Promise<{ bytes: Uint8Array; model: string }> {
  let response: Response;
  try {
    response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, prompt, size, quality, n: 1 }),
      signal,
    });
  } catch (err) {
    throw new Error(`OpenAI image network error — ${describeFetchError(err)}`);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    // Body has a JSON `error.code` we can inspect for the fallback
    // decision. Don't explode on unparseable text.
    let code: string | null = null;
    try {
      const body = JSON.parse(text) as {
        error?: { code?: string; type?: string; message?: string };
      };
      code = body.error?.code ?? body.error?.type ?? null;
    } catch {
      /* keep raw text */
    }
    const err = new Error(
      `OpenAI image ${response.status} (${code ?? "unknown"}): ${text.slice(
        0,
        400,
      )}`,
    );
    (err as { code?: string }).code = code ?? undefined;
    (err as { status?: number }).status = response.status;
    throw err;
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };
  const entry = payload.data?.[0];
  if (!entry) throw new Error("OpenAI returned no image data.");

  if (entry.b64_json) {
    return {
      bytes: Uint8Array.from(atob(entry.b64_json), (c) => c.charCodeAt(0)),
      model,
    };
  }
  if (entry.url) {
    const imgRes = await fetch(entry.url);
    if (!imgRes.ok) throw new Error(`Fetch image: ${imgRes.status}`);
    return { bytes: new Uint8Array(await imgRes.arrayBuffer()), model };
  }
  throw new Error("OpenAI response missing image payload.");
}

/**
 * Is this error one where retrying with the fallback model would help?
 * Covers: model not found/available, 404s, invalid_model, and the
 * generic 400 cases OpenAI returns when a model slug is gated.
 */
function shouldFallbackModel(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const status = (err as { status?: number }).status;
  const code = (err as { code?: string }).code ?? "";
  if (status === 404) return true;
  if (status === 400 && /model/i.test(err.message)) return true;
  if (/model_not_found|invalid_request_error|model_not_available/i.test(code))
    return true;
  return false;
}

/**
 * Generate a still. Tries OPENAI_IMAGE_MODEL first, retries once with
 * OPENAI_IMAGE_FALLBACK_MODEL on a gated-model error, then returns.
 * Caller is expected to catch any remaining exception and fall through
 * to Flux.
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
  const size = draft ? ("1024x1024" as const) : openAiSize(aspect_ratio);
  const [w, h] = size.split("x").map(Number);
  const quality = draft ? "low" : OPENAI_IMAGE_QUALITY;

  let result: { bytes: Uint8Array; model: string };
  try {
    result = await callOpenAIImages({
      model: OPENAI_IMAGE_MODEL,
      prompt,
      size,
      quality,
      signal,
    });
  } catch (err) {
    if (
      OPENAI_IMAGE_FALLBACK_MODEL &&
      OPENAI_IMAGE_FALLBACK_MODEL !== OPENAI_IMAGE_MODEL &&
      shouldFallbackModel(err)
    ) {
      result = await callOpenAIImages({
        model: OPENAI_IMAGE_FALLBACK_MODEL,
        prompt,
        size,
        quality,
        signal,
      });
    } else {
      throw err;
    }
  }

  return {
    blob: new Blob([result.bytes.buffer as ArrayBuffer], { type: "image/png" }),
    contentType: "image/png",
    width: w,
    height: h,
    model: result.model,
  };
}
