"use client";

import { useEffect, useState } from "react";
import type { TimelineClip } from "./types";

/**
 * Grid of generated stills for a project. Each tile is the Flux
 * output for a scene, labeled by shot number. Tapping a tile opens
 * the full clip detail sheet (same as the timeline).
 *
 * Hidden entirely when there are no stills to show — keeps the
 * workspace uncluttered until Dio has drafted at least one scene
 * with an image_prompt.
 */
export function StillsPanel({
  clips,
  onOpen,
}: {
  clips: TimelineClip[];
  onOpen: (clipId: string) => void;
}) {
  const scenes = clips.filter(
    (c) => c.still_status && c.still_status !== "none",
  );
  if (scenes.length === 0) return null;

  return (
    <section className="mb-6 scroll-mt-20" id="stills">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-hand text-lg text-sepia-deep">stills</h2>
        <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/50">
          {scenes.filter((s) => s.still_status === "complete").length} / {scenes.length} ready
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        {scenes.map((clip) => (
          <StillTile key={clip.id} clip={clip} onOpen={() => onOpen(clip.id)} />
        ))}
      </div>
    </section>
  );
}

function StillTile({
  clip,
  onOpen,
}: {
  clip: TimelineClip;
  onOpen: () => void;
}) {
  const [signed, setSigned] = useState<string | null>(null);

  useEffect(() => {
    if (clip.still_status !== "complete") return;
    if (clip.id.startsWith("pending-")) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/clips/${clip.id}/signed-url?kind=still`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const body = (await res.json()) as { url?: string };
        if (!cancelled && body.url) setSigned(body.url);
      } catch {
        /* retry on next mount */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clip.id, clip.still_status]);

  const shotNumber = clip.shot_metadata?.shot_number ?? clip.order_index + 1;
  const status = clip.still_status;
  const isBusy = status === "queued" || status === "processing";
  const failed = status === "failed";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open scene ${shotNumber}`}
      className="relative aspect-[9/16] w-full bg-paper-deep border border-ink/20 overflow-hidden hover:border-ink/60 transition-colors text-left"
    >
      {status === "complete" && signed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={signed}
          alt={`Scene ${shotNumber} still`}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : isBusy ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-ink/40 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : failed ? (
        <div className="absolute inset-0 flex items-center justify-center text-red-grease font-display text-3xl">
          ✕
        </div>
      ) : null}

      <div className="absolute inset-x-0 top-0 px-2 py-1.5 flex items-center justify-between bg-gradient-to-b from-paper/90 to-transparent">
        <span className="font-display text-sm text-ink">#{shotNumber}</span>
        <span
          className={`font-body text-[9px] uppercase tracking-widest ${
            failed
              ? "text-red-grease"
              : status === "complete"
              ? "text-ink-soft"
              : "text-sepia-deep"
          }`}
        >
          {status}
        </span>
      </div>
    </button>
  );
}
