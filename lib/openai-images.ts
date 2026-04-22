import { env } from "@/lib/env";

/**
 * OpenAI image generation (gpt-image-1).
 *
 * Preferred over Replicate Flux when OPENAI_API_KEY is set. Returns
 * a Blob ready to upload straight to Supabase Storage, matching the
 * stills endpoint's contract with Flux.
 *
 * gpt-image-1 pricing (Oct 2024):
 *   low quality     ~$0.01–0.02 / image
 *   medium quality  ~$0.04 / image (default)
 *   high quality    ~$0.17 / image
 */

export const OPENAI_IMAGE_MODEL =
  process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
export const OPENAI_IMAGE_QUALITY =
  (process.env.OPENAI_IMAGE_QUALITY ?? "medium") as "low" | "medium" | "high";

/** gpt-image-1 only accepts these sizes. Maps from shot aspect_ratio. */
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
}

/**
 * Generate a still with gpt-image-1. Returns a PNG Blob.
 * Throws on API error; caller should fall back to Flux if desired.
 */
export async function generateOpenAIImage({
  prompt,
  aspect_ratio,
  signal,
}: {
  prompt: string;
  aspect_ratio: string;
  signal?: AbortSignal;
}): Promise<GeneratedImage> {
  const size = openAiSize(aspect_ratio);
  const [w, h] = size.split("x").map(Number);

  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_IMAGE_MODEL,
      prompt,
      size,
      quality: OPENAI_IMAGE_QUALITY,
      n: 1,
    }),
    signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `OpenAI image ${response.status}: ${text.slice(0, 500)}`,
    );
  }

  const payload = (await response.json()) as {
    data?: Array<{ b64_json?: string; url?: string }>;
  };

  const entry = payload.data?.[0];
  if (!entry) throw new Error("OpenAI returned no image data.");

  let bytes: Uint8Array;
  if (entry.b64_json) {
    bytes = Uint8Array.from(atob(entry.b64_json), (c) => c.charCodeAt(0));
  } else if (entry.url) {
    // gpt-image-1 may return URLs depending on the account tier.
    const imgRes = await fetch(entry.url);
    if (!imgRes.ok) throw new Error(`Fetch image: ${imgRes.status}`);
    bytes = new Uint8Array(await imgRes.arrayBuffer());
  } else {
    throw new Error("OpenAI response missing image payload.");
  }

  return {
    blob: new Blob([bytes.buffer as ArrayBuffer], { type: "image/png" }),
    contentType: "image/png",
    width: w,
    height: h,
  };
}
