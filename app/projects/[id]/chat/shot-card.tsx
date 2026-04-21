"use client";

import { useState } from "react";
import type { ShotPrompt } from "@/lib/shot-prompt";

/**
 * Inline card rendered in place of a ```json-shot code block.
 *
 * Generate handler is wired from Workspace so the timeline updates
 * optimistically when tapped.
 */
export function ShotCard({
  shot,
  onGenerate,
}: {
  shot: ShotPrompt;
  onGenerate?: (shot: ShotPrompt) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const handleGenerate = async () => {
    if (!onGenerate || busy) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.([10, 30, 10]);
    }
    setBusy(true);
    try {
      await onGenerate(shot);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="my-4 border border-ink/30 bg-paper">
      <header className="flex items-center justify-between px-4 py-2 bg-paper-deep border-b border-ink/20">
        <div className="flex items-center gap-3">
          <span className="font-hand text-sepia-deep text-lg leading-none">
            shot
          </span>
          <span className="font-display text-xl text-ink leading-none">
            #{shot.shot_number}
          </span>
        </div>
        <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/70">
          {shot.duration}s · seed:{shot.suggested_seed_behavior}
        </span>
      </header>

      <div className="px-4 py-3 space-y-3">
        <p className="font-mono text-sm text-ink whitespace-pre-wrap leading-relaxed">
          {shot.prompt}
        </p>

        {shot.continuity_notes ? (
          <p className="font-hand text-base text-sepia-deep leading-snug">
            <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60 mr-2">
              continuity
            </span>
            {shot.continuity_notes}
          </p>
        ) : null}

        {shot.voice_direction ? (
          <p className="font-hand text-base text-sepia-deep leading-snug">
            <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60 mr-2">
              voice
            </span>
            {shot.voice_direction}
          </p>
        ) : null}
      </div>

      <footer className="flex items-center justify-between px-4 py-2 border-t border-ink/20">
        <p className="font-hand text-sm text-ink-soft/70">
          seeds from the last completed shot by default
        </p>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!onGenerate || busy}
          className="px-4 py-1.5 bg-ink text-paper font-body text-sm tracking-wide hover:bg-ink-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {busy ? "Queueing…" : "Generate →"}
        </button>
      </footer>
    </div>
  );
}
