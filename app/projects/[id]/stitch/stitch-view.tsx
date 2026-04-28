"use client";

import Image from "next/image";
import { useCallback, useMemo, useState } from "react";
import type { TimelineClip } from "../timeline/types";

/**
 * Drag-to-reorder list of completed clips + "Export MP4" that pulls
 * each signed video URL, optionally mixes narration audio and burns
 * captions with FFmpeg.wasm, and triggers a browser download.
 *
 * Narration and captions are opt-in toggles because the extra passes
 * re-encode video and can take noticeably longer on phones.
 */
interface StitchCelebration {
  scene_count: number;
  duration_sec: number;
  models: string[];
  blob_url: string;
  new_achievements?: Array<{ slug: string; label: string; glyph: string }>;
  level?: number;
  streak_days?: number;
}

export function StitchView({
  clips: initialClips,
  projectId,
  projectTitle,
}: {
  clips: TimelineClip[];
  projectId: string;
  projectTitle: string;
}) {
  const [clips, setClips] = useState<TimelineClip[]>(initialClips);
  const [progress, setProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [withNarration, setWithNarration] = useState(true);
  const [withCaptions, setWithCaptions] = useState(true);
  const [celebration, setCelebration] = useState<StitchCelebration | null>(null);

  // Server-side stitch state
  const [serverStitching, setServerStitching] = useState(false);
  const [stitchedUrl, setStitchedUrl] = useState<string | null>(null);

  const ready = useMemo(
    () => clips.filter((c) => c.status === "complete"),
    [clips],
  );
  const skipped = useMemo(
    () => clips.filter((c) => c.status !== "complete"),
    [clips],
  );

  const anyNarrationAvailable = useMemo(
    () => ready.some((c) => c.narration_audio_url),
    [ready],
  );
  const anyCaptionText = useMemo(
    () => ready.some((c) => (c.narration ?? "").trim().length > 0),
    [ready],
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

  const generateNarration = useCallback(async () => {
    setError(null);
    setProgress("synthesizing narration…");
    try {
      for (let i = 0; i < ready.length; i++) {
        const c = ready[i];
        if (!c.narration || !c.narration.trim()) continue;
        if (c.narration_audio_url) continue;
        setProgress(`narrating scene ${i + 1} / ${ready.length}…`);
        const res = await fetch(`/api/clips/${c.id}/narration`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "TTS failed");
        setClips((prev) =>
          prev.map((p) =>
            p.id === c.id
              ? { ...p, narration_audio_url: data.narration_audio_url }
              : p,
          ),
        );
      }
      setProgress(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setProgress(null);
    }
  }, [ready]);

  const stitch = useCallback(async () => {
    if (ready.length === 0) return;
    setError(null);
    setProgress("loading ffmpeg…");

    try {
      const ffmpegLib = await import("@/lib/ffmpeg");
      const {
        concatMp4s,
        mixNarrationOnClip,
        burnCaptions,
        probeDurationSec,
        buildSrtFromClips,
      } = ffmpegLib;

      const blobs: Blob[] = [];
      const durations: number[] = [];

      for (let i = 0; i < ready.length; i++) {
        const c = ready[i];
        setProgress(`downloading clip ${i + 1} / ${ready.length}…`);
        const signRes = await fetch(
          `/api/clips/${c.id}/signed-url?kind=video`,
          { cache: "no-store" },
        );
        const signBody = await signRes.json();
        if (!signRes.ok) throw new Error(signBody.error ?? signRes.statusText);
        const vRes = await fetch(signBody.url as string, { cache: "no-store" });
        if (!vRes.ok) throw new Error(`clip ${i + 1} fetch ${vRes.status}`);
        let blob = await vRes.blob();

        if (withNarration && c.narration_audio_url) {
          setProgress(`mixing narration on clip ${i + 1}…`);
          const aRes = await fetch(c.narration_audio_url, { cache: "no-store" });
          if (aRes.ok) {
            const audio = await aRes.blob();
            blob = await mixNarrationOnClip({ video: blob, audio });
          }
        }

        if (withCaptions) {
          durations.push(await probeDurationSec(blob));
        }

        blobs.push(blob);
      }

      setProgress("concatenating…");
      let final = await concatMp4s(blobs);

      if (withCaptions && anyCaptionText) {
        setProgress("burning captions…");
        const srt = buildSrtFromClips(
          ready.map((c, i) => ({
            text: c.narration,
            durationSec:
              durations[i] ??
              (typeof c.shot_metadata?.duration === "number"
                ? c.shot_metadata.duration
                : 5),
          })),
        );
        if (srt.trim()) {
          final = await burnCaptions({ video: final, srt });
        }
      }

      setProgress("preparing download…");
      const url = URL.createObjectURL(final);
      const a = document.createElement("a");
      const safe = projectTitle.replace(/[^a-z0-9\-_]+/gi, "_").toLowerCase();
      a.href = url;
      a.download = `${safe || "nysus"}-stitched.mp4`;
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Compute stats for the celebration card.
      const totalDuration = durations.reduce((s, d) => s + d, 0) || 0;
      const modelsUsed = Array.from(
        new Set(
          ready
            .map(
              (c) =>
                (c.shot_metadata?.animation_model as string | undefined) ??
                "seedance",
            )
            .filter(Boolean),
        ),
      );

      // Ping the server so XP + achievements fire.
      let awardProgress: {
        level?: number;
        streak_days?: number;
        new_achievements?: Array<{
          slug: string;
          label: string;
          glyph: string;
        }>;
      } | null = null;
      try {
        const res = await fetch("/api/events/stitch", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            scene_count: ready.length,
            duration_sec: totalDuration,
          }),
        });
        if (res.ok) {
          const body = (await res.json()) as {
            progress?: {
              level: number;
              streak_days: number;
              new_achievements: Array<{
                slug: string;
                label: string;
                glyph: string;
              }>;
            };
          };
          awardProgress = body.progress ?? null;
        }
      } catch {
        /* ignore — XP is a nice-to-have */
      }

      setCelebration({
        scene_count: ready.length,
        duration_sec: totalDuration,
        models: modelsUsed,
        blob_url: url,
        level: awardProgress?.level,
        streak_days: awardProgress?.streak_days,
        new_achievements: awardProgress?.new_achievements,
      });

      setProgress(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
      setProgress(null);
    }
  }, [ready, projectId, projectTitle, withNarration, withCaptions, anyCaptionText]);

  /**
   * Server-side stitch via Replicate's lucataco/ffmpeg-api. Sends signed
   * clip URLs to /api/stitch, which concatenates + burns overlays server-side.
   * Result is a single hosted MP4 URL.
   */
  const serverStitch = useCallback(async () => {
    if (ready.length === 0) return;
    setError(null);
    setServerStitching(true);
    setStitchedUrl(null);

    try {
      // Get signed URLs for each clip.
      const clipUrls: string[] = [];
      for (let i = 0; i < ready.length; i++) {
        const c = ready[i];
        const res = await fetch(
          `/api/clips/${c.id}/signed-url?kind=video`,
          { cache: "no-store" },
        );
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? res.statusText);
        clipUrls.push(body.url as string);
      }

      const res = await fetch("/api/stitch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project_id: projectId,
          clip_urls: clipUrls,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? `HTTP ${res.status}`);
      setStitchedUrl(body.url as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setServerStitching(false);
    }
  }, [ready, projectId]);

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
                      {clip.narration_audio_url ? " · narrated" : ""}
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

          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex items-center gap-2 font-body text-xs text-ink">
              <input
                type="checkbox"
                checked={withNarration}
                onChange={(e) => setWithNarration(e.target.checked)}
                className="h-4 w-4"
              />
              Mix narration
              {!anyNarrationAvailable && anyCaptionText ? (
                <button
                  type="button"
                  onClick={generateNarration}
                  disabled={progress !== null}
                  className="ml-1 underline underline-offset-2 text-ink-soft hover:text-ink disabled:opacity-50"
                >
                  generate
                </button>
              ) : null}
            </label>
            <label className="inline-flex items-center gap-2 font-body text-xs text-ink">
              <input
                type="checkbox"
                checked={withCaptions}
                onChange={(e) => setWithCaptions(e.target.checked)}
                className="h-4 w-4"
              />
              Burn captions {anyCaptionText ? "" : "(no narration text yet)"}
            </label>
          </div>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="font-hand text-base text-sepia-deep">
              {ready.length} of {clips.length} ready to export
              {skipped.length > 0 ? ` · ${skipped.length} skipped` : ""}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={serverStitch}
                disabled={ready.length === 0 || serverStitching || progress !== null}
                className="px-5 py-2.5 bg-ink text-paper font-body tracking-wide hover:bg-ink-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {serverStitching ? "Stitching…" : "Stitch into Single MP4"}
              </button>
              <button
                type="button"
                onClick={stitch}
                disabled={ready.length === 0 || progress !== null || serverStitching}
                className="px-5 py-2.5 border border-ink/30 text-ink font-body tracking-wide hover:bg-paper-deep disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {progress ?? "Export in browser →"}
              </button>
            </div>
          </div>

          {/* Server-side stitching overlay */}
          {serverStitching ? (
            <div className="relative overflow-hidden rounded-lg border border-ink/15 bg-paper-deep p-8 text-center">
              <div className="animate-icon-spin mx-auto mb-3 h-8 w-8 rounded-full border-2 border-ink/20 border-t-ink" />
              <p className="font-display text-lg text-ink">
                Stitching your final cut&hellip;
              </p>
              <p className="mt-1 font-body text-sm text-ink-soft/70">
                Server-side render via Replicate. This may take a minute for
                multi-clip reels.
              </p>
            </div>
          ) : null}

          {/* Stitched result: player + download */}
          {stitchedUrl ? (
            <div className="rounded-lg border border-ink/15 bg-paper-deep p-4 space-y-3">
              <p className="font-display text-base text-ink">
                Your final cut is ready.
              </p>
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                src={stitchedUrl}
                controls
                playsInline
                className="w-full max-h-[60vh] rounded bg-ink/5"
              />
              <a
                href={stitchedUrl}
                download={`${projectTitle.replace(/[^a-z0-9\-_]+/gi, "_").toLowerCase() || "nysus"}-final-cut.mp4`}
                className="inline-flex h-11 items-center rounded-full bg-ink px-5 font-body text-[11px] uppercase tracking-widest text-paper hover:bg-ink-soft animate-press"
              >
                Download Final Cut
              </a>
            </div>
          ) : null}

          {error ? (
            <p className="px-3 py-2 bg-paper border border-red-grease text-red-grease font-hand">
              {error}
            </p>
          ) : null}

          {celebration ? (
            <CelebrationCard
              projectId={projectId}
              celebration={celebration}
              onClose={() => setCelebration(null)}
            />
          ) : null}

          <p className="font-body text-xs text-ink-soft/60 leading-relaxed">
            &ldquo;Stitch into Single MP4&rdquo; renders server-side via
            Replicate with overlays burned in. &ldquo;Export in browser&rdquo;
            runs FFmpeg.wasm locally with narration and captions.
          </p>
        </>
      )}
    </div>
  );
}

function CelebrationCard({
  projectId,
  celebration,
  onClose,
}: {
  projectId: string;
  celebration: StitchCelebration;
  onClose: () => void;
}) {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const share = useCallback(async () => {
    setSharing(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "enable" }),
      });
      const body = await res.json();
      if (res.ok && body.url) {
        const full = `${window.location.origin}${body.url}`;
        setShareUrl(full);
        try {
          await navigator.clipboard.writeText(full);
          setCopied(true);
          setTimeout(() => setCopied(false), 2500);
        } catch {
          /* fine — the URL is shown either way */
        }
      }
    } finally {
      setSharing(false);
    }
  }, [projectId]);

  const mins = Math.floor(celebration.duration_sec / 60);
  const secs = Math.round(celebration.duration_sec % 60);

  return (
    <div className="relative overflow-hidden rounded-lg border border-ink/20 bg-paper-deep p-5 animate-reveal is-visible">
      <FallingPetals />
      <div className="relative">
        <div className="flex items-baseline justify-between">
          <h3 className="font-display text-xl text-ink">
            Cut. Printed. <span className="highlight">Wrap.</span>
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Dismiss"
            className="font-display text-xl text-ink-soft hover:text-ink"
          >
            ×
          </button>
        </div>
        <p className="mt-1 font-hand text-base text-sepia-deep">
          Your film is saving to your downloads now.
        </p>
        <dl className="mt-4 grid grid-cols-3 gap-2">
          <Stat label="Scenes" value={`${celebration.scene_count}`} />
          <Stat
            label="Runtime"
            value={mins > 0 ? `${mins}m ${secs}s` : `${secs}s`}
          />
          <Stat label="Models" value={celebration.models.join(" · ") || "—"} />
        </dl>

        {celebration.new_achievements && celebration.new_achievements.length > 0 ? (
          <div className="mt-4 rounded-md border border-ink/15 bg-paper/80 p-3">
            <p className="font-body text-[11px] uppercase tracking-widest text-ink-soft/70">
              New stamps unlocked
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {celebration.new_achievements.map((a) => (
                <li
                  key={a.slug}
                  className="inline-flex items-center gap-1.5 rounded-full border border-ink/25 bg-paper px-2 py-1 font-body text-[11px] text-ink"
                >
                  <span className="font-display text-base">{a.glyph}</span>
                  {a.label}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <a
            href={celebration.blob_url}
            download
            className="inline-flex h-10 items-center rounded-full bg-ink px-4 font-body text-[11px] uppercase tracking-widest text-paper hover:bg-ink-soft animate-press"
          >
            Save again
          </a>
          <button
            type="button"
            onClick={share}
            disabled={sharing}
            className="inline-flex h-10 items-center rounded-full border border-ink/25 bg-paper px-4 font-body text-[11px] uppercase tracking-widest text-ink hover:bg-ink/5 animate-press disabled:opacity-60"
          >
            {sharing
              ? "…"
              : copied
              ? "Link copied"
              : shareUrl
              ? "Copy share link"
              : "Share this film"}
          </button>
          {celebration.level ? (
            <span className="font-body text-[11px] uppercase tracking-widest text-ink-soft/70">
              LV {celebration.level}
              {celebration.streak_days
                ? ` · ${celebration.streak_days}-day streak`
                : ""}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-ink/10 bg-paper px-3 py-2">
      <p className="font-display text-lg text-ink leading-none">{value}</p>
      <p className="mt-1 font-body text-[10px] uppercase tracking-widest text-ink-soft/70">
        {label}
      </p>
    </div>
  );
}

/** Restrained "paper petal" flourish that fits the Director's Desk look. */
function FallingPetals() {
  const petals = Array.from({ length: 12 });
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {petals.map((_, i) => (
        <span
          key={i}
          className="absolute block h-1.5 w-3 rounded-sm bg-sepia/40"
          style={{
            left: `${(i * 7 + 3) % 100}%`,
            top: "-10%",
            transform: `rotate(${(i * 17) % 180}deg)`,
            animation: `petal-fall 3.2s ${
              (i * 0.15).toFixed(2)
            }s ease-in forwards`,
          }}
        />
      ))}
      <style jsx>{`
        @keyframes petal-fall {
          0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.9;
          }
          80% {
            opacity: 0.9;
          }
          100% {
            transform: translateY(220px) rotate(180deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
