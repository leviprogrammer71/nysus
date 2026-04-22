import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AestheticBible,
  CharacterSheet,
  Database,
} from "@/lib/supabase/types";

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

// --- Tool executor -------------------------------------------------

export type ToolContext = {
  admin: SupabaseClient<Database>;
  projectId: string;
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
