"use client";

import { useEffect, useRef } from "react";

/**
 * One-time frame extraction hook.
 *
 * Called from the clip detail sheet when a completed clip is opened.
 * Dynamically imports @/lib/ffmpeg (so the ~30MB wasm never loads on
 * the projects list), extracts ~start/mid/end frames plus a last frame,
 * POSTs them to /api/clips/[id]/frames, and returns success.
 *
 * IMPORTANT: this is the *sampling* side. Frames are stored silently
 * on the clip row. Sending them to Claude only happens when the user
 * explicitly taps "Consult the chorus" — see /api/clips/[id]/critique.
 */
export function useFrameExtraction({
  clipId,
  videoUrl,
  status,
  alreadyExtracted,
  onUploaded,
}: {
  clipId: string;
  videoUrl: string | null;
  status: string;
  alreadyExtracted: boolean;
  onUploaded?: (payload: {
    last_frame_url: string | null;
    sampled_frames_urls: string[];
  }) => void;
}) {
  const lastRunRef = useRef<string | null>(null);

  useEffect(() => {
    if (status !== "complete" || !videoUrl || alreadyExtracted) return;
    if (clipId.startsWith("pending-")) return;
    if (lastRunRef.current === clipId) return;
    lastRunRef.current = clipId;

    let cancelled = false;

    (async () => {
      try {
        const { extractFrames } = await import("@/lib/ffmpeg");

        // Fetch the video bytes directly so ffmpeg gets a Blob rather
        // than needing a second network round-trip.
        const res = await fetch(videoUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(`video fetch ${res.status}`);
        const videoBlob = await res.blob();

        const frames = await extractFrames(videoBlob, [1, 7, "end"]);
        if (cancelled || frames.length !== 3) return;

        // Release thumbnail blob URLs — server has the files now.
        const [s0, s1, s2] = frames;

        const form = new FormData();
        // `last` is the final frame used to seed the next shot.
        form.append("last", s2.blob, "last.jpg");
        form.append("sample_0", s0.blob, "sample_0.jpg");
        form.append("sample_1", s1.blob, "sample_1.jpg");
        form.append("sample_2", s2.blob, "sample_2.jpg");

        const uploadRes = await fetch(`/api/clips/${clipId}/frames`, {
          method: "POST",
          body: form,
        });
        if (!uploadRes.ok) {
          const err = await uploadRes.json().catch(() => ({}));
          throw new Error(err.error ?? uploadRes.statusText);
        }
        const body = await uploadRes.json();
        if (!cancelled && onUploaded) {
          onUploaded({
            last_frame_url: body.last_frame_url ?? null,
            sampled_frames_urls: body.sampled_frames_urls ?? [],
          });
        }
      } catch (err) {
        // Non-fatal — user can still watch the clip, they just won't
        // get auto-seed on the next shot until they reopen this one.
        console.warn("Frame extraction failed:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [clipId, videoUrl, status, alreadyExtracted, onUploaded]);
}
