"use client";

import { useCallback, useState } from "react";
import type { ShotPrompt } from "@/lib/shot-prompt";

/**
 * Scene card rendered in place of a ```json-shot fence.
 *
 * Two sequential actions per scene:
 *   1. Generate still — calls Flux via /api/stills/generate and
 *      renders the preview when it lands.
 *   2. Animate — calls /api/generate using the still as the seed
 *      and hands off to the workspace timeline.
 *
 * Narration is copyable but not auto-generated.
 */
export function ShotCard({
  shot,
  onGenerate,
}: {
  shot: ShotPrompt;
  /**
   * Legacy single-shot generate callback from the workspace. Kept so
   * existing chats without an image_prompt still animate cleanly
   * (user generates directly without a separate still step).
   */
  onGenerate?: (shot: ShotPrompt) => Promise<void>;
}) {
  const [stillStatus, setStillStatus] = useState<
    "idle" | "working" | "ready" | "failed"
  >("idle");
  const [stillUrl, setStillUrl] = useState<string | null>(null);
  const [stillError, setStillError] = useState<string | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);

  const hasImagePrompt = Boolean(
    shot.image_prompt && shot.image_prompt.length > 0,
  );

  const generateStill = useCallback(async () => {
    if (!hasImagePrompt || stillStatus === "working") return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.(10);
    }
    setStillStatus("working");
    setStillError(null);
    try {
      const res = await fetch("/api/stills/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // project_id pulled from URL server-side (but we need to
          // pass it). Grab it from window location.
          project_id: window.location.pathname.split("/")[2],
          shot,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      setStillUrl(body.still_image_url as string);
      setStillStatus("ready");
    } catch (err) {
      setStillError(err instanceof Error ? err.message : String(err));
      setStillStatus("failed");
    }
  }, [hasImagePrompt, shot, stillStatus]);

  const animate = useCallback(async () => {
    if (!onGenerate || videoBusy) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.([10, 30, 10]);
    }
    setVideoBusy(true);
    try {
      await onGenerate(shot);
    } finally {
      setVideoBusy(false);
    }
  }, [onGenerate, shot, videoBusy]);

  return (
    <div className="my-4 border border-ink/30 bg-paper">
      <header className="flex items-center justify-between px-4 py-2 bg-paper-deep border-b border-ink/20">
        <div className="flex items-center gap-3">
          <span className="font-hand text-sepia-deep text-lg leading-none">
            scene
          </span>
          <span className="font-display text-xl text-ink leading-none">
            #{shot.shot_number}
          </span>
        </div>
        <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/70">
          {shot.duration}s
        </span>
      </header>

      <div className="px-4 py-3 space-y-4">
        {/* Image prompt — for Flux */}
        {hasImagePrompt ? (
          <section>
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="font-body text-[10px] uppercase tracking-widest text-ink-soft/70">
                image prompt
              </h3>
              <span className="font-hand text-sm text-sepia-deep">
                the still
              </span>
            </div>
            <p className="font-mono text-sm text-ink whitespace-pre-wrap leading-relaxed">
              {shot.image_prompt}
            </p>
          </section>
        ) : null}

        {/* Video / motion prompt — for Seedance */}
        <section>
          <div className="flex items-baseline justify-between mb-1">
            <h3 className="font-body text-[10px] uppercase tracking-widest text-ink-soft/70">
              animation prompt
            </h3>
            <span className="font-hand text-sm text-sepia-deep">
              what moves
            </span>
          </div>
          <p className="font-mono text-sm text-ink whitespace-pre-wrap leading-relaxed">
            {shot.prompt}
          </p>
        </section>

        {/* Narration */}
        {shot.narration && shot.narration.length > 0 ? (
          <section>
            <div className="flex items-baseline justify-between mb-1">
              <h3 className="font-body text-[10px] uppercase tracking-widest text-ink-soft/70">
                narration
              </h3>
              <span className="font-hand text-sm text-sepia-deep">
                voiceover
              </span>
            </div>
            <p className="font-hand text-lg text-ink leading-snug whitespace-pre-wrap">
              {shot.narration}
            </p>
          </section>
        ) : null}

        {/* Still preview once Flux lands */}
        {stillStatus === "ready" && stillUrl ? (
          <div className="border border-ink/10 bg-paper-deep p-2">
            <p className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60 mb-2">
              still · ready to animate
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={stillUrl}
              alt={`Scene ${shot.shot_number} still`}
              className="w-full max-h-[50vh] object-contain bg-black"
            />
          </div>
        ) : null}

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

      <footer className="flex items-center justify-between gap-3 px-4 py-2 border-t border-ink/20 flex-wrap">
        <p className="font-hand text-sm text-ink-soft/70">
          {stillStatus === "ready"
            ? "still ready — tap animate"
            : hasImagePrompt
            ? "stage 1: generate the still"
            : "seeds from the last completed shot by default"}
        </p>
        <div className="flex gap-2">
          {hasImagePrompt ? (
            <button
              type="button"
              onClick={generateStill}
              disabled={stillStatus === "working" || stillStatus === "ready"}
              className={`px-4 py-1.5 font-body text-sm tracking-wide transition-colors ${
                stillStatus === "ready"
                  ? "bg-paper border border-sepia-deep text-sepia-deep cursor-default"
                  : stillStatus === "working"
                  ? "bg-ink text-paper opacity-60 cursor-wait"
                  : "bg-ink text-paper hover:bg-ink-soft"
              }`}
            >
              {stillStatus === "working"
                ? "rendering still…"
                : stillStatus === "ready"
                ? "still ✓"
                : "Generate still →"}
            </button>
          ) : null}
          <button
            type="button"
            onClick={animate}
            disabled={
              !onGenerate ||
              videoBusy ||
              (hasImagePrompt && stillStatus !== "ready")
            }
            className="px-4 py-1.5 bg-ink text-paper font-body text-sm tracking-wide hover:bg-ink-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {videoBusy ? "Queueing…" : hasImagePrompt ? "Animate →" : "Generate →"}
          </button>
        </div>
      </footer>

      {stillError ? (
        <p
          aria-live="polite"
          className="px-4 py-2 font-hand text-red-grease border-t border-ink/20"
        >
          {stillError}
        </p>
      ) : null}
    </div>
  );
}
