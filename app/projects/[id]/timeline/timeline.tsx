"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ClipCard } from "./clip-card";
import type { TimelineClip } from "./types";

export function Timeline({
  clips,
  onOpen,
}: {
  clips: TimelineClip[];
  onOpen: (clipId: string) => void;
}) {
  const router = useRouter();
  const [cleaning, setCleaning] = useState(false);
  // Stuck-detection uses wall-clock time, which is impure inside render.
  // Keep a ticking "now" in state so the logic stays React-pure.
  const [now, setNow] = useState<number>(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  // A clip shows up in the Videos timeline once a Seedance prediction
  // is actually in flight or done. Stills-only rows (from just
  // tapping Generate still) live in the Stills panel instead.
  const videoClips = useMemo(
    () =>
      clips.filter(
        (c) =>
          c.replicate_prediction_id ||
          c.status === "complete" ||
          c.status === "failed",
      ),
    [clips],
  );

  // Detect clips that have been queued/processing for more than 10 min
  // — the universal symptom of webhook-missed dev sessions.
  const stuck = useMemo(() => {
    const cutoff = now - 10 * 60 * 1000;
    return videoClips.filter(
      (c) =>
        (c.status === "queued" || c.status === "processing") &&
        new Date(c.created_at).getTime() < cutoff,
    );
  }, [videoClips, now]);

  const clearStuck = useCallback(async () => {
    if (cleaning) return;
    setCleaning(true);
    try {
      const projectId = videoClips[0]?.project_id;
      await fetch("/api/clips/cleanup-stuck", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(projectId ? { project_id: projectId } : {}),
      });
      router.refresh();
    } finally {
      setCleaning(false);
    }
  }, [cleaning, router, videoClips]);

  if (videoClips.length === 0) {
    return (
      <div className="bg-paper-deep px-6 py-6 flex flex-col sm:flex-row items-center justify-center gap-5 text-center sm:text-left">
        <div className="relative w-44 sm:w-56 animate-paper-drift shrink-0">
          <Image
            src="/illustrations/film-strips.png"
            alt="Film strips waiting to be cut"
            width={560}
            height={373}
            className="w-full h-auto mix-blend-multiply"
            sizes="(max-width: 640px) 44vw, 224px"
          />
        </div>
        <p className="font-hand text-base text-ink-soft/80 max-w-xs">
          clips will appear here as you generate them. ask Dio for a shot to
          begin, then tap{" "}
          <span className="font-hand text-sepia-deep">Animate</span> on a
          scene card.
        </p>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
      {stuck.length > 0 ? (
        <div className="mb-2 flex items-center justify-between gap-3 px-3 py-2 bg-paper-deep border border-sepia/40">
          <span className="font-hand text-sepia-deep text-sm">
            {stuck.length} {stuck.length === 1 ? "clip has" : "clips have"} been
            rendering for more than 10 minutes. Probably stuck.
          </span>
          <button
            type="button"
            onClick={clearStuck}
            disabled={cleaning}
            className="px-3 h-9 bg-paper border border-ink text-ink font-body text-xs uppercase tracking-widest hover:bg-paper-deep disabled:opacity-40 transition-colors"
          >
            {cleaning ? "clearing…" : "clear stuck"}
          </button>
        </div>
      ) : null}

      <ol className="flex gap-3 min-w-max pb-2">
        {videoClips.map((c, i) => (
          <li key={c.id}>
            <ClipCard
              clip={c}
              index={i}
              onOpen={() => {
                if (!c.id.startsWith("pending-")) onOpen(c.id);
              }}
            />
          </li>
        ))}
      </ol>
    </div>
  );
}
