"use client";

import Image from "next/image";
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
          clips will appear here as you generate them. ask the director for a
          shot to begin.
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
