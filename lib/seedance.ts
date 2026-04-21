import { z } from "zod";
import type { ShotPrompt } from "@/lib/shot-prompt";

/**
 * Seedance 2.0 input adapter.
 *
 * Replicate's model slug and exact parameter shape is verified lazily
 * (see § Deviations → "Pre-flight model verification" in PROGRESS.md).
 * If the slug has drifted, override `SEEDANCE_MODEL` via env rather
 * than editing this file.
 */

export const SEEDANCE_MODEL =
  process.env.SEEDANCE_MODEL ?? "bytedance/seedance-1-pro";

/**
 * Public shape of the input we pass to Replicate for Seedance.
 * Matches the common ByteDance Seedance-2.0 parameter set:
 *
 *   prompt       — text conditioning
 *   image        — optional image-to-video seed (last frame of prior clip)
 *   duration     — clip length in seconds (5 / 10 / 15)
 *   aspect_ratio — output aspect ratio (default 9:16 vertical per bible)
 *
 * We send only the fields Seedance accepts; Replicate ignores extras
 * but flagging unknown keys keeps this honest.
 */
export const seedanceInputSchema = z.object({
  prompt: z.string().min(1).max(4000),
  image: z.string().url().optional(),
  duration: z.number().int().min(5).max(30).default(15),
  aspect_ratio: z
    .enum(["9:16", "16:9", "1:1", "4:3", "3:4", "21:9"])
    .default("9:16"),
  // Generation seed for reproducibility — leave undefined for variety.
  seed: z.number().int().optional(),
});

export type SeedanceInput = z.infer<typeof seedanceInputSchema>;

/**
 * Build a Seedance input from a ShotPrompt + optional seed frame.
 */
export function buildSeedanceInput(args: {
  shot: ShotPrompt;
  seedImageUrl?: string | null;
  aspectRatio?: SeedanceInput["aspect_ratio"];
}): SeedanceInput {
  return seedanceInputSchema.parse({
    prompt: args.shot.prompt,
    image: args.seedImageUrl ?? undefined,
    duration: args.shot.duration,
    aspect_ratio: args.aspectRatio ?? "9:16",
  });
}
