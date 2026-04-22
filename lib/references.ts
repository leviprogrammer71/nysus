import type {
  CharacterSheet,
  AestheticBible,
} from "@/lib/supabase/types";

/**
 * Helpers that work with the shape of reference_images inside the
 * project JSONB. Shared between the upload/delete endpoints, the
 * chat-route injection path, and the edit form.
 *
 * The user-facing "target" is a string:
 *   "bible"                 — aesthetic bible mood board
 *   "character:<name>"      — per-character reference images
 *
 * The name is how users think of a character; we resolve it to the
 * matching entry in character_sheet.characters[].
 */

export type RefTarget = { kind: "bible" } | { kind: "character"; name: string };

export function parseRefTarget(raw: unknown): RefTarget | null {
  if (typeof raw !== "string") return null;
  if (raw === "bible") return { kind: "bible" };
  if (raw.startsWith("character:")) {
    const name = raw.slice("character:".length).trim();
    if (name.length === 0) return null;
    return { kind: "character", name };
  }
  return null;
}

export const MAX_REFERENCES_PER_PROJECT = 8;

/**
 * Count all reference images across a project so uploads can enforce
 * the hard cap cleanly.
 */
export function countRefs(
  sheet: CharacterSheet | null | undefined,
  bible: AestheticBible | null | undefined,
): number {
  let n = 0;
  for (const c of sheet?.characters ?? []) {
    n += c.reference_images?.length ?? 0;
  }
  n += sheet?.setting?.reference_images?.length ?? 0;
  n += bible?.reference_images?.length ?? 0;
  return n;
}

/**
 * Add a storage path to the matching slot inside the sheet/bible JSON.
 * Returns the updated copies; caller writes them back.
 */
export function addRefPath(
  target: RefTarget,
  path: string,
  sheet: CharacterSheet,
  bible: AestheticBible,
): { sheet: CharacterSheet; bible: AestheticBible; applied: boolean } {
  if (target.kind === "bible") {
    const list = bible.reference_images ?? [];
    return {
      sheet,
      bible: { ...bible, reference_images: [...list, path] },
      applied: true,
    };
  }
  const characters = [...(sheet.characters ?? [])];
  const idx = characters.findIndex(
    (c) => c.name?.trim().toLowerCase() === target.name.trim().toLowerCase(),
  );
  if (idx === -1) {
    return { sheet, bible, applied: false };
  }
  const char = characters[idx];
  characters[idx] = {
    ...char,
    reference_images: [...(char.reference_images ?? []), path],
  };
  return {
    sheet: { ...sheet, characters: characters as CharacterSheet["characters"] },
    bible,
    applied: true,
  };
}

/**
 * Remove a storage path from anywhere it appears in the sheet/bible.
 */
export function removeRefPath(
  path: string,
  sheet: CharacterSheet,
  bible: AestheticBible,
): { sheet: CharacterSheet; bible: AestheticBible; found: boolean } {
  let found = false;
  const characters = (sheet.characters ?? []).map((c) => {
    if (!c.reference_images?.includes(path)) return c;
    found = true;
    return {
      ...c,
      reference_images: c.reference_images.filter((p) => p !== path),
    };
  });
  const setting = sheet.setting
    ? sheet.setting.reference_images?.includes(path)
      ? {
          ...sheet.setting,
          reference_images: sheet.setting.reference_images.filter((p) => p !== path),
        }
      : sheet.setting
    : sheet.setting;
  if (setting !== sheet.setting) found = true;

  const bibleRefs = bible.reference_images ?? [];
  let nextBible = bible;
  if (bibleRefs.includes(path)) {
    found = true;
    nextBible = {
      ...bible,
      reference_images: bibleRefs.filter((p) => p !== path),
    };
  }
  return {
    sheet: {
      ...sheet,
      characters: characters as CharacterSheet["characters"],
      setting,
    },
    bible: nextBible,
    found,
  };
}

/**
 * Gather every reference path in the project, tagged with its owner
 * so the chat route can build labeled image prompts.
 */
export type LabeledRef = {
  label: string; // e.g. "David reference", "aesthetic bible reference"
  path: string;
};

export function collectLabeledRefs(
  sheet: CharacterSheet | null | undefined,
  bible: AestheticBible | null | undefined,
): LabeledRef[] {
  const out: LabeledRef[] = [];
  for (const c of sheet?.characters ?? []) {
    const name = c.name ?? "character";
    for (const p of c.reference_images ?? []) {
      out.push({ label: `${name} reference`, path: p });
    }
  }
  for (const p of sheet?.setting?.reference_images ?? []) {
    out.push({ label: "setting reference", path: p });
  }
  for (const p of bible?.reference_images ?? []) {
    out.push({ label: "aesthetic bible reference", path: p });
  }
  return out;
}
