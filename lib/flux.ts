import { z } from "zod";

/**
 * Flux image model adapter.
 *
 * Replicate's black-forest-labs/flux-1.1-pro by default. Users can
 * override via env (e.g. flux-schnell for faster/cheaper, or a
 * different provider entirely if they've pinned a Replicate version).
 */

export const FLUX_MODEL =
  process.env.FLUX_MODEL ?? "black-forest-labs/flux-1.1-pro";

export const fluxInputSchema = z.object({
  prompt: z.string().min(1).max(4000),
  aspect_ratio: z
    .enum(["9:16", "16:9", "1:1", "4:3", "3:4", "21:9"])
    .default("9:16"),
  output_format: z.enum(["png", "jpg", "webp"]).default("png"),
  output_quality: z.number().int().min(1).max(100).default(95),
  safety_tolerance: z.number().int().min(1).max(6).default(5),
});

export type FluxInput = z.infer<typeof fluxInputSchema>;
