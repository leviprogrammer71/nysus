"use client";

import { useCallback, useState } from "react";
import type { TimelineClip } from "../timeline/types";
import { MaeGlyph } from "@/app/components/mythic-glyphs";

/**
 * Mae's pane is a silent execution board — no chat, no LLM, no
 * conversation. She's the rite-bearer: she does the work that's been
 * planned. The board lists every clip in the project, ordered by
 * scene number, each with:
 *   - the prompt + image prompt (collapsible)
 *   - a still preview if generated, with a Generate / Redraw button
 *   - an Animate button (gated on the still existing)
 *   - the rendered video when ready
 *
 * Scenes arrive here when Ari emits a json-shot in her chat AND the
 * user taps Generate-still on the card; that creates the clip row,
 * which this board picks up on its next poll.
 */
export function MaeBoard({
  projectId,
  clips: initialClips,
}: {
  projectId: string;
  clips: TimelineClip[];
}) {
  const [clips, setClips] = useState<TimelineClip[]>(initialClips);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback((id: string, partial: Partial<TimelineClip>) => {
    setClips((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...partial } : c)),
    );
  }, []);

  const generateStill = useCallback(
    async (clip: TimelineClip) => {
      setError(null);
      setBusyId(clip.id);
      try {
        const res = await fetch("/api/stills/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ project_id: projectId, clip_id: clip.id }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Still failed");
        patch(clip.id, {
          still_image_url: body.still_image_url,
          still_status: "complete",
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusyId(null);
      }
    },
    [projectId, patch],
  );

  const animate = useCallback(
    async (clip: TimelineClip) => {
      setError(null);
      setBusyId(clip.id);
      try {
        const res = await fetch(`/api/clips/${clip.id}/animate`, {
          method: "POST",
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Animate failed");
        patch(clip.id, { status: "queued" });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusyId(null);
      }
    },
    [patch],
  );

  return (
    <div className="flex flex-col rounded-lg border border-ink/10 bg-paper-deep h-[min(60svh,560px)] md:h-[min(70svh,720px)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-ink/10 bg-paper px-4 py-2.5">
        <div className="flex items-baseline gap-2">
          <MaeGlyph />
          <span className="font-display text-sm tracking-wider text-ink">
            Scenes
          </span>
          <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
            {clips.length} {clips.length === 1 ? "scene" : "scenes"}
          </span>
        </div>
        {error ? (
          <span
            className="font-body text-[11px] text-red-grease"
            role="alert"
            title={error}
          >
            {error.length > 40 ? `${error.slice(0, 40)}…` : error}
          </span>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {clips.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
            <p className="font-display text-base text-ink">
              No scenes yet.
            </p>
            <p className="font-body text-sm text-ink-soft/80 leading-relaxed">
              Ari drafts the cast and the aesthetic with you on the left,
              then emits scene cards. They&rsquo;ll land here ready to
              generate.
            </p>
          </div>
        ) : (
          clips.map((clip) => (
            <SceneRow
              key={clip.id}
              clip={clip}
              busy={busyId === clip.id}
              onGenerateStill={() => generateStill(clip)}
              onAnimate={() => animate(clip)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function SceneRow({
  clip,
  busy,
  onGenerateStill,
  onAnimate,
}: {
  clip: TimelineClip;
  busy: boolean;
  onGenerateStill: () => void;
  onAnimate: () => void;
}) {
  const [open, setOpen] = useState(false);
  const stillBusy = busy && clip.still_status !== "complete";
  const animateBusy = busy && clip.still_status === "complete";
  const animateLabel =
    clip.status === "queued" || clip.status === "processing"
      ? "Rendering…"
      : clip.status === "complete"
      ? "Re-animate"
      : "Animate →";

  return (
    <article className="surface-card animate-lift overflow-hidden rounded-lg">
      <div className="flex gap-3 p-3">
        {/* Still preview (or placeholder) */}
        <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md bg-ink/5">
          {clip.still_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clip.still_image_url}
              alt={`Scene ${clip.order_index + 1}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-body text-[10px] uppercase tracking-widest text-ink-soft/50">
              {stillBusy ? "…" : "no still"}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-[13px] text-ink">
              Scene {clip.order_index + 1}
            </span>
            <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
              {clip.status === "complete"
                ? "rendered"
                : clip.status === "processing" || clip.status === "queued"
                ? "rendering"
                : clip.still_status === "complete"
                ? "still ready"
                : "drafted"}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 font-body text-[12px] leading-snug text-ink-soft/85">
            {clip.prompt}
          </p>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-1 font-body text-[10px] uppercase tracking-widest text-ink-soft/60 hover:text-ink"
          >
            {open ? "hide details" : "details"}
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-ink/10 bg-paper/60 px-3 py-2 space-y-2 font-body text-[11px] leading-relaxed text-ink-soft/85">
          {clip.still_prompt ? (
            <div>
              <span className="font-body text-[9px] uppercase tracking-widest text-ink-soft/60">
                Image prompt
              </span>
              <p className="font-mono text-[11px] text-ink">
                {clip.still_prompt}
              </p>
            </div>
          ) : null}
          {clip.shot_metadata?.image_prompt &&
          !clip.still_prompt ? (
            <div>
              <span className="font-body text-[9px] uppercase tracking-widest text-ink-soft/60">
                Image prompt
              </span>
              <p className="font-mono text-[11px] text-ink">
                {clip.shot_metadata.image_prompt}
              </p>
            </div>
          ) : null}
          <div>
            <span className="font-body text-[9px] uppercase tracking-widest text-ink-soft/60">
              Animation prompt
            </span>
            <p className="font-mono text-[11px] text-ink">{clip.prompt}</p>
          </div>
          {clip.narration ? (
            <div>
              <span className="font-body text-[9px] uppercase tracking-widest text-ink-soft/60">
                Narration
              </span>
              <p className="font-hand text-[12px] text-sepia-deep">
                {clip.narration}
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      {clip.video_url && clip.status === "complete" ? (
        <video
          src={clip.video_url}
          controls
          playsInline
          webkit-playsinline="true"
          muted
          preload="metadata"
          className="w-full bg-ink/90"
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 border-t border-ink/10 bg-paper px-3 py-2">
        <button
          type="button"
          onClick={onGenerateStill}
          disabled={stillBusy}
          className="inline-flex h-9 items-center rounded-full border border-ink/25 bg-paper px-3 font-body text-[11px] uppercase tracking-widest text-ink hover:bg-ink/5 animate-press disabled:opacity-50"
        >
          {stillBusy
            ? "Drawing…"
            : clip.still_image_url
            ? "Redraw"
            : "Generate still"}
        </button>
        <button
          type="button"
          onClick={onAnimate}
          disabled={
            animateBusy ||
            !clip.still_image_url ||
            clip.status === "queued" ||
            clip.status === "processing"
          }
          title={
            !clip.still_image_url
              ? "Generate the still first"
              : "Animate this scene"
          }
          className="inline-flex h-9 items-center rounded-full bg-ink px-3 font-body text-[11px] uppercase tracking-widest text-paper hover:bg-ink-soft animate-press disabled:opacity-40"
        >
          {animateLabel}
        </button>
      </div>
    </article>
  );
}
