"use client";

import { useCallback, useState } from "react";
import type { TimelineClip } from "../timeline/types";
import { MaeGlyph } from "@/app/components/mythic-glyphs";
import { SceneCard } from "./scene-card";
import type { ImageModelId, AnimationModelId } from "@/lib/models";

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
    async (clip: TimelineClip, modelId?: ImageModelId) => {
      setError(null);
      setBusyId(clip.id);
      try {
        const res = await fetch("/api/stills/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            clip_id: clip.id,
            ...(modelId ? { model_id: modelId } : {}),
          }),
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
    async (clip: TimelineClip, modelId?: AnimationModelId) => {
      setError(null);
      setBusyId(clip.id);
      try {
        const res = await fetch(`/api/clips/${clip.id}/animate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(modelId ? { model_id: modelId } : {}),
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

  const patchClip = useCallback(
    async (id: string, partial: Partial<TimelineClip>) => {
      patch(id, partial);
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

      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
        {clips.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
            <span className="text-sepia-deep/60 animate-icon-wiggle">
              <MaeGlyph size={36} />
            </span>
            <p className="font-display text-base text-ink">
              The board is quiet.
            </p>
            <p className="max-w-[28ch] font-body text-sm text-ink-soft/80 leading-relaxed">
              Ari holds the thread on the left. When she emits scenes,
              they land here ready for the rite —{" "}
              <span className="font-hand text-sepia-deep">a still, a clip,
              a cut</span>.
            </p>
          </div>
        ) : (
          clips.map((clip) => (
            <SceneCard
              key={clip.id}
              clip={clip}
              busy={busyId === clip.id}
              onGenerateStill={(modelId) => generateStill(clip, modelId)}
              onAnimate={(modelId) => animate(clip, modelId)}
              onPatchClip={patchClip}
            />
          ))
        )}
      </div>
    </div>
  );
}

// SceneRow has been replaced by the tabbed SceneCard in ./scene-card.
