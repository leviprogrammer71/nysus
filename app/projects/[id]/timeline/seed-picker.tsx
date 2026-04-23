"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TimelineClip } from "./types";

type Mode = "scrub" | "upload";

/**
 * Bottom-sheet overlay for choosing a seed frame for the *next*
 * clip to be generated. Three sources:
 *
 *   1. Scrub a prior completed clip's video and grab any frame
 *      (extracted client-side via FFmpeg.wasm).
 *   2. Upload a JPG/PNG from the device.
 *   3. Paste from clipboard (handy for iOS screenshots).
 *
 * The chosen frame is uploaded to /api/clips/[targetClipId]/seed
 * and set as that clip's seed_image_url + seed_source.
 */
export function SeedPicker({
  open,
  onClose,
  targetClip,
  candidateClips,
  onApplied,
}: {
  open: boolean;
  onClose: () => void;
  /** The clip we're setting the seed on (the next one to generate). */
  targetClip: TimelineClip;
  /** Prior completed clips the user can scrub to pick a frame from. */
  candidateClips: TimelineClip[];
  onApplied: (payload: {
    seed_image_url: string | null;
    seed_source: "manual_frame" | "upload" | "none";
  }) => void;
}) {
  const [mode, setMode] = useState<Mode>("scrub");
  const [pickerClipId, setPickerClipId] = useState<string | null>(
    candidateClips[candidateClips.length - 1]?.id ?? null,
  );
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadPreview, setUploadPreview] = useState<{
    blob: Blob;
    url: string;
  } | null>(null);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  // Sign the scrub video URL when the picker clip changes.
  useEffect(() => {
    if (!open || mode !== "scrub" || !pickerClipId) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/clips/${pickerClipId}/signed-url?kind=video`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const body = (await res.json()) as { url?: string };
        if (!cancelled && body.url) setVideoUrl(body.url);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, mode, pickerClipId]);

  // Paste-from-clipboard handler — works when the sheet is focused.
  useEffect(() => {
    if (!open || mode !== "upload") return;
    const onPaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.type.startsWith("image/")) {
          const blob = it.getAsFile();
          if (blob) {
            setUploadPreview((prev) => {
              if (prev) URL.revokeObjectURL(prev.url);
              return { blob, url: URL.createObjectURL(blob) };
            });
            return;
          }
        }
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [open, mode]);

  useEffect(() => {
    return () => {
      if (uploadPreview) URL.revokeObjectURL(uploadPreview.url);
    };
  }, [uploadPreview]);

  const handleScrubTimeUpdate = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setCurrentTime(v.currentTime);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration);
  }, []);

  const handleSeek = (next: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(next, v.duration || 0));
  };

  const extractAndUpload = useCallback(async () => {
    setError(null);
    setExtracting(true);
    try {
      const res = await fetch(`/api/clips/${pickerClipId}/signed-url?kind=video`, {
        cache: "no-store",
      });
      const sig = await res.json();
      if (!res.ok) throw new Error(sig.error ?? res.statusText);

      const { extractFrames } = await import("@/lib/ffmpeg");
      const videoRes = await fetch(sig.url as string, { cache: "no-store" });
      const videoBlob = await videoRes.blob();
      const frames = await extractFrames(videoBlob, [currentTime]);
      if (frames.length === 0) throw new Error("extract returned no frames");

      const form = new FormData();
      form.append("frame", frames[0].blob, "seed.jpg");
      form.append("source", "manual_frame");
      const upload = await fetch(`/api/clips/${targetClip.id}/seed`, {
        method: "POST",
        body: form,
      });
      const body = await upload.json();
      if (!upload.ok) throw new Error(body.error ?? upload.statusText);
      onApplied({
        seed_image_url: body.seed_image_url ?? null,
        seed_source: "manual_frame",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtracting(false);
    }
  }, [pickerClipId, currentTime, targetClip.id, onApplied, onClose]);

  const uploadChosen = useCallback(async () => {
    if (!uploadPreview) return;
    setError(null);
    setExtracting(true);
    try {
      const form = new FormData();
      form.append("frame", uploadPreview.blob, "seed.jpg");
      form.append("source", "upload");
      const res = await fetch(`/api/clips/${targetClip.id}/seed`, {
        method: "POST",
        body: form,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      onApplied({
        seed_image_url: body.seed_image_url ?? null,
        seed_source: "upload",
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setExtracting(false);
    }
  }, [uploadPreview, targetClip.id, onApplied, onClose]);

  const clearSeed = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch(`/api/clips/${targetClip.id}/seed`, {
        method: "DELETE",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? res.statusText);
      onApplied({ seed_image_url: null, seed_source: "none" });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [targetClip.id, onApplied, onClose]);

  if (!open) return null;

  const canScrub = candidateClips.length > 0;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Choose seed frame"
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />

      <div className="relative w-full sm:max-w-xl bg-paper border-t sm:border border-ink/20 max-h-[92vh] overflow-y-auto pb-safe">
        <header className="sticky top-0 bg-paper/95 backdrop-blur flex items-center justify-between px-5 py-3 border-b border-ink/10">
          <div className="font-hand text-xl text-ink">change seed frame</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="font-display text-2xl text-ink-soft hover:text-ink px-2"
          >
            &times;
          </button>
        </header>

        {/* Mode tabs */}
        <div className="flex border-b border-ink/10">
          {(["scrub", "upload"] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`flex-1 px-4 py-2 font-body text-sm tracking-wide transition-colors ${
                mode === m
                  ? "text-ink border-b-2 border-ink -mb-px"
                  : "text-ink-soft hover:text-ink"
              }`}
            >
              {m === "scrub" ? "pick from a clip" : "upload / paste"}
            </button>
          ))}
        </div>

        <div className="px-5 py-5 space-y-4">
          {mode === "scrub" ? (
            canScrub ? (
              <>
                <label className="flex flex-col gap-1">
                  <span className="font-hand text-sepia-deep">source clip</span>
                  <select
                    value={pickerClipId ?? ""}
                    onChange={(e) => {
                      setVideoUrl(null);
                      setPickerClipId(e.target.value);
                      setCurrentTime(0);
                    }}
                    className="w-full px-3 py-2 bg-paper-deep border border-ink/20 focus:border-ink font-body text-ink outline-none"
                  >
                    {candidateClips.map((c, i) => (
                      <option key={c.id} value={c.id}>
                        shot #{c.shot_metadata?.shot_number ?? i + 1} —{" "}
                        {c.prompt.slice(0, 40)}
                      </option>
                    ))}
                  </select>
                </label>

                {videoUrl ? (
                  <>
                    <video
                      ref={videoRef}
                      src={videoUrl}
                      controls
                      playsInline
                      webkit-playsinline="true"
                      muted
                      preload="metadata"
                      onTimeUpdate={handleScrubTimeUpdate}
                      onLoadedMetadata={handleLoadedMetadata}
                      className="w-full aspect-[9/16] max-h-[50vh] bg-black object-contain"
                    />
                    <div className="flex items-center gap-3">
                      <input
                        type="range"
                        min={0}
                        max={duration || 15}
                        step={0.05}
                        value={currentTime}
                        onChange={(e) => handleSeek(Number(e.target.value))}
                        className="flex-1 accent-ink"
                      />
                      <span className="font-mono text-xs text-ink-soft w-16 text-right">
                        {currentTime.toFixed(2)}s
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={extractAndUpload}
                      disabled={extracting}
                      className="w-full px-4 py-2.5 bg-ink text-paper font-body tracking-wide hover:bg-ink-soft disabled:opacity-50 disabled:cursor-wait transition-colors"
                    >
                      {extracting ? "extracting…" : `use frame at ${currentTime.toFixed(2)}s →`}
                    </button>
                  </>
                ) : (
                  <div className="w-full aspect-[9/16] max-h-[40vh] bg-paper-deep flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-ink/40 border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </>
            ) : (
              <div className="px-3 py-6 bg-paper-deep text-center">
                <p className="font-hand text-lg text-ink-soft">
                  no prior completed clips to scrub
                </p>
                <p className="font-body text-xs text-ink-soft/70 mt-1">
                  Switch to the upload tab or skip the seed entirely.
                </p>
              </div>
            )
          ) : (
            <>
              <label className="block">
                <span className="font-hand text-sepia-deep">
                  upload a jpg or png
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) {
                      setUploadPreview((prev) => {
                        if (prev) URL.revokeObjectURL(prev.url);
                        return { blob: f, url: URL.createObjectURL(f) };
                      });
                    }
                  }}
                  className="mt-2 block w-full text-sm text-ink file:mr-3 file:px-3 file:py-1.5 file:bg-ink file:text-paper file:font-body file:border-0 file:tracking-wide hover:file:bg-ink-soft"
                />
              </label>
              <p className="font-body text-xs text-ink-soft/70">
                or paste from your clipboard (⌘V / Ctrl-V) &mdash; great for
                iOS screenshots.
              </p>

              {uploadPreview ? (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={uploadPreview.url}
                    alt="Seed preview"
                    className="w-full max-h-[50vh] bg-paper-deep object-contain"
                  />
                  <button
                    type="button"
                    onClick={uploadChosen}
                    disabled={extracting}
                    className="w-full px-4 py-2.5 bg-ink text-paper font-body tracking-wide hover:bg-ink-soft disabled:opacity-50 disabled:cursor-wait transition-colors"
                  >
                    {extracting ? "uploading…" : "use this image →"}
                  </button>
                </>
              ) : null}
            </>
          )}

          <button
            type="button"
            onClick={clearSeed}
            className="w-full px-4 py-2 bg-paper border border-ink/40 text-ink-soft hover:text-ink hover:border-ink font-body text-sm tracking-wide transition-colors"
          >
            no seed — generate from prompt only
          </button>

          {error ? (
            <p className="font-hand text-red-grease" aria-live="polite">
              {error}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
