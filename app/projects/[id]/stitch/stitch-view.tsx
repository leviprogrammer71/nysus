"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import type { TimelineClip } from "../timeline/types";

/**
 * Drag-to-reorder list of completed clips + "Export MP4" that pulls
 * each signed video URL, hands the blobs to FFmpeg.wasm concat, and
 * triggers a browser download.
 */
export function StitchView({
  clips: initialClips,
  projectTitle,
}: {
  clips: TimelineClip[];
  projectTitle: string;
}) {
  const [clips, setClips] = useState<TimelineClip[]>(initialClips);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const ready = useMemo(
    () => clips.filter((c) => c.status === "complete"),
    [clips],
  );
  const skipped = useMemo(
    () => clips.filter((c) => c.status !== "complete"),
    [clips],
  );

  const move = useCallback((from: number, to: number) => {
    setClips((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = prev.slice();
      const [removed] = next.splice(from, 1);
      next.splice(to, 0, removed);
      return next;
    });
  }, []);

  const stitch = useCallback(async () => {
    if (ready.length === 0) return;
    setError(null);
    setProgress("loading ffmpeg…");

    try {
      const { concatMp4s } = await import("@/lib/ffmpeg");

      const blobs: Blob[] = [];
      for (let i = 0; i < ready.length; i++) {
        setProgress(`downloading clip ${i + 1} / ${ready.length}…`);
        const signRes = await fetch(
          `/api/clips/${ready[i].id}/signed-url?kind=video`,
          { cache: "no-store" },
        );
        const signBody = await signRes.json();
        if (!signRes.ok) throw new Error(signBody.error ?? signRes.statusText);
        const vRes = await fetch(signBody.url as string, { cache: "no-store" });
        if (!vRes.ok) throw new Error(`clip ${i + 1} fetch ${vRes.status}`);
        blobs.push(await vRes.blob());
      }

      setProgress("concatenating…");
      const final = await concatMp4s(blobs);

      setProgress("preparing download…");
      const url = URL.createObjectURL(final);
      const a = document.createElement("a");
      const safe = projectTitle.replace(/[^a-z0-9\-_]+/gi, "_").toLowerCase();
      a.href = url;
      a.download = `${safe || "nysus"}-stitched.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);

      setProgress("done");
      setTimeout(() => setProgress(null), 3000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setProgress(null);
    }
  }, [ready, projectTitle]);

  return (
    <div className="space-y-8">
      {ready.length === 0 ? (
        <div className="bg-paper-deep px-6 py-10 flex flex-col items-center gap-4 text-center">
          <div className="relative w-full max-w-sm animate-paper-drift">
            <Image
              src="/illustrations/scattered-strips.png"
              alt="Film strips scattered on the desk, waiting for a cut"
              width={600}
              height={400}
              className="w-full h-auto mix-blend-multiply"
              sizes="(max-width: 480px) 90vw, 400px"
            />
          </div>
          <p className="font-hand text-2xl text-ink-soft">nothing to stitch</p>
          <p className="font-body text-sm text-ink-soft max-w-md">
            Generate at least one clip in this project, then come back to
            arrange and export.
          </p>
        </div>
      ) : (
        <>
          <ol className="space-y-2">
            {clips.map((clip, i) => {
              const isComplete = clip.status === "complete";
              return (
                <li
                  key={clip.id}
                  className={`flex items-center gap-3 px-3 py-2 bg-paper-deep ${
                    isComplete ? "" : "opacity-50"
                  }`}
                >
                  <span className="font-display text-xl text-ink w-8 shrink-0">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-body text-sm text-ink truncate">
                      {clip.prompt}
                    </p>
                    <p className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
                      {clip.status}
                      {!isComplete ? " · skipped" : ""}
                    </p>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button
                      type="button"
                      aria-label="Move up"
                      onClick={() => move(i, i - 1)}
                      disabled={i === 0}
                      className="w-11 h-9 font-mono text-base border border-ink/30 hover:border-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      aria-label="Move down"
                      onClick={() => move(i, i + 1)}
                      disabled={i === clips.length - 1}
                      className="w-11 h-9 font-mono text-base border border-ink/30 hover:border-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
                    >
                      ↓
                    </button>
                  </div>
                </li>
              );
            })}
          </ol>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="font-hand text-base text-sepia-deep">
              {ready.length} of {clips.length} ready to export
              {skipped.length > 0 ? ` · ${skipped.length} skipped` : ""}
            </div>
            <button
              type="button"
              onClick={stitch}
              disabled={ready.length === 0 || progress !== null}
              className="px-5 py-2.5 bg-ink text-paper font-body tracking-wide hover:bg-ink-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {progress ?? "Export MP4 →"}
            </button>
          </div>

          {error ? (
            <p className="px-3 py-2 bg-paper border border-red-grease text-red-grease font-hand">
              {error}
            </p>
          ) : null}

          <p className="font-body text-xs text-ink-soft/60 leading-relaxed">
            Export runs entirely in your browser via FFmpeg.wasm. Nothing is
            sent to a server — the signed URLs fetch each clip directly from
            storage and the concat happens locally.
          </p>
        </>
      )}
    </div>
  );
}
