"use client";

import { useCallback, useEffect, useState } from "react";
import type { TimelineClip } from "./types";
import { useFrameExtraction } from "./use-frame-extraction";
import { SeedPicker } from "./seed-picker";

/**
 * Bottom sheet that opens when you tap a timeline clip. Video player,
 * prompt text, seed image preview, and the key actions:
 *
 *   - Regenerate (Phase 4)
 *   - Change seed frame (Phase 5 — scrubber / upload / clipboard)
 *   - Consult the chorus (Phase 6 — on-demand critique)
 *   - Delete
 */
export function ClipDetailSheet({
  clip,
  priorCompletedClips,
  onClose,
  onUpdate,
}: {
  clip: TimelineClip | null;
  priorCompletedClips: TimelineClip[];
  onClose: () => void;
  onUpdate: (clip: TimelineClip) => void;
}) {
  const [seedPickerOpen, setSeedPickerOpen] = useState(false);
  // Keyed by clip id so stale fetches never show the wrong video.
  const [videoSigned, setVideoSigned] = useState<{ id: string; url: string } | null>(null);
  const [critiquing, setCritiquing] = useState(false);
  // Critique is also keyed so switching clips clears the display
  // without a synchronous setState in the change-effect.
  const [critiqueFor, setCritiqueFor] = useState<{
    id: string;
    text: string | null;
    error: string | null;
  } | null>(null);

  // Close on escape.
  useEffect(() => {
    if (!clip) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clip, onClose]);

  // Sign the video URL. Stored under the current clip id so stale
  // fetches that resolve after the user switches clips won't render.
  useEffect(() => {
    if (!clip || clip.status !== "complete" || clip.id.startsWith("pending-")) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/clips/${clip.id}/signed-url?kind=video`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as { url?: string };
        if (!cancelled && body.url) {
          setVideoSigned({ id: clip.id, url: body.url });
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clip]);

  const videoUrl =
    videoSigned && clip && videoSigned.id === clip.id ? videoSigned.url : null;

  // Derive critique display from the keyed state — no reset effect needed.
  const critique =
    critiqueFor && clip && critiqueFor.id === clip.id ? critiqueFor.text : null;
  const critiqueError =
    critiqueFor && clip && critiqueFor.id === clip.id ? critiqueFor.error : null;

  // Extract + upload frames the first time a completed clip is opened.
  useFrameExtraction({
    clipId: clip?.id ?? "",
    videoUrl,
    status: clip?.status ?? "",
    alreadyExtracted: Boolean(
      clip?.last_frame_url && (clip?.sampled_frames_urls?.length ?? 0) >= 3,
    ),
    onUploaded: (payload) => {
      if (!clip) return;
      onUpdate({
        ...clip,
        last_frame_url: payload.last_frame_url,
        sampled_frames_urls: payload.sampled_frames_urls,
      });
    },
  });

  const consultChorus = useCallback(async () => {
    if (!clip || clip.status !== "complete") return;
    const targetId = clip.id;
    setCritiquing(true);
    setCritiqueFor({ id: targetId, text: null, error: null });
    try {
      const res = await fetch(`/api/clips/${targetId}/critique`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      setCritiqueFor({ id: targetId, text: body.critique as string, error: null });
    } catch (err) {
      setCritiqueFor({
        id: targetId,
        text: null,
        error: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setCritiquing(false);
    }
  }, [clip]);

  const regenerate = useCallback(async () => {
    if (!clip) return;
    const res = await fetch(`/api/clips/${clip.id}/regenerate`, {
      method: "POST",
    });
    const body = await res.json();
    if (res.ok && body.clip) onUpdate(body.clip as TimelineClip);
  }, [clip, onUpdate]);

  const deleteClip = useCallback(async () => {
    if (!clip) return;
    if (!confirm("Delete this clip? The video and frames will be removed.")) return;
    const res = await fetch(`/api/clips/${clip.id}`, { method: "DELETE" });
    if (res.ok) onClose();
  }, [clip, onClose]);

  if (!clip) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Clip ${clip.shot_metadata?.shot_number ?? ""}`}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />

      <div className="relative w-full sm:max-w-xl bg-paper border-t sm:border border-ink/20 max-h-[92vh] overflow-y-auto pb-safe">
        <header className="sticky top-0 bg-paper/95 backdrop-blur flex items-center justify-between px-5 py-3 border-b border-ink/10">
          <div className="flex items-center gap-3">
            <span className="font-hand text-sepia-deep text-base">shot</span>
            <span className="font-display text-2xl text-ink leading-none">
              #{clip.shot_metadata?.shot_number ?? clip.order_index + 1}
            </span>
            <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60 ml-2">
              {clip.status}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="font-display text-2xl text-ink-soft hover:text-ink px-2"
          >
            &times;
          </button>
        </header>

        <div className="px-5 py-5 space-y-5">
          {clip.status === "complete" && videoUrl ? (
            <video
              src={videoUrl}
              controls
              playsInline
              preload="metadata"
              className="w-full bg-black aspect-[9/16] max-h-[60vh] object-contain"
            />
          ) : clip.status === "processing" || clip.status === "queued" ? (
            <div className="w-full aspect-[9/16] max-h-[60vh] bg-paper-deep flex flex-col items-center justify-center gap-4 px-6">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/illustrations/search-reel.png"
                alt=""
                className="w-40 h-auto mix-blend-multiply animate-paper-breath"
              />
              <p className="font-hand text-lg text-sepia-deep">
                {clip.status === "queued"
                  ? "queued · examining the reel"
                  : "rendering · examining the reel…"}
              </p>
            </div>
          ) : clip.status === "failed" ? (
            <div className="w-full aspect-[9/16] max-h-[60vh] bg-paper-deep flex flex-col items-center justify-center gap-3 p-6 text-center">
              <p className="font-display text-4xl text-red-grease">✕</p>
              <p className="font-hand text-lg text-red-grease">
                {clip.error_message ?? "generation failed"}
              </p>
            </div>
          ) : null}

          <div>
            <h3 className="font-hand text-sepia-deep text-base mb-1">prompt</h3>
            <p className="font-mono text-sm text-ink whitespace-pre-wrap leading-relaxed">
              {clip.prompt}
            </p>
          </div>

          {clip.seed_image_url ? (
            <div>
              <h3 className="font-hand text-sepia-deep text-base mb-1">seed</h3>
              <div className="flex items-center gap-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={clip.seed_image_url}
                  alt="Seed frame"
                  className="w-24 h-24 object-cover border border-ink/20"
                />
                <span className="font-body text-xs uppercase tracking-widest text-ink-soft/60">
                  source: {clip.seed_source}
                </span>
              </div>
            </div>
          ) : null}

          {/* Actions */}
          <div className="grid grid-cols-2 gap-2 pt-2">
            <button
              type="button"
              onClick={consultChorus}
              disabled={clip.status !== "complete" || critiquing}
              className="px-3 py-2 bg-ink text-paper font-body text-sm tracking-wide hover:bg-ink-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Ask the director what's off with this clip"
            >
              {critiquing ? "consulting…" : "consult the chorus"}
            </button>
            <button
              type="button"
              onClick={regenerate}
              disabled={clip.status === "queued" || clip.status === "processing"}
              className="px-3 py-2 bg-paper border border-ink text-ink font-body text-sm tracking-wide hover:bg-paper-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              regenerate
            </button>
            <button
              type="button"
              onClick={() => setSeedPickerOpen(true)}
              className="px-3 py-2 bg-paper border border-ink/40 text-ink font-body text-sm tracking-wide hover:border-ink transition-colors"
            >
              change seed frame
            </button>
            <button
              type="button"
              onClick={deleteClip}
              className="px-3 py-2 bg-paper border border-red-grease/60 text-red-grease font-body text-sm tracking-wide hover:border-red-grease hover:bg-paper-deep transition-colors"
            >
              delete
            </button>
          </div>

          {critique ? (
            <div className="mt-2 p-4 bg-paper-deep border border-ink/10">
              <h3 className="font-hand text-sepia-deep text-base mb-2">
                the chorus says
              </h3>
              <p className="font-body text-ink leading-relaxed whitespace-pre-wrap">
                {critique}
              </p>
            </div>
          ) : null}
          {critiqueError ? (
            <p className="font-hand text-red-grease">{critiqueError}</p>
          ) : null}
        </div>
      </div>

      {clip ? (
        <SeedPicker
          open={seedPickerOpen}
          onClose={() => setSeedPickerOpen(false)}
          targetClip={clip}
          candidateClips={priorCompletedClips}
          onApplied={({ seed_image_url, seed_source }) => {
            onUpdate({
              ...clip,
              seed_image_url,
              seed_source,
            });
          }}
        />
      ) : null}
    </div>
  );
}
