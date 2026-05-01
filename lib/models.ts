/**
 * Model registry — single source of truth for image + animation models.
 *
 * Adding a new model = appending an entry here. The stills route, the
 * animate route, the Bible's default-model dropdown, and the Playground
 * all read from this map. No new UI work required to surface a model.
 *
 * Keep IDs lowercase, hyphenated, and human-readable — they're what
 * lands in the projects.aesthetic_bible.default_image_model column,
 * in the generations.model_id column, and in URL params for the
 * Playground.
 */

export type ImageModelId =
  | "openai-gpt-image-2"
  | "openai-gpt-image-1"
  | "google-nano-banana-2"
  | "flux-kontext-pro";

export type AnimationModelId =
  | "kling-v2-5-turbo-pro"
  | "kling-edit"
  | "kling-motion-control"
  | "seedance-2-pro";

export interface ImageModelDef {
  id: ImageModelId;
  label: string;
  /** Sub-line that surfaces in dropdowns + on the Playground. */
  description: string;
  /** Replicate slug, optionally pinned with `:version`. */
  replicate_slug: string;
  /** Aspect ratios this model accepts natively. */
  aspect_ratios: string[];
  /** Quality tiers, if any. Empty = no quality knob. */
  quality?: Array<"auto" | "low" | "medium" | "high">;
  /** Whether the model accepts a reference / source image. */
  accepts_input_image: boolean;
  /** Field name for input images on Replicate (varies per model). */
  input_image_field?: "input_images" | "image_input" | "input_image";
  /** Approximate cost per call in cents — informational only. */
  approx_cost_cents: number;
}

export interface AnimationModelDef {
  id: AnimationModelId;
  label: string;
  description: string;
  replicate_slug: string;
  aspect_ratios: string[];
  /** Whether the model accepts a start_image + end_image transition. */
  accepts_end_image: boolean;
  /** Field name for the start frame (varies per model). */
  start_image_field: "image" | "start_image";
  durations: number[];
  approx_cost_cents: number;
  /** Realistic / stylized hint for the routing guardrail. */
  flavor: "realistic" | "stylized" | "either";
}

export const IMAGE_MODELS: Record<ImageModelId, ImageModelDef> = {
  "openai-gpt-image-2": {
    id: "openai-gpt-image-2",
    label: "gpt-image-2",
    description: "OpenAI's latest. Strong typography, ~25-130s.",
    replicate_slug:
      process.env.OPENAI_IMAGE_MODEL ??
      "openai/gpt-image-2:875d2396848b8447d556115adaa81d4d0508d03a0b61c9d51da0d069efd00c35",
    aspect_ratios: ["1:1", "3:2", "2:3"],
    quality: ["auto", "low", "medium", "high"],
    accepts_input_image: true,
    input_image_field: "input_images",
    approx_cost_cents: 4,
  },
  "openai-gpt-image-1": {
    id: "openai-gpt-image-1",
    label: "gpt-image-1",
    description: "Older OpenAI image. Faster, slightly less precise.",
    replicate_slug: "openai/gpt-image-1",
    aspect_ratios: ["1:1", "3:2", "2:3"],
    quality: ["auto", "low", "medium", "high"],
    accepts_input_image: true,
    input_image_field: "input_images",
    approx_cost_cents: 3,
  },
  "google-nano-banana-2": {
    id: "google-nano-banana-2",
    label: "Nano Banana 2",
    description: "Google. Fast (~8s) reference-conditioned generation.",
    replicate_slug: "google/nano-banana-2",
    aspect_ratios: ["1:1", "16:9", "9:16", "4:3", "3:4"],
    accepts_input_image: true,
    input_image_field: "image_input",
    approx_cost_cents: 1,
  },
  "flux-kontext-pro": {
    id: "flux-kontext-pro",
    label: "Flux Kontext Pro",
    description: "BFL. Image-to-image transformation, geometry-preserving.",
    replicate_slug: "black-forest-labs/flux-kontext-pro",
    aspect_ratios: [
      "match_input_image",
      "1:1",
      "16:9",
      "9:16",
      "4:3",
      "3:4",
    ],
    accepts_input_image: true,
    input_image_field: "input_image",
    approx_cost_cents: 4,
  },
};

export const ANIMATION_MODELS: Record<AnimationModelId, AnimationModelDef> = {
  "kling-v2-5-turbo-pro": {
    id: "kling-v2-5-turbo-pro",
    label: "Kling 2.5 Turbo Pro",
    description: "Premium stylized + realistic. Start/end frame transitions.",
    replicate_slug: "kwaivgi/kling-v2.5-turbo-pro",
    aspect_ratios: ["9:16", "16:9", "1:1"],
    accepts_end_image: true,
    start_image_field: "start_image",
    durations: [5, 10],
    approx_cost_cents: 35,
    flavor: "either",
  },
  "kling-edit": {
    id: "kling-edit",
    label: "Kling Edit",
    description: "Targeted edits to an existing clip's last frame.",
    replicate_slug: "kwaivgi/kling-v2.1-edit",
    aspect_ratios: ["9:16", "16:9"],
    accepts_end_image: false,
    start_image_field: "start_image",
    durations: [5, 10],
    approx_cost_cents: 35,
    flavor: "stylized",
  },
  "kling-motion-control": {
    id: "kling-motion-control",
    label: "Kling Motion Control",
    description: "Camera-move primitives applied to a still.",
    replicate_slug: "kwaivgi/kling-motion-control",
    aspect_ratios: ["9:16", "16:9"],
    accepts_end_image: false,
    start_image_field: "start_image",
    durations: [5, 10],
    approx_cost_cents: 35,
    flavor: "either",
  },
  "seedance-2-pro": {
    id: "seedance-2-pro",
    label: "Seedance 2.0",
    description: "ByteDance. Cinematic + drone-style realism.",
    replicate_slug: process.env.SEEDANCE_MODEL ?? "bytedance/seedance-2.0",
    aspect_ratios: ["9:16", "16:9", "1:1"],
    accepts_end_image: false,
    start_image_field: "image",
    durations: [5, 6, 8, 10, 15],
    approx_cost_cents: 45,
    flavor: "realistic",
  },
};

export const DEFAULT_IMAGE_MODEL: ImageModelId = "openai-gpt-image-2";
export const DEFAULT_ANIMATION_MODEL: AnimationModelId = "seedance-2-pro";

export function imageModel(id: string): ImageModelDef {
  return (
    IMAGE_MODELS[id as ImageModelId] ??
    IMAGE_MODELS[DEFAULT_IMAGE_MODEL]
  );
}

export function animationModel(id: string): AnimationModelDef {
  return (
    ANIMATION_MODELS[id as AnimationModelId] ??
    ANIMATION_MODELS[DEFAULT_ANIMATION_MODEL]
  );
}
