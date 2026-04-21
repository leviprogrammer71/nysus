"use client";

import type { ShotPrompt } from "@/lib/shot-prompt";

/**
 * Inline card rendered in place of a ```json-shot code block.
 *
 * The Generate button is disabled in Phase 3 (no backend yet) — lights
 * up in Phase 4 when /api/generate lands.
 */
export function ShotCard({ shot }: { shot: ShotPrompt }) {
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
          generation arrives in phase 4
        </p>
        <button
          type="button"
          disabled
          className="px-4 py-1.5 bg-ink text-paper font-body text-sm tracking-wide opacity-40 cursor-not-allowed"
          title="Seedance generation wires up in Phase 4"
        >
          Generate &rarr;
        </button>
      </footer>
    </div>
  );
}
