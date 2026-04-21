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
  prompt: z.string().min(1),
  continuity_notes: z.string().optional().default(""),
  voice_direction: z.string().optional().default(""),
  suggested_seed_behavior: z
    .enum(["auto", "manual_pick", "none"])
    .optional()
    .default("auto"),
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
