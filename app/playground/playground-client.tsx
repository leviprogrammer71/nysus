"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  IMAGE_MODELS,
  ANIMATION_MODELS,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_ANIMATION_MODEL,
  type ImageModelId,
  type AnimationModelId,
} from "@/lib/models";

/**
 * Threshold UI — model picker, prompt, optional source image, run.
 *
 * Two halves on one page:
 *   forge — the input column (model + prompt + source).
 *   archive — recent generations, refreshes itself every few seconds
 *             until everything pending has resolved.
 *
 * Mythology stays subtle: the page is called "the threshold" because
 * the user is at the door of every generation tool, free to walk
 * through any of them without the procession's commitments.
 */

type Kind = "image" | "animation";

type Generation = {
  id: string;
  kind: Kind;
  model_id: string;
  prompt: string;
  output_url: string | null;
  status: "queued" | "processing" | "succeeded" | "failed" | "canceled";
  error: string | null;
  created_at: string;
  completed_at: string | null;
};

export function PlaygroundClient() {
  const [kind, setKind] = useState<Kind>("image");
  const [imageModelId, setImageModelId] = useState<ImageModelId>(
    DEFAULT_IMAGE_MODEL,
  );
  const [animationModelId, setAnimationModelId] = useState<AnimationModelId>(
    DEFAULT_ANIMATION_MODEL,
  );
  const [prompt, setPrompt] = useState("");
  const [aspect, setAspect] = useState<string>("");
  const [duration, setDuration] = useState<number | "">("");
  const [quality, setQuality] = useState<"auto" | "low" | "medium" | "high">(
    "auto",
  );
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [sourcePreview, setSourcePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<Generation[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Pin the active model + its allowed aspect ratios.
  const imageDef = IMAGE_MODELS[imageModelId];
  const animationDef = ANIMATION_MODELS[animationModelId];
  const def = kind === "image" ? imageDef : animationDef;
  const aspectOptions = def.aspect_ratios;
  const durationOptions =
    kind === "animation" ? animationDef.durations : null;

  // Whenever the model changes, snap aspect to its first valid value.
  useEffect(() => {
    if (!aspectOptions.includes(aspect)) {
      setAspect(aspectOptions[0] ?? "");
    }
  }, [aspectOptions, aspect]);

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/playground/history", { cache: "no-store" });
      const body = await res.json();
      if (res.ok && Array.isArray(body.generations)) {
        setHistory(body.generations as Generation[]);
      }
    } catch {
      // best effort — no toast, the next poll will retry
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  // Poll while anything is in flight so animations resolve without a
  // manual reload.
  useEffect(() => {
    const anyPending = history.some(
      (g) => g.status === "queued" || g.status === "processing",
    );
    if (!anyPending) return;
    const t = setInterval(refreshHistory, 4_000);
    return () => clearInterval(t);
  }, [history, refreshHistory]);

  const onPickFile = useCallback(
    async (file: File) => {
      setError(null);
      setUploading(true);
      try {
        const form = new FormData();
        form.append("file", file);
        const res = await fetch("/api/playground/attach", {
          method: "POST",
          body: form,
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Upload failed");
        setSourceUrl(body.url as string);
        setSourcePreview(URL.createObjectURL(file));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setUploading(false);
      }
    },
    [],
  );

  const generate = useCallback(async () => {
    setError(null);
    if (!prompt.trim()) {
      setError("Give the forge a prompt.");
      return;
    }
    if (kind === "animation" && !sourceUrl) {
      setError("Animation models need a source image — drop one in.");
      return;
    }
    setBusy(true);
    try {
      const payload =
        kind === "image"
          ? {
              kind: "image" as const,
              model_id: imageModelId,
              prompt: prompt.trim(),
              ...(aspect ? { aspect_ratio: aspect } : {}),
              ...(imageDef.quality && quality !== "auto" ? { quality } : {}),
              ...(sourceUrl ? { source_image_url: sourceUrl } : {}),
            }
          : {
              kind: "animation" as const,
              model_id: animationModelId,
              prompt: prompt.trim(),
              source_image_url: sourceUrl!,
              ...(aspect ? { aspect_ratio: aspect } : {}),
              ...(typeof duration === "number" ? { duration } : {}),
            };
      const res = await fetch("/api/playground/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Generation failed");
      void refreshHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [
    kind,
    prompt,
    sourceUrl,
    aspect,
    imageModelId,
    animationModelId,
    imageDef.quality,
    quality,
    duration,
    refreshHistory,
  ]);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-6 sm:px-6 md:pb-8">
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-3">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 font-body text-[11px] uppercase tracking-widest text-ink-soft/70 min-w-0"
        >
          <Link href="/dashboard" className="hover:text-ink">
            Dashboard
          </Link>
          <span aria-hidden>/</span>
          <span className="truncate text-ink">Playground</span>
        </nav>
      </header>

      <section className="mb-6">
        <h1 className="font-display text-3xl text-ink leading-tight sm:text-4xl">
          The Playground
        </h1>
        <p className="font-hand text-base text-sepia-deep">the threshold</p>
        <p className="mt-2 max-w-xl font-body text-sm text-ink-soft/85 leading-relaxed">
          Pick any forge in the registry and run it. No project, no bible, no
          procession. Stills go straight to the archive. Animations run async
          and walk themselves forward in your history below.
        </p>
      </section>

      {/* Kind switch — image | animation */}
      <div
        role="tablist"
        aria-label="Generation kind"
        className="mb-4 inline-flex items-center gap-1 self-start rounded-full border border-ink/10 bg-paper-deep p-1"
      >
        {(["image", "animation"] as const).map((k) => {
          const active = kind === k;
          return (
            <button
              key={k}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setKind(k)}
              className={`rounded-full px-3 py-1.5 font-display text-[11px] uppercase tracking-[0.22em] transition-colors animate-press ${
                active
                  ? "bg-paper text-ink shadow-[0_1px_3px_rgba(27,42,58,0.08)]"
                  : "text-ink-soft/70 hover:text-ink"
              }`}
            >
              {k === "image" ? "Still" : "Motion"}
            </button>
          );
        })}
      </div>

      {/* Forge — model + prompt + source */}
      <section className="surface-card mb-8 space-y-4 rounded-xl px-4 py-4 sm:px-5">
        <ModelSelect
          kind={kind}
          imageId={imageModelId}
          animationId={animationModelId}
          onChangeImage={setImageModelId}
          onChangeAnimation={setAnimationModelId}
        />

        <label className="flex flex-col gap-1">
          <span className="font-hand text-sepia-deep text-[12px]">prompt</span>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={4}
            placeholder={
              kind === "image"
                ? "describe the still — subject, light, framing, art style…"
                : "describe the motion — what moves, camera feel, pacing…"
            }
            className="w-full px-3 py-2 bg-paper border border-ink/20 focus:border-ink font-body text-ink text-[14px] outline-none resize-none"
          />
        </label>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="flex flex-col gap-1">
            <span className="font-hand text-sepia-deep text-[12px]">
              aspect ratio
            </span>
            <select
              value={aspect}
              onChange={(e) => setAspect(e.target.value)}
              className="h-10 px-3 bg-paper border border-ink/20 focus:border-ink font-body text-ink text-[12px] outline-none"
            >
              {aspectOptions.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </label>

          {kind === "image" && imageDef.quality ? (
            <label className="flex flex-col gap-1">
              <span className="font-hand text-sepia-deep text-[12px]">
                quality
              </span>
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as typeof quality)}
                className="h-10 px-3 bg-paper border border-ink/20 focus:border-ink font-body text-ink text-[12px] outline-none"
              >
                {imageDef.quality.map((q) => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          {durationOptions ? (
            <label className="flex flex-col gap-1">
              <span className="font-hand text-sepia-deep text-[12px]">
                duration (s)
              </span>
              <select
                value={duration}
                onChange={(e) =>
                  setDuration(
                    e.target.value === "" ? "" : Number(e.target.value),
                  )
                }
                className="h-10 px-3 bg-paper border border-ink/20 focus:border-ink font-body text-ink text-[12px] outline-none"
              >
                <option value="">default ({durationOptions[0]}s)</option>
                {durationOptions.map((d) => (
                  <option key={d} value={d}>
                    {d}s
                  </option>
                ))}
              </select>
            </label>
          ) : null}
        </div>

        {/* Source image — required for animation, optional for image */}
        {kind === "animation" || imageDef.accepts_input_image ? (
          <div className="space-y-2">
            <span className="font-hand text-sepia-deep text-[12px]">
              source image{" "}
              {kind === "animation" ? (
                <span className="text-red-grease">(required)</span>
              ) : (
                <span className="text-ink-soft/70">(optional)</span>
              )}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void onPickFile(file);
                e.target.value = "";
              }}
            />
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="inline-flex h-10 items-center rounded-full border border-ink/25 bg-paper px-3 font-body text-[11px] uppercase tracking-widest text-ink hover:bg-ink/5 animate-press disabled:opacity-40"
              >
                {uploading
                  ? "Uploading…"
                  : sourceUrl
                  ? "Replace"
                  : "Drop a source"}
              </button>
              {sourcePreview ? (
                <span className="relative inline-block h-14 w-14 overflow-hidden rounded-md border border-ink/15">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={sourcePreview}
                    alt="Source"
                    className="h-full w-full object-cover"
                  />
                  <button
                    type="button"
                    aria-label="Remove source"
                    onClick={() => {
                      setSourceUrl(null);
                      setSourcePreview(null);
                    }}
                    className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full border border-ink/40 bg-paper text-[10px] text-ink"
                  >
                    ×
                  </button>
                </span>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={generate}
            disabled={busy || !prompt.trim()}
            className="inline-flex h-11 items-center rounded-full bg-ink px-5 font-body text-[12px] uppercase tracking-widest text-paper hover:bg-ink-soft animate-press disabled:opacity-40"
          >
            {busy
              ? kind === "image"
                ? "Drawing…"
                : "Sending…"
              : kind === "image"
              ? "Strike the still"
              : "Send the rite"}
          </button>
          {error ? (
            <span className="font-hand text-red-grease text-[12px]">
              {error}
            </span>
          ) : null}
        </div>
      </section>

      {/* Archive — recent generations */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="font-display text-base uppercase tracking-widest text-ink">
            Archive
          </h2>
          <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
            {history.length}{" "}
            {history.length === 1 ? "generation" : "generations"}
          </span>
        </div>
        {history.length === 0 ? (
          <p className="font-hand text-sepia-deep/80 text-base">
            the archive is empty. strike the still and the threshold remembers.
          </p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {history.map((g) => (
              <ArchiveCell key={g.id} g={g} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------

function ModelSelect({
  kind,
  imageId,
  animationId,
  onChangeImage,
  onChangeAnimation,
}: {
  kind: Kind;
  imageId: ImageModelId;
  animationId: AnimationModelId;
  onChangeImage: (v: ImageModelId) => void;
  onChangeAnimation: (v: AnimationModelId) => void;
}) {
  if (kind === "image") {
    const active = IMAGE_MODELS[imageId];
    return (
      <label className="flex flex-col gap-1">
        <span className="font-hand text-sepia-deep text-[12px]">
          still forge
        </span>
        <select
          value={imageId}
          onChange={(e) => onChangeImage(e.target.value as ImageModelId)}
          className="h-11 px-3 bg-paper border border-ink/20 focus:border-ink font-body text-ink outline-none"
        >
          {Object.values(IMAGE_MODELS).map((m) => (
            <option key={m.id} value={m.id}>
              {m.label} — {m.description}
            </option>
          ))}
        </select>
        {active ? (
          <span className="font-body text-[11px] text-ink-soft/70 leading-snug">
            ~{active.approx_cost_cents}¢ / call · aspects:{" "}
            {active.aspect_ratios.join(", ")}
          </span>
        ) : null}
      </label>
    );
  }
  const active = ANIMATION_MODELS[animationId];
  return (
    <label className="flex flex-col gap-1">
      <span className="font-hand text-sepia-deep text-[12px]">motion forge</span>
      <select
        value={animationId}
        onChange={(e) => onChangeAnimation(e.target.value as AnimationModelId)}
        className="h-11 px-3 bg-paper border border-ink/20 focus:border-ink font-body text-ink outline-none"
      >
        {Object.values(ANIMATION_MODELS).map((m) => (
          <option key={m.id} value={m.id}>
            {m.label} — {m.description}
          </option>
        ))}
      </select>
      {active ? (
        <span className="font-body text-[11px] text-ink-soft/70 leading-snug">
          ~{active.approx_cost_cents}¢ / call · aspects:{" "}
          {active.aspect_ratios.join(", ")} · durations:{" "}
          {active.durations.join("/")}s
        </span>
      ) : null}
    </label>
  );
}

function ArchiveCell({ g }: { g: Generation }) {
  const pending = g.status === "queued" || g.status === "processing";
  return (
    <li className="surface-card-soft animate-lift overflow-hidden rounded-md">
      <div className="relative aspect-square bg-ink/5">
        {g.output_url && g.kind === "image" ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={g.output_url}
            alt={g.prompt.slice(0, 60)}
            className="h-full w-full object-cover"
          />
        ) : g.output_url && g.kind === "animation" ? (
          <video
            src={g.output_url}
            controls
            playsInline
            webkit-playsinline="true"
            muted
            preload="metadata"
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
            {pending ? "rendering…" : g.status}
          </div>
        )}
      </div>
      <div className="px-2 py-1.5 space-y-0.5">
        <p className="line-clamp-2 font-body text-[11px] text-ink leading-snug">
          {g.prompt}
        </p>
        <p className="font-body text-[9px] uppercase tracking-widest text-ink-soft/60">
          {g.model_id} · {g.kind}
        </p>
        {g.error ? (
          <p
            title={g.error}
            className="line-clamp-1 font-hand text-[11px] text-red-grease"
          >
            {g.error}
          </p>
        ) : null}
      </div>
    </li>
  );
}
