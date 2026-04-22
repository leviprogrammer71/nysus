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
   * Legacy single-shot generate callback from the workspace. Used
   * when a shot has no image_prompt — straight to Seedance with
   * whatever seed the workspace picks.
   */
  onGenerate?: (shot: ShotPrompt) => Promise<void>;
}) {
  const [stillStatus, setStillStatus] = useState<
    "idle" | "working" | "ready" | "failed"
  >("idle");
  const [stillUrl, setStillUrl] = useState<string | null>(null);
  const [stillError, setStillError] = useState<string | null>(null);
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  // Once the still is generated, we own the underlying clip row and
  // animate against IT rather than letting the workspace spin up a
  // new one. This is what keeps every scene pinned to a single clip
  // row with its still + its eventual video.
  const [clipId, setClipId] = useState<string | null>(null);

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
          project_id: window.location.pathname.split("/")[2],
          shot,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      setStillUrl(body.still_image_url as string);
      setClipId(body.clip_id as string);
      setStillStatus("ready");
    } catch (err) {
      setStillError(err instanceof Error ? err.message : String(err));
      setStillStatus("failed");
    }
  }, [hasImagePrompt, shot, stillStatus]);

  const animate = useCallback(async () => {
    if (videoBusy) return;
    if (typeof navigator !== "undefined" && "vibrate" in navigator) {
      navigator.vibrate?.([10, 30, 10]);
    }
    setVideoBusy(true);
    setVideoError(null);
    try {
      if (clipId) {
        // We've got a clip (from Generate still) — animate it in place.
        const res = await fetch(`/api/clips/${clipId}/animate`, {
          method: "POST",
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? res.statusText);
        // The workspace's polling + router.refresh will pick up the
        // new state automatically.
      } else if (onGenerate) {
        // No pre-generated still — fall back to the legacy one-shot
        // Seedance path the workspace owns.
        await onGenerate(shot);
      } else {
        throw new Error("Nothing to animate — generate a still first.");
      }
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : String(err));
    } finally {
      setVideoBusy(false);
    }
  }, [clipId, onGenerate, shot, videoBusy]);

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
              videoBusy ||
              // If this scene has an image_prompt, we need a still before
              // we can animate. If it doesn't, we rely on the legacy
              // workspace callback.
              (hasImagePrompt && stillStatus !== "ready") ||
              (!hasImagePrompt && !onGenerate)
            }
            className="px-4 py-1.5 bg-ink text-paper font-body text-sm tracking-wide hover:bg-ink-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {videoBusy ? "Queueing…" : hasImagePrompt ? "Animate →" : "Generate →"}
          </button>
        </div>
      </footer>

      {stillError || videoError ? (
        <p
          aria-live="polite"
          className="px-4 py-2 font-hand text-red-grease border-t border-ink/20"
        >
          {stillError ?? videoError}
        </p>
      ) : null}
    </div>
  );
}
