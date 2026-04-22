"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CharacterSheet,
  AestheticBible,
} from "@/lib/supabase/types";
import { ReferenceStrip } from "./reference-strip";

/**
 * Structured project editor.
 *
 * Per-character cards + a setting block for the character sheet, and
 * a labeled form for the aesthetic bible. Thematic motifs and
 * forbidden items are arrays with add/remove rows so Claude keeps
 * seeing them as lists in the prompt context.
 *
 * A "raw JSON" mode is kept as an escape hatch for power edits —
 * whatever JSON the user pastes there wins on Save, so the structured
 * form doesn't become a cage.
 */

type Mode = "structured" | "raw";

type CharacterRow = {
  name: string;
  age: string;
  ethnicity: string;
  appearance: string;
  wardrobe: string;
  voice: string;
  demeanor: string;
  // Carried through on save so refs uploaded via ReferenceStrip survive
  // a structured-form save. The strip manages this list; the form
  // doesn't edit it.
  reference_images: string[];
};

const emptyCharacter = (): CharacterRow => ({
  name: "",
  age: "",
  ethnicity: "",
  appearance: "",
  wardrobe: "",
  voice: "",
  demeanor: "",
  reference_images: [],
});

function normalizeCharacters(raw: unknown): CharacterRow[] {
  if (!raw || typeof raw !== "object") return [];
  const list = (raw as { characters?: unknown }).characters;
  if (!Array.isArray(list)) return [];
  return list.map((c): CharacterRow => {
    const o = (c ?? {}) as Record<string, unknown>;
    const s = (k: string): string =>
      typeof o[k] === "string" ? (o[k] as string) : "";
    const arr = (k: string): string[] =>
      Array.isArray(o[k])
        ? (o[k] as unknown[]).filter((x): x is string => typeof x === "string")
        : [];
    return {
      name: s("name"),
      age: s("age"),
      ethnicity: s("ethnicity"),
      appearance: s("appearance"),
      wardrobe: s("wardrobe"),
      voice: s("voice"),
      demeanor: s("demeanor"),
      reference_images: arr("reference_images"),
    };
  });
}

function normalizeSetting(raw: unknown): { primary: string; recurring_symbol: string } {
  const o = (raw && typeof raw === "object" ? (raw as Record<string, unknown>).setting : null) ?? {};
  const s = (k: string): string => {
    const v = (o as Record<string, unknown>)[k];
    return typeof v === "string" ? v : "";
  };
  return { primary: s("primary"), recurring_symbol: s("recurring_symbol") };
}

function normalizeBible(raw: unknown): {
  visual_style: string;
  palette: string;
  camera: string;
  aspect_ratio: string;
  audio_signature: string;
  thematic_motifs: string[];
  forbidden: string[];
  reference_images: string[];
} {
  const o = (raw ?? {}) as Record<string, unknown>;
  const s = (k: string): string =>
    typeof o[k] === "string" ? (o[k] as string) : "";
  const arr = (k: string): string[] =>
    Array.isArray(o[k])
      ? (o[k] as unknown[]).filter((x): x is string => typeof x === "string")
      : [];
  return {
    visual_style: s("visual_style"),
    palette: s("palette"),
    camera: s("camera"),
    aspect_ratio: s("aspect_ratio") || "9:16",
    audio_signature: s("audio_signature"),
    thematic_motifs: arr("thematic_motifs"),
    forbidden: arr("forbidden"),
    reference_images: arr("reference_images"),
  };
}

function buildCharacterSheet(
  characters: CharacterRow[],
  setting: { primary: string; recurring_symbol: string },
): CharacterSheet {
  const cleaned = characters
    .map((c) => {
      const entry: Record<string, unknown> = {};
      const stringKeys: (keyof CharacterRow)[] = [
        "name",
        "age",
        "ethnicity",
        "appearance",
        "wardrobe",
        "voice",
        "demeanor",
      ];
      for (const k of stringKeys) {
        const v = c[k];
        if (typeof v === "string" && v.trim().length > 0) entry[k] = v.trim();
      }
      // Preserve reference images — managed by ReferenceStrip, not
      // edited via text fields here.
      if (c.reference_images && c.reference_images.length > 0) {
        entry.reference_images = c.reference_images;
      }
      return entry;
    })
    .filter((c) => Object.keys(c).length > 0 && typeof c.name === "string");

  const sheet: CharacterSheet = {};
  if (cleaned.length > 0) {
    sheet.characters = cleaned as CharacterSheet["characters"];
  }
  const primary = setting.primary.trim();
  const sym = setting.recurring_symbol.trim();
  if (primary || sym) {
    sheet.setting = {};
    if (primary) sheet.setting.primary = primary;
    if (sym) sheet.setting.recurring_symbol = sym;
  }
  return sheet;
}

function buildAestheticBible(b: ReturnType<typeof normalizeBible>): AestheticBible {
  const out: AestheticBible = {};
  if (b.visual_style.trim()) out.visual_style = b.visual_style.trim();
  if (b.palette.trim()) out.palette = b.palette.trim();
  if (b.camera.trim()) out.camera = b.camera.trim();
  if (b.aspect_ratio.trim()) out.aspect_ratio = b.aspect_ratio.trim();
  if (b.audio_signature.trim()) out.audio_signature = b.audio_signature.trim();
  const motifs = b.thematic_motifs.map((m) => m.trim()).filter(Boolean);
  if (motifs.length > 0) out.thematic_motifs = motifs;
  const forbidden = b.forbidden.map((f) => f.trim()).filter(Boolean);
  if (forbidden.length > 0) out.forbidden = forbidden;
  // Preserve mood-board refs managed by the ReferenceStrip.
  if (b.reference_images.length > 0) out.reference_images = b.reference_images;
  return out;
}

export function ProjectEditForm({
  projectId,
  initialTitle,
  initialDescription,
  initialCharacterSheet,
  initialAestheticBible,
}: {
  projectId: string;
  initialTitle: string;
  initialDescription: string;
  initialCharacterSheet: unknown;
  initialAestheticBible: unknown;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("structured");
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);

  // Structured state
  const [characters, setCharacters] = useState<CharacterRow[]>(() =>
    normalizeCharacters(initialCharacterSheet),
  );
  const [setting, setSetting] = useState(() =>
    normalizeSetting(initialCharacterSheet),
  );
  const [bible, setBible] = useState(() =>
    normalizeBible(initialAestheticBible),
  );

  // Raw JSON fallback state (kept in sync via effect on tab switch)
  const [rawSheet, setRawSheet] = useState(
    JSON.stringify(initialCharacterSheet ?? {}, null, 2),
  );
  const [rawBible, setRawBible] = useState(
    JSON.stringify(initialAestheticBible ?? {}, null, 2),
  );

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const currentSheet = useMemo(
    () => buildCharacterSheet(characters, setting),
    [characters, setting],
  );
  const currentBible = useMemo(() => buildAestheticBible(bible), [bible]);

  const switchMode = useCallback(
    (to: Mode) => {
      if (to === "raw") {
        // Seed the textareas with the latest structured state so
        // users see their edits when they flip to raw.
        setRawSheet(JSON.stringify(currentSheet, null, 2));
        setRawBible(JSON.stringify(currentBible, null, 2));
      } else {
        // Returning to structured — parse raw back into the form.
        try {
          const s = JSON.parse(rawSheet);
          setCharacters(normalizeCharacters(s));
          setSetting(normalizeSetting(s));
        } catch {
          /* leave structured state alone if raw is malformed */
        }
        try {
          const b = JSON.parse(rawBible);
          setBible(normalizeBible(b));
        } catch {
          /* same */
        }
      }
      setMode(to);
    },
    [currentSheet, currentBible, rawSheet, rawBible],
  );

  const save = async () => {
    setError(null);
    setSaved(false);

    let characterSheet: CharacterSheet;
    let aestheticBible: AestheticBible;

    if (mode === "raw") {
      try {
        characterSheet = JSON.parse(rawSheet) as CharacterSheet;
      } catch (err) {
        setError(`character_sheet JSON invalid: ${(err as Error).message}`);
        return;
      }
      try {
        aestheticBible = JSON.parse(rawBible) as AestheticBible;
      } catch (err) {
        setError(`aesthetic_bible JSON invalid: ${(err as Error).message}`);
        return;
      }
    } else {
      characterSheet = currentSheet;
      aestheticBible = currentBible;
    }

    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          character_sheet: characterSheet,
          aesthetic_bible: aestheticBible,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Core fields always shown */}
      <label className="flex flex-col gap-1">
        <span className="font-hand text-sepia-deep">title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="w-full h-12 px-4 bg-paper-deep border border-ink/20 font-display text-2xl text-ink focus:outline-none focus:border-ink"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-hand text-sepia-deep">description</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          maxLength={2000}
          className="w-full px-4 py-3 bg-paper-deep border border-ink/20 font-body text-ink focus:outline-none focus:border-ink resize-none"
        />
      </label>

      <div className="rule-ink" />

      {/* Mode tabs */}
      <div className="flex border-b border-ink/10">
        {(["structured", "raw"] as Mode[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMode(m)}
            className={`flex-1 px-4 py-2 font-body text-sm tracking-wide transition-colors ${
              mode === m
                ? "text-ink border-b-2 border-ink -mb-px"
                : "text-ink-soft hover:text-ink"
            }`}
          >
            {m === "structured" ? "structured" : "raw JSON"}
          </button>
        ))}
      </div>

      {mode === "structured" ? (
        <StructuredEditor
          projectId={projectId}
          characters={characters}
          setCharacters={setCharacters}
          setting={setting}
          setSetting={setSetting}
          bible={bible}
          setBible={setBible}
        />
      ) : (
        <RawEditor
          rawSheet={rawSheet}
          setRawSheet={setRawSheet}
          rawBible={rawBible}
          setRawBible={setRawBible}
        />
      )}

      <div className="flex items-center gap-3 mt-2 flex-wrap">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="px-5 h-11 bg-ink text-paper font-body tracking-wide hover:bg-ink-soft disabled:opacity-40 disabled:cursor-wait transition-colors"
        >
          {busy ? "Saving…" : "Save →"}
        </button>
        {saved ? (
          <span className="font-hand text-sepia-deep">saved</span>
        ) : null}
        {error ? (
          <span className="font-hand text-red-grease">{error}</span>
        ) : null}
      </div>

      <p className="font-body text-xs text-ink-soft/60 leading-relaxed">
        The character sheet and aesthetic bible are stringified and appended
        to every user message under <code className="font-mono">PROJECT CONTEXT:</code>
        {" "}so the director always has them in recent attention.
      </p>
    </div>
  );
}

// ------------------------------------------------------------------
// Structured mode — labeled forms
// ------------------------------------------------------------------

function StructuredEditor({
  projectId,
  characters,
  setCharacters,
  setting,
  setSetting,
  bible,
  setBible,
}: {
  projectId: string;
  characters: CharacterRow[];
  setCharacters: React.Dispatch<React.SetStateAction<CharacterRow[]>>;
  setting: { primary: string; recurring_symbol: string };
  setSetting: React.Dispatch<
    React.SetStateAction<{ primary: string; recurring_symbol: string }>
  >;
  bible: ReturnType<typeof normalizeBible>;
  setBible: React.Dispatch<React.SetStateAction<ReturnType<typeof normalizeBible>>>;
}) {
  const addCharacter = () =>
    setCharacters((prev) => [...prev, emptyCharacter()]);
  const removeCharacter = (i: number) =>
    setCharacters((prev) => prev.filter((_, idx) => idx !== i));
  const updateCharacter = (i: number, field: keyof CharacterRow, v: string) =>
    setCharacters((prev) =>
      prev.map((c, idx) => (idx === i ? { ...c, [field]: v } : c)),
    );

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-2xl text-ink">characters</h2>
          <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/50">
            {characters.length} {characters.length === 1 ? "character" : "characters"}
          </span>
        </div>

        {characters.length === 0 ? (
          <div className="bg-paper-deep px-4 py-6 text-center font-body text-sm text-ink-soft">
            No characters yet. Add one to start building the cast.
          </div>
        ) : null}

        {characters.map((c, i) => (
          <div
            key={i}
            className="bg-paper-deep px-4 py-4 flex flex-col gap-3 border border-ink/10"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-hand text-sepia-deep text-base">
                character #{i + 1}
              </span>
              <button
                type="button"
                onClick={() => removeCharacter(i)}
                aria-label={`Remove character ${i + 1}`}
                className="w-11 h-9 font-display text-lg text-red-grease/70 hover:text-red-grease transition-colors"
              >
                &times;
              </button>
            </div>

            <Row>
              <LabeledInput
                label="name"
                value={c.name}
                placeholder="David"
                onChange={(v) => updateCharacter(i, "name", v)}
              />
              <LabeledInput
                label="age"
                value={c.age}
                placeholder="mid-30s"
                onChange={(v) => updateCharacter(i, "age", v)}
              />
            </Row>
            <Row>
              <LabeledInput
                label="ethnicity"
                value={c.ethnicity}
                onChange={(v) => updateCharacter(i, "ethnicity", v)}
              />
              <LabeledInput
                label="demeanor"
                value={c.demeanor}
                placeholder="exhausted rather than angry"
                onChange={(v) => updateCharacter(i, "demeanor", v)}
              />
            </Row>
            <LabeledTextarea
              label="appearance"
              value={c.appearance}
              rows={2}
              onChange={(v) => updateCharacter(i, "appearance", v)}
            />
            <LabeledTextarea
              label="wardrobe"
              value={c.wardrobe}
              rows={2}
              onChange={(v) => updateCharacter(i, "wardrobe", v)}
            />
            <LabeledTextarea
              label="voice"
              value={c.voice}
              rows={2}
              placeholder="Low baritone, raspy; Oscar Isaac's quieter register"
              onChange={(v) => updateCharacter(i, "voice", v)}
            />

            {c.name.trim().length > 0 ? (
              <ReferenceStrip
                projectId={projectId}
                target={`character:${c.name.trim()}`}
                label={`${c.name.trim()} references`}
                initialPaths={c.reference_images}
              />
            ) : (
              <p className="font-body text-xs text-ink-soft/60 italic">
                Give this character a name to attach reference images.
              </p>
            )}
          </div>
        ))}

        <button
          type="button"
          onClick={addCharacter}
          className="self-start px-4 h-11 bg-paper border border-ink text-ink font-body text-sm tracking-wide hover:bg-paper-deep transition-colors"
        >
          + add character
        </button>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl text-ink">setting</h2>
        <LabeledTextarea
          label="primary"
          value={setting.primary}
          rows={3}
          placeholder="Small urban apartment — warm tungsten lighting, exposed brick…"
          onChange={(v) => setSetting((s) => ({ ...s, primary: v }))}
        />
        <LabeledInput
          label="recurring symbol"
          value={setting.recurring_symbol}
          placeholder="Framed occult sigil print on the wall"
          onChange={(v) => setSetting((s) => ({ ...s, recurring_symbol: v }))}
        />
      </section>

      <div className="rule-ink" />

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl text-ink">aesthetic bible</h2>
        <Row>
          <LabeledInput
            label="visual style"
            value={bible.visual_style}
            placeholder="Cinematic 35mm film grain, A24 naturalism"
            onChange={(v) => setBible((b) => ({ ...b, visual_style: v }))}
          />
          <LabeledInput
            label="palette"
            value={bible.palette}
            placeholder="Muted desaturated, warm tungsten + cool blue"
            onChange={(v) => setBible((b) => ({ ...b, palette: v }))}
          />
        </Row>
        <Row>
          <LabeledInput
            label="camera"
            value={bible.camera}
            placeholder="Handheld, slight movement, shallow DOF"
            onChange={(v) => setBible((b) => ({ ...b, camera: v }))}
          />
          <LabeledInput
            label="aspect ratio"
            value={bible.aspect_ratio}
            placeholder="9:16"
            onChange={(v) => setBible((b) => ({ ...b, aspect_ratio: v }))}
          />
        </Row>
        <LabeledTextarea
          label="audio signature"
          value={bible.audio_signature}
          rows={2}
          placeholder="Low ominous synth drone, unison VO on philosophical reveals"
          onChange={(v) => setBible((b) => ({ ...b, audio_signature: v }))}
        />

        <ListEditor
          label="thematic motifs"
          items={bible.thematic_motifs}
          placeholder="Cigarette on balcony as observer moment"
          onChange={(next) => setBible((b) => ({ ...b, thematic_motifs: next }))}
        />
        <ListEditor
          label="forbidden"
          items={bible.forbidden}
          placeholder="Bright saturated colors"
          tone="red"
          onChange={(next) => setBible((b) => ({ ...b, forbidden: next }))}
        />

        <ReferenceStrip
          projectId={projectId}
          target="bible"
          label="mood board"
          initialPaths={bible.reference_images}
        />
        <p className="font-body text-xs text-ink-soft/60 leading-relaxed -mt-1">
          Stills, paintings, screenshots — anything you want the director to
          treat as the visual source of truth. The next chat turn will see
          these alongside the text fields above.
        </p>
      </section>
    </div>
  );
}

// ------------------------------------------------------------------
// Raw JSON mode — escape hatch
// ------------------------------------------------------------------

function RawEditor({
  rawSheet,
  setRawSheet,
  rawBible,
  setRawBible,
}: {
  rawSheet: string;
  setRawSheet: (v: string) => void;
  rawBible: string;
  setRawBible: (v: string) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1">
        <span className="font-hand text-sepia-deep">
          character sheet (JSON)
        </span>
        <textarea
          value={rawSheet}
          onChange={(e) => setRawSheet(e.target.value)}
          rows={14}
          spellCheck={false}
          className="w-full px-4 py-3 bg-paper-deep border border-ink/20 font-mono text-sm text-ink focus:outline-none focus:border-ink resize-y"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="font-hand text-sepia-deep">
          aesthetic bible (JSON)
        </span>
        <textarea
          value={rawBible}
          onChange={(e) => setRawBible(e.target.value)}
          rows={12}
          spellCheck={false}
          className="w-full px-4 py-3 bg-paper-deep border border-ink/20 font-mono text-sm text-ink focus:outline-none focus:border-ink resize-y"
        />
      </label>
    </div>
  );
}

// ------------------------------------------------------------------
// Small building blocks
// ------------------------------------------------------------------

function Row({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{children}</div>;
}

function LabeledInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-hand text-sepia-deep text-sm">{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full h-11 px-3 bg-paper border border-ink/20 focus:border-ink font-body text-ink outline-none transition-colors"
      />
    </label>
  );
}

function LabeledTextarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="font-hand text-sepia-deep text-sm">{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 bg-paper border border-ink/20 focus:border-ink font-body text-ink outline-none resize-none transition-colors"
      />
    </label>
  );
}

function ListEditor({
  label,
  items,
  onChange,
  placeholder,
  tone = "default",
}: {
  label: string;
  items: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  tone?: "default" | "red";
}) {
  const add = () => onChange([...items, ""]);
  const remove = (i: number) => onChange(items.filter((_, idx) => idx !== i));
  const update = (i: number, v: string) =>
    onChange(items.map((it, idx) => (idx === i ? v : it)));

  return (
    <div className="flex flex-col gap-2">
      <span className="font-hand text-sepia-deep text-sm">{label}</span>
      {items.length === 0 ? (
        <p className="font-body text-xs text-ink-soft/60 -mt-1">
          none yet
        </p>
      ) : null}
      {items.map((v, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            value={v}
            onChange={(e) => update(i, e.target.value)}
            placeholder={placeholder}
            className={`flex-1 h-10 px-3 bg-paper border font-body text-ink outline-none transition-colors ${
              tone === "red"
                ? "border-red-grease/40 focus:border-red-grease"
                : "border-ink/20 focus:border-ink"
            }`}
          />
          <button
            type="button"
            onClick={() => remove(i)}
            aria-label={`Remove ${label} item ${i + 1}`}
            className="w-11 h-10 font-display text-lg text-ink-soft/60 hover:text-red-grease transition-colors"
          >
            &times;
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="self-start px-3 h-10 bg-paper border border-ink/30 text-ink-soft hover:text-ink hover:border-ink font-body text-xs uppercase tracking-widest transition-colors"
      >
        + add
      </button>
    </div>
  );
}
