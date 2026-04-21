"use client";

import { useEffect, useState } from "react";
import type { TimelineClip } from "./types";

const STATUS_COPY: Record<TimelineClip["status"], string> = {
  queued: "queued",
  processing: "rendering",
  complete: "complete",
  failed: "failed",
};

export function ClipCard({
  clip,
  index,
  onOpen,
}: {
  clip: TimelineClip;
  index: number;
  onOpen: () => void;
}) {
  // Fetch a signed URL for the last-frame thumbnail when a clip completes.
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setThumbUrl(null);
    if (clip.status !== "complete") return;
    if (clip.id.startsWith("pending-")) return;
    (async () => {
      try {
        const res = await fetch(`/api/clips/${clip.id}/signed-url?kind=last_frame`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as { url?: string };
        if (!cancelled && body.url) setThumbUrl(body.url);
      } catch {
        // no-op; the card falls back to the shot-number badge
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clip.id, clip.status]);

  const shotNumber = clip.shot_metadata?.shot_number ?? index + 1;
  const isPending = clip.id.startsWith("pending-");
  const statusTone =
    clip.status === "complete"
      ? "text-ink-soft"
      : clip.status === "failed"
      ? "text-red-grease"
      : "text-sepia-deep";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Open shot ${shotNumber}`}
      disabled={isPending}
      className="group relative w-32 h-56 shrink-0 bg-paper-deep border border-ink/20 overflow-hidden hover:border-ink/60 transition-colors text-left disabled:cursor-default"
    >
      {thumbUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt={`Shot ${shotNumber} thumbnail`}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : clip.status === "processing" || clip.status === "queued" ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-ink/40 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : clip.status === "failed" ? (
        <div className="absolute inset-0 flex items-center justify-center text-red-grease font-display text-5xl">
          ✕
        </div>
      ) : null}

      {/* Overlay with shot number + status — always on top of thumbnail */}
      <div className="absolute inset-x-0 top-0 px-2.5 py-1.5 flex items-center justify-between bg-gradient-to-b from-paper/90 to-transparent">
        <span className="font-display text-base text-ink">#{shotNumber}</span>
        <span
          className={`font-body text-[10px] uppercase tracking-widest ${statusTone}`}
        >
          {STATUS_COPY[clip.status]}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 px-2.5 py-1.5 bg-gradient-to-t from-paper/90 to-transparent">
        <p className="font-hand text-sm text-ink-soft line-clamp-2 leading-tight">
          {clip.prompt}
        </p>
      </div>
    </button>
  );
}
