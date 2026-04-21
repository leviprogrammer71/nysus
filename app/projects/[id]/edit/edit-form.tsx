"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Raw JSON editor for character sheet + aesthetic bible. Keeping it
 * JSON-native avoids guessing at schema evolution — the director can
 * draft new keys freely and we'll render them later.
 */
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
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [characterSheetText, setCharacterSheetText] = useState(
    JSON.stringify(initialCharacterSheet ?? {}, null, 2),
  );
  const [aestheticBibleText, setAestheticBibleText] = useState(
    JSON.stringify(initialAestheticBible ?? {}, null, 2),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const save = async () => {
    setError(null);
    setSaved(false);

    let characterSheet: unknown;
    let aestheticBible: unknown;
    try {
      characterSheet = JSON.parse(characterSheetText);
    } catch (err) {
      setError(`character_sheet JSON invalid: ${(err as Error).message}`);
      return;
    }
    try {
      aestheticBible = JSON.parse(aestheticBibleText);
    } catch (err) {
      setError(`aesthetic_bible JSON invalid: ${(err as Error).message}`);
      return;
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
    <div className="flex flex-col gap-5">
      <label className="flex flex-col gap-1">
        <span className="font-hand text-sepia-deep">title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          className="w-full px-4 py-3 bg-paper-deep border border-ink/20 font-display text-2xl text-ink focus:outline-none focus:border-ink"
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

      <label className="flex flex-col gap-1">
        <span className="font-hand text-sepia-deep">character sheet (JSON)</span>
        <textarea
          value={characterSheetText}
          onChange={(e) => setCharacterSheetText(e.target.value)}
          rows={14}
          spellCheck={false}
          className="w-full px-4 py-3 bg-paper-deep border border-ink/20 font-mono text-sm text-ink focus:outline-none focus:border-ink resize-y"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-hand text-sepia-deep">aesthetic bible (JSON)</span>
        <textarea
          value={aestheticBibleText}
          onChange={(e) => setAestheticBibleText(e.target.value)}
          rows={12}
          spellCheck={false}
          className="w-full px-4 py-3 bg-paper-deep border border-ink/20 font-mono text-sm text-ink focus:outline-none focus:border-ink resize-y"
        />
      </label>

      <div className="flex items-center gap-3 mt-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="px-5 py-2.5 bg-ink text-paper font-body tracking-wide hover:bg-ink-soft disabled:opacity-40 disabled:cursor-wait transition-colors"
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

      <p className="font-body text-xs text-ink-soft/60 leading-relaxed mt-2">
        These two blocks get stringified and appended to every user message
        under <code className="font-mono">PROJECT CONTEXT:</code> so Claude
        always has them in recent attention. Keep them tight.
      </p>
    </div>
  );
}
