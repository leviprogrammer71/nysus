"use client";

import { ClipCard } from "./clip-card";
import type { TimelineClip } from "./types";

export function Timeline({
  clips,
  onOpen,
}: {
  clips: TimelineClip[];
  onOpen: (clipId: string) => void;
}) {
  if (clips.length === 0) {
    return (
      <div className="bg-paper-deep px-6 py-8 flex items-center justify-center text-center">
        <p className="font-hand text-base text-ink-soft/70 max-w-sm">
          clips will appear here as you generate them
        </p>
      </div>
    );
  }

  return (
    <div className="-mx-4 sm:-mx-6 px-4 sm:px-6 overflow-x-auto">
      <ol className="flex gap-3 min-w-max pb-2">
        {clips.map((c, i) => (
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
