"use client";

import { useRef, useState } from "react";
import type { ShowcaseReel } from "@/lib/showcase";

/**
 * Horizontal card strip of finished films. Each card shows the
 * poster frame and the title; on hover (desktop) or tap (mobile)
 * the video plays muted inline. Clicking the big play button opens
 * the full-screen overlay with audio.
 *
 * Videos are <video preload="none"> so nothing downloads until the
 * user actually engages.
 */
export function ShowcaseStrip({ reels }: { reels: ShowcaseReel[] }) {
  const [open, setOpen] = useState<ShowcaseReel | null>(null);

  if (reels.length === 0) return null;

  return (
    <section className="mb-8">
      <div className="flex items-end justify-between mb-3">
        <h2 className="font-display text-2xl text-ink">
          <span className="highlight">cinema</span>
        </h2>
        <span className="font-hand text-sm text-sepia-deep">
          finished with Nysus
        </span>
      </div>
      <div className="-mx-6 px-6 overflow-x-auto">
        <ul className="flex gap-3 pb-2 min-w-max">
          {reels.map((r) => (
            <li key={r.slug}>
              <ShowcaseCard reel={r} onOpen={() => setOpen(r)} />
            </li>
          ))}
        </ul>
      </div>

      {open ? (
        <ShowcaseOverlay reel={open} onClose={() => setOpen(null)} />
      ) : null}
    </section>
  );
}

function ShowcaseCard({
  reel,
  onOpen,
}: {
  reel: ShowcaseReel;
  onOpen: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Portrait reels render as taller cards; landscape wider.
  const isPortrait = reel.aspect_ratio === "9:16";
  const styleLabel = reel.style === "3d" ? "3D" : "realistic";

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Play ${reel.title}`}
      onMouseEnter={() => {
        const v = videoRef.current;
        if (!v) return;
        v.muted = true;
        v.play().catch(() => {});
      }}
      onMouseLeave={() => {
        const v = videoRef.current;
        if (!v) return;
        v.pause();
        v.currentTime = 0;
      }}
      className={`group relative block overflow-hidden bg-paper-deep border border-ink/20 hover:border-ink/60 transition-colors text-left ${
        isPortrait ? "w-48 aspect-[9/16]" : "w-80 aspect-video"
      }`}
    >
      <video
        ref={videoRef}
        src={reel.video}
        poster={reel.poster}
        preload="none"
        playsInline
        muted
        loop
        className="absolute inset-0 w-full h-full object-cover"
      />

      {/* Dark gradient so the title reads over any frame */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/10 to-transparent"
      />

      <div className="absolute inset-x-0 top-0 px-3 py-2 flex items-center justify-between">
        <span className="font-body text-[10px] uppercase tracking-widest text-paper/80">
          {styleLabel}
        </span>
      </div>

      <div className="absolute inset-x-0 bottom-0 px-3 py-3">
        <p className="font-display text-lg text-paper leading-tight line-clamp-2">
          {reel.title}
        </p>
        <p className="font-hand text-sm text-paper/80 mt-0.5 line-clamp-1">
          {reel.tagline}
        </p>
      </div>

      {/* Play badge — appears on idle, hidden on hover as video plays */}
      <div
        aria-hidden
        className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-90 group-hover:opacity-0 transition-opacity"
      >
        <span className="w-11 h-11 rounded-full bg-paper/90 border border-ink/30 flex items-center justify-center shadow-md">
          <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden
            fill="currentColor" className="text-ink -mr-0.5">
            <polygon points="6,4 20,12 6,20" />
          </svg>
        </span>
      </div>
    </button>
  );
}

function ShowcaseOverlay({
  reel,
  onClose,
}: {
  reel: ShowcaseReel;
  onClose: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={reel.title}
      className="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-ink/90 backdrop-blur-sm px-6 pt-safe pb-safe"
      onClick={onClose}
    >
      <div
        className={`relative w-full ${
          reel.aspect_ratio === "9:16"
            ? "max-w-sm aspect-[9/16]"
            : "max-w-3xl aspect-video"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <video
          ref={videoRef}
          src={reel.video}
          poster={reel.poster}
          autoPlay
          controls
          playsInline
          className="absolute inset-0 w-full h-full bg-black object-contain"
        />
      </div>

      <div className="mt-6 max-w-2xl text-center">
        <h3 className="font-display text-2xl text-paper">{reel.title}</h3>
        <p className="font-hand text-lg text-paper/80 mt-1">{reel.tagline}</p>
      </div>

      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 w-11 h-11 rounded-full bg-paper/10 border border-paper/30 text-paper font-display text-xl leading-none flex items-center justify-center hover:bg-paper/20 transition-colors"
      >
        &times;
      </button>
    </div>
  );
}
