"use client";

import { useCallback, useMemo, useState } from "react";
import type { TimelineClip } from "../timeline/types";

/**
 * Storyboard approval grid — a 9:16 tile per clip with Regenerate /
 * Approve / Animate actions. Animate is gated by approval so you can't
 * accidentally burn a video render on a rough still.
 *
 * Generate-all-missing fires stills sequentially with a small delay so
 * the spend cap/rate limits stay sane.
 */
export function StoryboardGrid({
  projectId,
  initialClips,
}: {
  projectId: string;
  initialClips: TimelineClip[];
}) {
  const [clips, setClips] = useState<TimelineClip[]>(initialClips);
  const [busy, setBusy] = useState<Record<string, string | null>>({});
  const [error, setError] = useState<string | null>(null);

  const patch = useCallback(
    (id: string, partial: Partial<TimelineClip>) => {
      setClips((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...partial } : c)),
      );
    },
    [],
  );

  const setBusyFor = useCallback(
    (id: string, action: string | null) =>
      setBusy((prev) => ({ ...prev, [id]: action })),
    [],
  );

  const regenerateStill = useCallback(
    async (clip: TimelineClip) => {
      setError(null);
      setBusyFor(clip.id, "regen");
      try {
        const res = await fetch("/api/stills/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            clip_id: clip.id,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Still generation failed");
        patch(clip.id, {
          still_image_url: data.still_image_url,
          still_status: "complete",
          still_approved: false,
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusyFor(clip.id, null);
      }
    },
    [projectId, patch, setBusyFor],
  );

  const toggleApprove = useCallback(
    async (clip: TimelineClip) => {
      setError(null);
      setBusyFor(clip.id, "approve");
      const nextApproved = !clip.still_approved;
      patch(clip.id, { still_approved: nextApproved });
      try {
        const res = await fetch(`/api/clips/${clip.id}/approve-still`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ approved: nextApproved }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data?.error || "Approve failed");
        }
      } catch (err) {
        patch(clip.id, { still_approved: !nextApproved });
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusyFor(clip.id, null);
      }
    },
    [patch, setBusyFor],
  );

  const animate = useCallback(
    async (clip: TimelineClip) => {
      setError(null);
      setBusyFor(clip.id, "animate");
      try {
        const res = await fetch(`/api/clips/${clip.id}/animate`, {
          method: "POST",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "Animate failed");
        patch(clip.id, { status: "queued" });
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusyFor(clip.id, null);
      }
    },
    [patch, setBusyFor],
  );

  const generateAllMissing = useCallback(async () => {
    setError(null);
    const targets = clips.filter(
      (c) =>
        !c.still_image_url &&
        (c.still_status === "none" ||
          c.still_status === "queued" ||
          c.still_status === "failed"),
    );
    for (const c of targets) {
      await regenerateStill(c);
      // Space out by 1s so we don't trip the hourly rate limit on
      // huge projects.
      await new Promise((r) => setTimeout(r, 1000));
    }
  }, [clips, regenerateStill]);

  const approvedCount = useMemo(
    () => clips.filter((c) => c.still_approved).length,
    [clips],
  );

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={generateAllMissing}
          className="rounded-full border border-ink/25 bg-paper px-3 py-1.5 font-body text-xs uppercase tracking-widest text-ink transition-colors hover:bg-ink/5"
        >
          Generate missing stills
        </button>
        <span className="font-body text-xs text-ink-soft/70">
          {approvedCount}/{clips.length} approved
        </span>
        {error ? (
          <span className="font-body text-xs text-red-600" role="alert">
            {error}
          </span>
        ) : null}
      </div>

      {clips.length === 0 ? (
        <div className="mt-8 rounded-lg border border-dashed border-ink/20 p-8 text-center">
          <p className="font-body text-sm text-ink-soft/70">
            No scenes yet. Draft shots with Dio from the project page.
          </p>
        </div>
      ) : (
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {clips.map((clip) => {
            const b = busy[clip.id] ?? null;
            const stillBusy = b === "regen" || clip.still_status === "processing";
            return (
              <li
                key={clip.id}
                className="group overflow-hidden rounded-lg border border-ink/15 bg-paper animate-lift"
              >
                <div className="relative aspect-[9/16] w-full bg-ink/5">
                  {clip.still_image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={clip.still_image_url}
                      alt={`Shot ${clip.order_index + 1}`}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center px-2 text-center">
                      <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
                        {stillBusy ? "Drawing…" : "No still yet"}
                      </span>
                    </div>
                  )}

                  <div className="absolute left-1.5 top-1.5 rounded-full bg-paper/90 px-2 py-0.5 font-display text-[10px] uppercase tracking-widest text-ink">
                    #{clip.order_index + 1}
                  </div>
                  {clip.still_approved ? (
                    <div className="absolute right-1.5 top-1.5 rounded-full bg-emerald-600/90 px-2 py-0.5 font-display text-[10px] uppercase tracking-widest text-white">
                      ✓ OK
                    </div>
                  ) : null}
                </div>

                <div className="p-2">
                  <p className="line-clamp-2 font-body text-xs text-ink-soft">
                    {clip.prompt}
                  </p>
                  <div className="mt-2 flex gap-1">
                    <button
                      type="button"
                      onClick={() => regenerateStill(clip)}
                      disabled={stillBusy}
                      className="flex-1 rounded border border-ink/20 bg-paper py-1 font-body text-[10px] uppercase tracking-widest text-ink transition-colors hover:bg-ink/5 disabled:opacity-50"
                    >
                      {stillBusy ? "…" : clip.still_image_url ? "Redraw" : "Draw"}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleApprove(clip)}
                      disabled={!clip.still_image_url || b === "approve"}
                      className={`flex-1 rounded border py-1 font-body text-[10px] uppercase tracking-widest transition-colors disabled:opacity-50 ${
                        clip.still_approved
                          ? "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700"
                          : "border-ink/20 bg-paper text-ink hover:bg-ink/5"
                      }`}
                    >
                      {clip.still_approved ? "Unapprove" : "Approve"}
                    </button>
                    <button
                      type="button"
                      onClick={() => animate(clip)}
                      disabled={
                        !clip.still_approved ||
                        b === "animate" ||
                        clip.status === "queued" ||
                        clip.status === "processing"
                      }
                      className="flex-1 rounded border border-ink/20 bg-ink py-1 font-body text-[10px] uppercase tracking-widest text-paper transition-colors hover:bg-ink/90 disabled:opacity-40"
                      title={
                        !clip.still_approved
                          ? "Approve the still first"
                          : "Animate this scene"
                      }
                    >
                      {clip.status === "queued" || clip.status === "processing"
                        ? "Running…"
                        : "Animate"}
                    </button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
