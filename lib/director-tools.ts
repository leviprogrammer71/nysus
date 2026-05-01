import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AestheticBible,
  CharacterSheet,
  Database,
  SceneBibleOverrides,
} from "@/lib/supabase/types";
import type { ShotPromptMetadata } from "@/lib/shot-prompt";

/**
 * Director tools.
 *
 * These are the write capabilities the chat model can invoke inside a
 * project. The chat API runs a tool-call loop; when Claude decides to
 * use one of these, we execute it server-side (service role, bypasses
 * RLS but the project_id is always clamped to the authenticated
 * user's project) and feed the compact result string back into the
 * conversation so the model can continue.
 *
 * Design principles:
 *   - Tools are state mutations, not reads. The chat already ships
 *     PROJECT CONTEXT on every user turn, so the model always has the
 *     current sheet / bible.
 *   - Tool outputs are short human strings the model can cite back.
 *   - Everything is idempotent-ish: replacing a character sheet with
 *     the same payload is a no-op.
 */

// --- OpenAI-compatible tool schemas --------------------------------

type JsonSchema = Record<string, unknown>;

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: JsonSchema;
  };
}

const characterSheetSchema: JsonSchema = {
  type: "object",
  description:
    "Full character sheet. REPLACES the existing sheet in its entirety.",
  properties: {
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "string" },
          ethnicity: { type: "string" },
          appearance: { type: "string" },
          wardrobe: { type: "string" },
          voice: { type: "string" },
          demeanor: { type: "string" },
        },
        required: ["name"],
      },
    },
    setting: {
      type: "object",
      properties: {
        primary: { type: "string" },
        recurring_symbol: { type: "string" },
      },
    },
  },
};

const aestheticBibleSchema: JsonSchema = {
  type: "object",
  description:
    "Full aesthetic bible. REPLACES the existing bible in its entirety.",
  properties: {
    visual_style: { type: "string" },
    palette: { type: "string" },
    camera: { type: "string" },
    aspect_ratio: { type: "string" },
    audio_signature: { type: "string" },
    thematic_motifs: {
      type: "array",
      items: { type: "string" },
    },
    forbidden: {
      type: "array",
      items: { type: "string" },
    },
  },
};

/**
 * Tool subsets for the Ari (planner) / Mae (executor) split.
 *
 *   ARI_TOOLS — everything Ari can write to the project state. No
 *               money-spending actions. If Ari tries to trigger a
 *               portrait, the model should say "that's Mae's side."
 *   MAE_TOOLS — all of Ari's tools plus generate_character_portrait.
 *
 * Exported computed below once DIRECTOR_TOOLS is defined.
 */

export const DIRECTOR_TOOLS: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "update_character_sheet",
      description:
        "Overwrite the project's character sheet with a fully-formed sheet. Use this when the user wants you to draft characters, or when you're expanding what they gave you. Include every character that should remain — this REPLACES the existing sheet.",
      parameters: {
        type: "object",
        properties: {
          character_sheet: characterSheetSchema,
          summary: {
            type: "string",
            description:
              "Short past-tense sentence for the user, e.g. 'Added David and Maya with a balcony setting.'",
          },
        },
        required: ["character_sheet", "summary"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_character",
      description:
        "Append one character to the existing character sheet without touching the others. Prefer this when the user is adding to the cast, not replacing it.",
      parameters: {
        type: "object",
        properties: {
          character: {
            type: "object",
            properties: {
              name: { type: "string" },
              age: { type: "string" },
              ethnicity: { type: "string" },
              appearance: { type: "string" },
              wardrobe: { type: "string" },
              voice: { type: "string" },
              demeanor: { type: "string" },
            },
            required: ["name"],
          },
          summary: { type: "string" },
        },
        required: ["character", "summary"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_aesthetic_bible",
      description:
        "Overwrite the project's aesthetic bible. Replaces everything — include every field you want preserved. Use when the user asks you to draft, refine, or rethink the visual world.",
      parameters: {
        type: "object",
        properties: {
          aesthetic_bible: aestheticBibleSchema,
          summary: { type: "string" },
        },
        required: ["aesthetic_bible", "summary"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "generate_character_portrait",
      description:
        "Produce the FIRST image of a project — a portrait of the named character, composed from their sheet entry + the aesthetic bible. The portrait is stored at the top of that character's reference_images so every subsequent chat turn sees it, and every scene still inherits the consistent face. Call this immediately after update_character_sheet or add_character, BEFORE emitting any json-shot scenes. If the character already has a portrait you like, skip this call.",
      parameters: {
        type: "object",
        properties: {
          character_name: {
            type: "string",
            description:
              "The name of the character to portrait. Must match a character already in the sheet.",
          },
          summary: {
            type: "string",
            description:
              "Short past-tense sentence for the user, e.g. 'Generated David's portrait.'",
          },
        },
        required: ["character_name", "summary"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_project_meta",
      description:
        "Update the project's title and/or description. Use this if the user asks you to rename the project or refine its one-line pitch.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          summary: { type: "string" },
        },
        required: ["summary"],
      },
    },
  },
];

/**
 * Scene-scoped tools — Rite mode only. The active scene is bound on
 * the chat thread (scene_id), so the model doesn't need to pass it.
 */
export const SCENE_TOOLS_ONLY: ToolDefinition[] = [
  {
    type: "function",
    function: {
      name: "update_scene_prompt",
      description:
        "Refine the bound scene's prompts. Pass any combination of: image_prompt (for the still), prompt (for the motion clip), narration, voice_direction, animation_model. Fields you omit are left unchanged. The active scene_id is bound on this thread — you do not pass it.",
      parameters: {
        type: "object",
        properties: {
          image_prompt: { type: "string" },
          prompt: { type: "string" },
          narration: { type: "string" },
          voice_direction: { type: "string" },
          animation_model: {
            type: "string",
            enum: ["seedance", "kling"],
          },
          summary: { type: "string" },
        },
        required: ["summary"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_scene_bible_overrides",
      description:
        "Set per-scene bible overrides on the bound scene. Use this for surgical breaks from the global bible: omit a character, drop the global style for this scene, or attach free-form notes the still / motion prompts should respect.",
      parameters: {
        type: "object",
        properties: {
          disable_character_ids: {
            type: "array",
            items: { type: "string" },
            description: "Character names to omit when injecting the bible.",
          },
          disable_style: {
            type: "boolean",
            description: "If true, ignore the bible's visual_style/palette/camera for this scene.",
          },
          notes: { type: "string" },
          summary: { type: "string" },
        },
        required: ["summary"],
      },
    },
  },
];

/**
 * Tools exposed to Ari. She's now the conversational + planner +
 * scene-drafter; the only paid call she makes is generate_character_portrait
 * because portraits anchor every still's face. Mae is no longer an
 * LLM — she's a silent execution board, so MAE_TOOLS is unused (kept
 * for backward compat).
 */
export const ARI_TOOLS: ToolDefinition[] = DIRECTOR_TOOLS;
export const MAE_TOOLS: ToolDefinition[] = DIRECTOR_TOOLS;

/**
 * Per-mode tool sets for the StoryFlow split.
 *   concept (Oracle)  — project-level writing only.
 *   script  (Liturgy) — same set; the difference lives in the system prompt.
 *   scene   (Rite)    — scene-level writing PLUS update_aesthetic_bible
 *                       (escape hatch when the user explicitly says so)
 *                       and generate_character_portrait (new char).
 */
export const CONCEPT_TOOLS: ToolDefinition[] = DIRECTOR_TOOLS;
export const SCRIPT_TOOLS: ToolDefinition[] = DIRECTOR_TOOLS;
export const SCENE_TOOLS: ToolDefinition[] = [
  ...SCENE_TOOLS_ONLY,
  // Reach back to the global bible only when the user explicitly asks.
  ...DIRECTOR_TOOLS.filter(
    (t) =>
      t.function.name === "update_aesthetic_bible" ||
      t.function.name === "generate_character_portrait",
  ),
];

// --- Tool executor -------------------------------------------------

export type ToolContext = {
  admin: SupabaseClient<Database>;
  projectId: string;
  /** Request origin (for calling our own portrait endpoint). */
  origin: string;
  /** Session cookies forwarded to internal routes. */
  cookieHeader?: string;
  /**
   * Active scene the chat thread is bound to. Required for Rite mode
   * tools (update_scene_prompt, update_scene_bible_overrides); ignored
   * by other tools.
   */
  sceneId?: string;
};

export type ToolResult = {
  /** Compact human string fed back to the model. */
  result: string;
  /** Serializable block rendered as a tool-event card in chat. */
  event: {
    name: string;
    summary: string;
    detail?: string;
  };
};

export async function executeDirectorTool(
  name: string,
  rawArgs: string,
  ctx: ToolContext,
): Promise<ToolResult> {
  let args: Record<string, unknown> = {};
  try {
    args = rawArgs && rawArgs.trim().length > 0 ? JSON.parse(rawArgs) : {};
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      result: `ERROR: could not parse arguments (${msg}). Don't retry — surface the problem to the user.`,
      event: {
        name,
        summary: `couldn't apply — argument JSON was malformed`,
      },
    };
  }

  try {
    switch (name) {
      case "update_character_sheet":
        return await runUpdateCharacterSheet(args, ctx);
      case "add_character":
        return await runAddCharacter(args, ctx);
      case "update_aesthetic_bible":
        return await runUpdateAestheticBible(args, ctx);
      case "update_project_meta":
        return await runUpdateProjectMeta(args, ctx);
      case "generate_character_portrait":
        return await runGeneratePortrait(args, ctx);
      case "update_scene_prompt":
        return await runUpdateScenePrompt(args, ctx);
      case "update_scene_bible_overrides":
        return await runUpdateSceneBibleOverrides(args, ctx);
      default:
        return {
          result: `ERROR: no such tool: ${name}`,
          event: { name, summary: `unknown tool` },
        };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      result: `ERROR: ${msg}`,
      event: {
        name,
        summary: `failed — ${msg}`,
      },
    };
  }
}

async function runUpdateCharacterSheet(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const sheet = args.character_sheet as CharacterSheet | undefined;
  const summary =
    typeof args.summary === "string"
      ? args.summary
      : "updated character sheet";
  if (!sheet || typeof sheet !== "object") {
    return {
      result: "ERROR: missing character_sheet.",
      event: { name: "update_character_sheet", summary: "missing sheet" },
    };
  }
  const { error } = await ctx.admin
    .from("projects")
    .update({ character_sheet: sheet })
    .eq("id", ctx.projectId);
  if (error) {
    return {
      result: `ERROR: ${error.message}`,
      event: { name: "update_character_sheet", summary: `failed — ${error.message}` },
    };
  }
  return {
    result: `ok: character sheet replaced. ${summary}`,
    event: { name: "update_character_sheet", summary, detail: briefCast(sheet) },
  };
}

async function runAddCharacter(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const character = args.character as Record<string, string> | undefined;
  const summary =
    typeof args.summary === "string" ? args.summary : "added a character";
  if (!character || typeof character !== "object" || !character.name) {
    return {
      result: "ERROR: character.name is required.",
      event: { name: "add_character", summary: "missing name" },
    };
  }

  // Read existing sheet, append, write back. Small enough that one
  // round-trip each way is fine.
  const { data: proj, error: readErr } = await ctx.admin
    .from("projects")
    .select("character_sheet")
    .eq("id", ctx.projectId)
    .single();
  if (readErr || !proj) {
    return {
      result: `ERROR: ${readErr?.message ?? "project not found"}`,
      event: { name: "add_character", summary: "project read failed" },
    };
  }
  const existing = (proj.character_sheet ?? {}) as CharacterSheet;
  const nextChars = [...(existing.characters ?? []), character];
  const next: CharacterSheet = { ...existing, characters: nextChars as CharacterSheet["characters"] };

  const { error: writeErr } = await ctx.admin
    .from("projects")
    .update({ character_sheet: next })
    .eq("id", ctx.projectId);
  if (writeErr) {
    return {
      result: `ERROR: ${writeErr.message}`,
      event: { name: "add_character", summary: `failed — ${writeErr.message}` },
    };
  }
  return {
    result: `ok: added ${character.name}.`,
    event: {
      name: "add_character",
      summary,
      detail: `added ${character.name}`,
    },
  };
}

async function runUpdateAestheticBible(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const bible = args.aesthetic_bible as AestheticBible | undefined;
  const summary =
    typeof args.summary === "string"
      ? args.summary
      : "updated aesthetic bible";
  if (!bible || typeof bible !== "object") {
    return {
      result: "ERROR: missing aesthetic_bible.",
      event: { name: "update_aesthetic_bible", summary: "missing bible" },
    };
  }
  const { error } = await ctx.admin
    .from("projects")
    .update({ aesthetic_bible: bible })
    .eq("id", ctx.projectId);
  if (error) {
    return {
      result: `ERROR: ${error.message}`,
      event: { name: "update_aesthetic_bible", summary: `failed — ${error.message}` },
    };
  }
  return {
    result: `ok: aesthetic bible replaced. ${summary}`,
    event: { name: "update_aesthetic_bible", summary, detail: briefBible(bible) },
  };
}

async function runUpdateProjectMeta(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const summary =
    typeof args.summary === "string"
      ? args.summary
      : "updated project metadata";
  const patch: { title?: string; description?: string } = {};
  if (typeof args.title === "string" && args.title.trim()) {
    patch.title = args.title.trim().slice(0, 200);
  }
  if (typeof args.description === "string") {
    patch.description = args.description.trim().slice(0, 2000);
  }
  if (Object.keys(patch).length === 0) {
    return {
      result: "ERROR: nothing to update — provide title and/or description.",
      event: { name: "update_project_meta", summary: "no-op" },
    };
  }
  const { error } = await ctx.admin
    .from("projects")
    .update(patch)
    .eq("id", ctx.projectId);
  if (error) {
    return {
      result: `ERROR: ${error.message}`,
      event: { name: "update_project_meta", summary: `failed — ${error.message}` },
    };
  }
  const parts: string[] = [];
  if (patch.title) parts.push(`title → ${patch.title}`);
  if (patch.description) parts.push(`new description`);
  return {
    result: `ok: ${parts.join(", ")}`,
    event: {
      name: "update_project_meta",
      summary,
      detail: parts.join(" · "),
    },
  };
}

async function runGeneratePortrait(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const name = typeof args.character_name === "string" ? args.character_name : "";
  const summary =
    typeof args.summary === "string"
      ? args.summary
      : `generated ${name || "character"} portrait`;
  if (!name.trim()) {
    return {
      result: "ERROR: character_name required.",
      event: { name: "generate_character_portrait", summary: "missing name" },
    };
  }

  // Call our own portrait endpoint with the session cookies forwarded
  // so RLS + auth line up. The endpoint handles prompt composition,
  // image generation (OpenAI if key, else Flux), Storage upload, and
  // patching the character's reference_images.
  const res = await fetch(`${ctx.origin}/api/characters/portrait`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(ctx.cookieHeader ? { cookie: ctx.cookieHeader } : {}),
    },
    body: JSON.stringify({
      project_id: ctx.projectId,
      character_name: name.trim(),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    path?: string;
    provider?: string;
    model?: string;
    error?: string;
  };
  if (!res.ok) {
    return {
      result: `ERROR: ${body.error ?? res.statusText}`,
      event: {
        name: "generate_character_portrait",
        summary: `failed — ${body.error ?? res.statusText}`,
      },
    };
  }
  return {
    result: `ok: portrait generated via ${body.provider ?? "provider"} (${body.model ?? "model"})`,
    event: {
      name: "generate_character_portrait",
      summary,
      detail: `${name} — portrait saved`,
    },
  };
}

async function runUpdateScenePrompt(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const summary =
    typeof args.summary === "string"
      ? args.summary
      : "refined the scene prompt";
  if (!ctx.sceneId) {
    return {
      result: "ERROR: no scene bound to this thread.",
      event: {
        name: "update_scene_prompt",
        summary: "no scene bound — call from a Rite thread",
      },
    };
  }

  // Read the existing clip + its shot_metadata so we can patch the
  // prompt/narration/animation_model fields without losing other
  // metadata Mae or the timeline rely on.
  const { data: clip, error: readErr } = await ctx.admin
    .from("clips")
    .select(
      "id, prompt, still_prompt, narration, shot_metadata, project_id",
    )
    .eq("id", ctx.sceneId)
    .eq("project_id", ctx.projectId)
    .single();
  if (readErr || !clip) {
    return {
      result: `ERROR: ${readErr?.message ?? "scene not found"}`,
      event: {
        name: "update_scene_prompt",
        summary: "scene read failed",
      },
    };
  }

  const meta: ShotPromptMetadata = {
    ...((clip.shot_metadata ?? {}) as ShotPromptMetadata),
  };
  const patch: Database["public"]["Tables"]["clips"]["Update"] = {};
  const touched: string[] = [];

  if (typeof args.image_prompt === "string" && args.image_prompt.trim()) {
    const v = args.image_prompt.trim();
    patch.still_prompt = v;
    meta.image_prompt = v;
    touched.push("still");
  }
  if (typeof args.prompt === "string" && args.prompt.trim()) {
    const v = args.prompt.trim();
    patch.prompt = v;
    touched.push("motion");
  }
  if (typeof args.narration === "string") {
    const v = args.narration.trim();
    patch.narration = v.length > 0 ? v : null;
    meta.narration = v;
    touched.push("narration");
  }
  if (typeof args.voice_direction === "string") {
    const v = args.voice_direction.trim();
    meta.voice_direction = v;
    touched.push("voice");
  }
  if (
    args.animation_model === "seedance" ||
    args.animation_model === "kling"
  ) {
    meta.animation_model = args.animation_model;
    touched.push("animation model");
  }

  patch.shot_metadata = meta;

  const { error: writeErr } = await ctx.admin
    .from("clips")
    .update(patch)
    .eq("id", ctx.sceneId)
    .eq("project_id", ctx.projectId);
  if (writeErr) {
    return {
      result: `ERROR: ${writeErr.message}`,
      event: {
        name: "update_scene_prompt",
        summary: `failed — ${writeErr.message}`,
      },
    };
  }

  if (touched.length === 0) {
    return {
      result:
        "ok: nothing to update — at least one of image_prompt, prompt, narration, voice_direction, animation_model is required.",
      event: {
        name: "update_scene_prompt",
        summary: "no fields supplied",
      },
    };
  }

  return {
    result: `ok: ${summary}. Touched: ${touched.join(", ")}.`,
    event: {
      name: "update_scene_prompt",
      summary,
      detail: `touched: ${touched.join(" · ")}`,
    },
  };
}

async function runUpdateSceneBibleOverrides(
  args: Record<string, unknown>,
  ctx: ToolContext,
): Promise<ToolResult> {
  const summary =
    typeof args.summary === "string"
      ? args.summary
      : "set per-scene bible overrides";
  if (!ctx.sceneId) {
    return {
      result: "ERROR: no scene bound to this thread.",
      event: {
        name: "update_scene_bible_overrides",
        summary: "no scene bound — call from a Rite thread",
      },
    };
  }

  const overrides: SceneBibleOverrides = {};
  if (Array.isArray(args.disable_character_ids)) {
    const ids = (args.disable_character_ids as unknown[])
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
      .map((v) => v.trim());
    if (ids.length > 0) overrides.disable_character_ids = ids;
  }
  if (typeof args.disable_style === "boolean") {
    overrides.disable_style = args.disable_style;
  }
  if (typeof args.notes === "string" && args.notes.trim()) {
    overrides.notes = args.notes.trim();
  }

  const { error } = await ctx.admin
    .from("clips")
    .update({ bible_overrides: overrides })
    .eq("id", ctx.sceneId)
    .eq("project_id", ctx.projectId);
  if (error) {
    return {
      result: `ERROR: ${error.message}`,
      event: {
        name: "update_scene_bible_overrides",
        summary: `failed — ${error.message}`,
      },
    };
  }

  const detailParts: string[] = [];
  if (overrides.disable_character_ids?.length)
    detailParts.push(`omit: ${overrides.disable_character_ids.join(", ")}`);
  if (overrides.disable_style) detailParts.push("style off");
  if (overrides.notes)
    detailParts.push(`notes: ${overrides.notes.slice(0, 60)}`);

  return {
    result: `ok: ${summary}.`,
    event: {
      name: "update_scene_bible_overrides",
      summary,
      detail: detailParts.length > 0 ? detailParts.join(" · ") : "cleared",
    },
  };
}

// --- Small formatters ----------------------------------------------

function briefCast(sheet: CharacterSheet): string {
  const chars = (sheet.characters ?? [])
    .map((c) => (typeof c?.name === "string" ? c.name : null))
    .filter(Boolean)
    .slice(0, 4);
  if (chars.length === 0) return "";
  return `cast: ${chars.join(", ")}`;
}

function briefBible(bible: AestheticBible): string {
  const parts: string[] = [];
  if (bible.visual_style) parts.push(String(bible.visual_style).slice(0, 60));
  if (bible.palette) parts.push(String(bible.palette).slice(0, 60));
  return parts.slice(0, 2).join(" · ");
}
