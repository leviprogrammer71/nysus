import { z } from "zod";
import type { ShotPrompt } from "@/lib/shot-prompt";

/**
 * Kling image-to-video adapter.
 *
 * Used for stylized / 3D / animated projects. Realistic projects
 * route to Seedance (see lib/seedance.ts). Dio picks based on the
 * aesthetic bible's visual_style, with the rule that anything that
 * reads as "realistic" always uses Seedance 2.0.
 *
 * Replicate slug default: kwaivgi/kling-v2.1-master. Override via
 * KLING_MODEL env if the slug drifts.
 */

export const KLING_MODEL =
  process.env.KLING_MODEL ?? "kwaivgi/kling-v2.1-master";

export const klingInputSchema = z.object({
  prompt: z.string().min(1).max(4000),
  start_image: z.string().url().optional(),
  duration: z.number().int().min(5).max(30).default(5),
  aspect_ratio: z.enum(["9:16", "16:9", "1:1"]).default("9:16"),
  cfg_scale: z.number().min(0).max(1).default(0.5),
  negative_prompt: z.string().optional(),
});

export type KlingInput = z.infer<typeof klingInputSchema>;

export function buildKlingInput(args: {
  shot: ShotPrompt;
  seedImageUrl?: string | null;
  aspectRatio?: KlingInput["aspect_ratio"];
}): KlingInput {
  // Kling caps at certain durations per tier; the 5/10s split matches
  // its master model sizes. Round down conservatively.
  const dur = args.shot.duration >= 10 ? 10 : 5;
  return klingInputSchema.parse({
    prompt: args.shot.prompt,
    start_image: args.seedImageUrl ?? undefined,
    duration: dur,
    aspect_ratio: args.aspectRatio ?? "9:16",
  });
}
