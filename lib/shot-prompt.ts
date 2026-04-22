import { z } from "zod";

/**
 * Shot prompt schema.
 *
 * Claude emits these inside ```json-shot code blocks in the chat
 * stream. The parser in Phase 3 pulls them out, validates with
 * `shotPromptSchema`, and renders them as inline Generate-button cards.
 *
 * Keep this file the single source of truth for the shape — the chat
 * parser, the generation route, and the database types all reference it.
 */

export const shotPromptSchema = z.object({
  shot_type: z.literal("shot_prompt"),
  shot_number: z.number().int().positive(),
  duration: z.number().int().min(5).max(30).default(15),
  /**
   * Video / animation prompt — what Seedance sees when it animates
   * the still. Describe motion, pacing, camera, beat.
   */
  prompt: z.string().min(1),
  /**
   * Optional still-generation prompt — fed to the image model
   * (Flux by default) to produce the seed frame for this scene.
   * When present, the user generates the still first, then animates
   * from it. When absent, we go straight to Seedance with whatever
   * seed is supplied.
   */
  image_prompt: z.string().optional().default(""),
  /**
   * Optional voiceover text for this scene. Not generated
   * automatically yet — surfaced on the shot card for copy/paste
   * into whatever VO tool the user likes.
   */
  narration: z.string().optional().default(""),
  continuity_notes: z.string().optional().default(""),
  voice_direction: z.string().optional().default(""),
  suggested_seed_behavior: z
    .enum(["auto", "manual_pick", "none"])
    .optional()
    .default("auto"),
  /**
   * Which image-to-video model to use when animating this scene.
   * Seedance 2.0 is the default and mandated for realistic projects;
   * Kling is chosen for 3D / stylized / animated aesthetics.
   */
  animation_model: z
    .enum(["seedance", "kling"])
    .optional()
    .default("seedance"),
});

export type ShotPrompt = z.infer<typeof shotPromptSchema>;

/**
 * Metadata stored on the `clips.shot_metadata` jsonb column — the full
 * shot block the user chose to generate, minus the prompt itself
 * (which lives in clips.prompt for easy querying).
 */
export type ShotPromptMetadata = Omit<ShotPrompt, "prompt">;

/**
 * Extract all ```json-shot code blocks from a streamed Claude response.
 * Tolerant of partial/in-progress streams — only returns blocks whose
 * closing fence has arrived.
 */
export function extractShotPrompts(markdown: string): ShotPrompt[] {
  const fence = /```json-shot\s*\n([\s\S]*?)\n```/g;
  const out: ShotPrompt[] = [];
  let m: RegExpExecArray | null;
  while ((m = fence.exec(markdown)) !== null) {
    try {
      const parsed = shotPromptSchema.parse(JSON.parse(m[1]));
      out.push(parsed);
    } catch {
      // Skip malformed blocks — Claude sometimes emits draft JSON
      // mid-thought. The user will see the malformed text and can
      // ask for a re-emit.
    }
  }
  return out;
}
