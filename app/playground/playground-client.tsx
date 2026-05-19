"use client";

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
 * The Threshold — Playground client (project-less generation).
 *
 * Built from Threshold.html design. The page reads as crossing into a
 * forge:
 *   - Doorway-glow hero with an arch SVG illustration.
 *   - Two big "forge cards" (still / motion). Each carries a model
 *     dropdown so the user can pick gpt-image-2, Kling 3 Omni, Veo 3,
 *     Happy Horse, Seedance 2.0, etc. — none of the models we wired
 *     are hidden behind a default.
 *   - Big serif italic prompt textarea.
 *   - Source image dropzone (paste / drag / pick).
 *   - Ratio / quality / duration chips.
 *   - "Call the forge ⟶" ink CTA.
 *   - Right rail: a note, recent forges (live archive), presets.
 *   - Archive grid below.
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
  const [archiveFilter, setArchiveFilter] = useState<"all" | "image" | "animation">("all");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const imageDef = IMAGE_MODELS[imageModelId];
  const animationDef = ANIMATION_MODELS[animationModelId];
  const def = kind === "image" ? imageDef : animationDef;
  const aspectOptions = def.aspect_ratios;
  const durationOptions = kind === "animation" ? animationDef.durations : null;

  useEffect(() => {
    if (!aspectOptions.includes(aspect)) setAspect(aspectOptions[0] ?? "");
  }, [aspectOptions, aspect]);

  const refreshHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/playground/history", { cache: "no-store" });
      const body = await res.json();
      if (res.ok && Array.isArray(body.generations)) {
        setHistory(body.generations as Generation[]);
      }
    } catch {
      // best effort
    }
  }, []);

  useEffect(() => {
    void refreshHistory();
  }, [refreshHistory]);

  useEffect(() => {
    const anyPending = history.some(
      (g) => g.status === "queued" || g.status === "processing",
    );
    if (!anyPending) return;
    const t = setInterval(refreshHistory, 4_000);
    return () => clearInterval(t);
  }, [history, refreshHistory]);

  const onPickFile = useCallback(async (file: File) => {
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
  }, []);

  const generate = useCallback(async () => {
    setError(null);
    if (!prompt.trim()) {
      setError("Tell the forge what to make.");
      return;
    }
    if (kind === "animation" && !sourceUrl) {
      setError("Motion needs a seed image — drop one in.");
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

  const filteredHistory =
    archiveFilter === "all"
      ? history
      : history.filter((g) => g.kind === archiveFilter);
  const recentForges = history.slice(0, 6);
  const charCount = prompt.length;

  return (
    <div className="paper-grain min-h-screen">
      {/* ====== HEADER · the threshold ====== */}
      <section
        className="px-6 md:px-12 lg:px-20 pt-12 lg:pt-16 pb-12"
        style={{
          background:
            "radial-gradient(ellipse at 50% -10%, rgba(232,178,58,0.22), transparent 55%)",
        }}
      >
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-12 items-end max-w-[1280px] mx-auto">
          <div>
            <div className="eyebrow">The threshold · no project required</div>
            <h1 className="font-display text-[56px] md:text-[80px] leading-[0.95] mt-3 max-w-[14ch]">
              Cross <span className="italic">into</span> the{" "}
              <span className="highlight">forge</span>.
            </h1>
            <p className="font-hand text-[22px] text-[color:var(--color-sepia-deep)] mt-4 leading-snug max-w-[60ch]">
              one prompt. one image, if you have one. one model. the maenads
              will work and bring it back.
            </p>
          </div>
          <DoorwaySvg />
        </div>
      </section>

      {/* ====== FORGE WORKSPACE ====== */}
      <section className="px-6 md:px-12 lg:px-20 pb-16 max-w-[1280px] mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8">
          {/* LEFT: forge picker, prompt, options, action */}
          <div>
            {/* Forge picker */}
            <div className="eyebrow">Choose the forge</div>
            <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
              <ForgePickerCard
                selected={kind === "image"}
                onSelect={() => setKind("image")}
                topLabel="Still · the mask"
                modelLabel={imageDef.label}
                title="the still forge"
                hand="one frame · holds the breath"
              />
              <ForgePickerCard
                selected={kind === "animation"}
                onSelect={() => setKind("animation")}
                topLabel="Motion · the rite"
                modelLabel={animationDef.label}
                title="the motion forge"
                hand="four to twelve seconds · sets it moving"
              />
            </div>

            {/* Model select for the chosen forge */}
            <div className="mt-6">
              <div className="flex items-baseline justify-between">
                <div className="eyebrow">
                  {kind === "image" ? "The still forges" : "The motion forges"}
                </div>
                <div className="font-hand text-[15px] text-[color:var(--color-sepia-deep)]">
                  swap any time
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {kind === "image"
                  ? Object.values(IMAGE_MODELS).map((m) => (
                      <ModelChip
                        key={m.id}
                        selected={m.id === imageModelId}
                        onSelect={() => setImageModelId(m.id)}
                        label={m.label}
                        sub={`~${m.approx_cost_cents}¢`}
                      />
                    ))
                  : Object.values(ANIMATION_MODELS).map((m) => (
                      <ModelChip
                        key={m.id}
                        selected={m.id === animationModelId}
                        onSelect={() => setAnimationModelId(m.id)}
                        label={m.label}
                        sub={`~${m.approx_cost_cents}¢`}
                      />
                    ))}
              </div>
              <p className="font-hand text-[14px] text-[color:var(--color-sepia-deep)]/80 mt-2 leading-snug">
                {def.description}
              </p>
            </div>

            {/* Prompt */}
            <div className="mt-8">
              <div className="flex items-baseline justify-between">
                <div className="eyebrow">Tell the forge</div>
                <div className="font-hand text-[16px] text-[color:var(--color-sepia-deep)]">
                  be specific. light, lens, mood, gesture.
                </div>
              </div>
              <div className="mt-3 border border-[color:var(--color-ink)]/50 bg-paper focus-within:border-ink transition">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={6}
                  maxLength={4000}
                  placeholder="a girl in a barn at dusk, holding a copper coin, lit by one swinging bulb. 35mm, shallow depth of field, photochemical grain, low golden hour. she is not looking at the coin."
                  className="w-full bg-transparent outline-none resize-none font-display text-[20px] sm:text-[22px] p-5 placeholder:italic placeholder:text-[color:var(--color-sepia-deep)] leading-snug"
                  onPaste={(e) => {
                    const file = Array.from(e.clipboardData?.items ?? [])
                      .filter((it) => it.kind === "file" && it.type.startsWith("image/"))
                      .map((it) => it.getAsFile())
                      .find((f): f is File => f instanceof File);
                    if (file) {
                      e.preventDefault();
                      void onPickFile(file);
                    }
                  }}
                />
                <div className="flex items-center justify-between border-t border-[color:var(--color-sepia)]/40 px-4 py-2">
                  <div className="font-hand text-[14px] text-[color:var(--color-sepia-deep)]">
                    paste an image · drag in · or use the seed slot below
                  </div>
                  <div className="font-mono text-[10px] text-[color:var(--color-ink-soft)] tracking-[0.22em] uppercase">
                    {charCount} / 4000
                  </div>
                </div>
              </div>
            </div>

            {/* Settings */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Seed image */}
              <div className="md:col-span-1">
                <div className="eyebrow">Seed · the source</div>
                <label
                  className="mt-2 block border border-dashed border-[color:var(--color-sepia-deep)] aspect-[4/5] still-placeholder relative grid place-items-center cursor-pointer hover:border-ink transition-colors overflow-hidden"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const f = e.dataTransfer.files?.[0];
                    if (f) void onPickFile(f);
                  }}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void onPickFile(f);
                      e.target.value = "";
                    }}
                  />
                  {sourcePreview ? (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={sourcePreview}
                        alt="Seed"
                        className="absolute inset-0 w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        aria-label="Remove seed"
                        onClick={(e) => {
                          e.preventDefault();
                          setSourceUrl(null);
                          setSourcePreview(null);
                        }}
                        className="absolute top-2 right-2 w-6 h-6 bg-paper border border-ink/40 font-mono text-[10px] text-ink"
                      >
                        ×
                      </button>
                    </>
                  ) : uploading ? (
                    <div className="text-center px-3">
                      <div className="font-display italic text-[20px]">
                        the page turns…
                      </div>
                    </div>
                  ) : (
                    <div className="text-center px-3">
                      <div className="font-display italic text-[20px]">
                        drop a still
                      </div>
                      <div className="font-hand text-[15px] text-[color:var(--color-sepia-deep)] mt-1">
                        or paste a frame · jpg / png
                      </div>
                      <div className="eyebrow text-[color:var(--color-ink-soft)] mt-3">
                        {kind === "animation" ? "required" : "optional"}
                      </div>
                    </div>
                  )}
                </label>
              </div>

              {/* Ratio + quality/duration + count */}
              <div className="md:col-span-2 space-y-4">
                <div>
                  <div className="eyebrow">Ratio</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {aspectOptions.map((a) => (
                      <button
                        key={a}
                        type="button"
                        onClick={() => setAspect(a)}
                        className={
                          a === aspect
                            ? "btn-ink !py-1.5 !px-3 text-[12px]"
                            : "btn-paper !py-1.5 !px-3 text-[12px]"
                        }
                      >
                        {a}
                      </button>
                    ))}
                  </div>
                </div>

                {kind === "image" && imageDef.quality ? (
                  <div>
                    <div className="eyebrow">Quality</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {imageDef.quality.map((q) => (
                        <button
                          key={q}
                          type="button"
                          onClick={() => setQuality(q)}
                          className={
                            q === quality
                              ? "btn-ink !py-1.5 !px-3 text-[12px]"
                              : "btn-paper !py-1.5 !px-3 text-[12px]"
                          }
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                {durationOptions ? (
                  <div>
                    <div className="eyebrow">Duration</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {durationOptions.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setDuration(d)}
                          className={
                            d === duration
                              ? "btn-ink !py-1.5 !px-3 text-[12px]"
                              : "btn-paper !py-1.5 !px-3 text-[12px]"
                          }
                        >
                          {d}s
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}

                <div>
                  <div className="eyebrow">Cost · estimate</div>
                  <div className="mt-2 font-display text-[22px]">
                    {kind === "image"
                      ? `≈ ${imageDef.approx_cost_cents}¢`
                      : `≈ ${animationDef.approx_cost_cents}¢`}{" "}
                    <span className="italic text-[color:var(--color-sepia-deep)]">
                      / call
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Call the forge */}
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={generate}
                disabled={busy || !prompt.trim()}
                className="btn-ink !py-3 !px-7 text-[14px] tracking-[0.18em] uppercase disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {busy ? "the maenads at work…" : "Call the forge ⟶"}
              </button>
              <span className="font-hand text-[16px] text-[color:var(--color-sepia-deep)] ml-auto">
                {kind === "image"
                  ? "Mae takes about 14 seconds. Ari watches."
                  : "Motion runs longer — fetch a coffee."}
              </span>
            </div>

            {error ? (
              <p className="mt-4 font-hand text-[16px] text-[color:var(--color-red-grease)]">
                {error}
              </p>
            ) : null}
          </div>

          {/* RIGHT: side altar */}
          <aside className="space-y-6">
            <div className="leaf-flat p-5">
              <div className="eyebrow">A note · what to ask for</div>
              <p className="font-display italic text-[18px] mt-2 leading-snug">
                The forge listens like an old printer. It hears nouns first,
                then light, then verbs. Mood goes last. If you give it
                everything, you&rsquo;ll get a poster. If you give it three
                things, you&rsquo;ll get a frame.
              </p>
            </div>

            <div>
              <div className="eyebrow">Recent forges</div>
              {recentForges.length === 0 ? (
                <p className="mt-3 font-hand text-[15px] text-[color:var(--color-sepia-deep)]">
                  the page is fresh.
                </p>
              ) : (
                <ul className="mt-3 space-y-2 text-[13px] font-mono">
                  {recentForges.map((g) => (
                    <li key={g.id} className="flex items-center justify-between gap-2">
                      <span className="truncate">
                        {g.kind} ·{" "}
                        <span className="text-[color:var(--color-sepia-deep)]">
                          &ldquo;{g.prompt.slice(0, 32)}
                          {g.prompt.length > 32 ? "…" : ""}&rdquo;
                        </span>
                      </span>
                      <span className="text-[color:var(--color-ink-soft)] shrink-0">
                        {shortAgo(g.created_at)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      </section>

      {/* ====== ARCHIVE ====== */}
      <section className="border-t border-[color:var(--color-sepia)]/30 paper-deep-grain px-6 md:px-12 lg:px-20 py-14">
        <div className="max-w-[1280px] mx-auto">
          <div className="flex items-baseline justify-between flex-wrap gap-3">
            <div>
              <div className="eyebrow">
                The archive · what the forges have made
              </div>
              <h2 className="font-display text-[36px] mt-1">
                A <span className="italic">contact sheet</span>
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {(["stills", "motions", "all"] as const).map((f) => {
                const value =
                  f === "stills" ? "image" : f === "motions" ? "animation" : "all";
                const selected = archiveFilter === value;
                return (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setArchiveFilter(value as typeof archiveFilter)}
                    className={
                      selected
                        ? "btn-ink !py-1.5 !px-3 text-[12px]"
                        : "btn-paper !py-1.5 !px-3 text-[12px]"
                    }
                  >
                    {f}
                  </button>
                );
              })}
            </div>
          </div>

          {filteredHistory.length === 0 ? (
            <p className="mt-6 font-hand text-[18px] text-[color:var(--color-sepia-deep)] text-center py-10">
              the contact sheet is blank. call the forge above.
            </p>
          ) : (
            <div className="mt-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {filteredHistory.map((g) => (
                <ArchiveTile key={g.id} g={g} />
              ))}
            </div>
          )}

          <div className="mt-7 flex items-center justify-between flex-wrap gap-2">
            <span className="font-hand text-[18px] text-[color:var(--color-sepia-deep)]">
              every call lands here, for keeps.
            </span>
            <div className="eyebrow text-[color:var(--color-ink-soft)]">
              archive · {history.filter((g) => g.kind === "image").length} stills
              · {history.filter((g) => g.kind === "animation").length} motions
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------
// Pieces
// ---------------------------------------------------------------------

function ForgePickerCard({
  selected,
  onSelect,
  topLabel,
  modelLabel,
  title,
  hand,
}: {
  selected: boolean;
  onSelect: () => void;
  topLabel: string;
  modelLabel: string;
  title: string;
  hand: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`leaf-flat p-4 text-left transition-colors ${
        selected
          ? "bg-ink !border-ink"
          : "hover:border-[color:var(--color-sepia-deep)]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div
          className={`font-mono text-[10px] tracking-[0.22em] uppercase ${
            selected
              ? "text-[color:var(--color-paper)]"
              : "text-[color:var(--color-ink-soft)]"
          }`}
        >
          {topLabel}
        </div>
        <span
          className={`font-mono text-[10px] tracking-[0.22em] uppercase ${
            selected
              ? "text-[color:var(--color-paper)]/70"
              : "text-[color:var(--color-sepia-deep)]"
          }`}
        >
          {modelLabel}
        </span>
      </div>
      <div
        className={`font-display text-[24px] sm:text-[26px] mt-1 ${
          selected ? "text-paper" : "text-ink"
        }`}
      >
        the <span className="italic">{title.split(" ")[1]}</span> forge
      </div>
      <div
        className={`font-hand text-[15px] mt-0.5 ${
          selected
            ? "text-[color:var(--color-paper)]/80"
            : "text-[color:var(--color-sepia-deep)]"
        }`}
      >
        {hand}
      </div>
    </button>
  );
}

function ModelChip({
  selected,
  onSelect,
  label,
  sub,
}: {
  selected: boolean;
  onSelect: () => void;
  label: string;
  sub: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`px-3 py-1.5 text-[12px] border transition-colors ${
        selected
          ? "bg-ink text-paper border-ink"
          : "bg-paper text-ink border-[color:var(--color-ink)]/30 hover:border-ink"
      }`}
    >
      <span className="font-body">{label}</span>
      <span
        className={`ml-1.5 font-mono text-[10px] ${
          selected
            ? "text-[color:var(--color-paper)]/70"
            : "text-[color:var(--color-ink-soft)]"
        }`}
      >
        {sub}
      </span>
    </button>
  );
}

function ArchiveTile({ g }: { g: Generation }) {
  const pending = g.status === "queued" || g.status === "processing";
  return (
    <div
      className={`aspect-square relative overflow-hidden group ${
        g.kind === "animation" ? "still-placeholder-dark" : "still-placeholder"
      }`}
    >
      {g.output_url && g.kind === "image" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={g.output_url}
          alt={g.prompt.slice(0, 60)}
          className="absolute inset-0 w-full h-full object-cover"
          loading="lazy"
        />
      ) : g.output_url && g.kind === "animation" ? (
        <video
          src={g.output_url}
          controls
          playsInline
          muted
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 grid place-items-center">
          <span
            className={`font-mono text-[10px] tracking-[0.22em] uppercase ${
              g.kind === "animation"
                ? "text-[color:var(--color-paper)]/70"
                : "text-[color:var(--color-ink-soft)]"
            } ${pending ? "oracle-pulse" : ""}`}
          >
            {pending ? "the maenads at work" : g.status}
          </span>
        </div>
      )}
      <div
        className={`absolute bottom-1 left-1 right-1 font-mono text-[9px] tracking-[0.22em] uppercase truncate ${
          g.kind === "animation"
            ? "text-[color:var(--color-paper)]/85"
            : "text-[color:var(--color-ink-soft)]"
        }`}
      >
        {g.prompt.slice(0, 22)}
        {g.prompt.length > 22 ? "…" : ""}
      </div>
      <div
        className={`absolute top-1 right-1 font-mono text-[9px] tracking-[0.22em] uppercase ${
          g.kind === "animation"
            ? "text-[color:var(--color-paper)]/70"
            : "text-[color:var(--color-ink-soft)]"
        }`}
      >
        {g.kind === "image" ? "still" : "▶"}
      </div>
    </div>
  );
}

function DoorwaySvg() {
  return (
    <div className="hidden lg:block max-w-[360px] justify-self-end">
      <svg viewBox="0 0 280 360" className="w-full" aria-hidden>
        <defs>
          <linearGradient id="warm-door" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8B23A" stopOpacity=".55" />
            <stop offset="100%" stopColor="#E8B23A" stopOpacity=".05" />
          </linearGradient>
        </defs>
        <path
          d="M40 340 V 140 a 100 100 0 0 1 200 0 V 340"
          fill="url(#warm-door)"
          stroke="var(--color-ink)"
          strokeWidth="1.6"
        />
        <line
          x1="20"
          y1="340"
          x2="260"
          y2="340"
          stroke="var(--color-ink)"
          strokeWidth="1.6"
        />
        <ellipse cx="140" cy="240" rx="40" ry="60" fill="#E8B23A" opacity=".15" />
        <path
          d="M140 200 C 130 215, 124 224, 128 234 C 132 244, 148 244, 152 234 C 156 224, 150 215, 140 200 Z"
          fill="#E8B23A"
          className="flicker"
        />
        <path
          d="M50 340 C 60 280, 30 220, 60 160 C 80 120, 130 100, 140 80"
          stroke="var(--color-sepia-deep)"
          strokeWidth="1"
          fill="none"
        />
        <path
          d="M230 340 C 220 280, 250 220, 220 160 C 200 120, 150 100, 140 80"
          stroke="var(--color-sepia-deep)"
          strokeWidth="1"
          fill="none"
        />
        <circle cx="58" cy="290" r="2.5" fill="var(--color-sepia-deep)" />
        <circle cx="62" cy="296" r="2" fill="var(--color-sepia-deep)" />
        <circle cx="222" cy="290" r="2.5" fill="var(--color-sepia-deep)" />
        <circle cx="218" cy="296" r="2" fill="var(--color-sepia-deep)" />
        <g transform="translate(140 105)">
          <ellipse
            cx="0"
            cy="0"
            rx="18"
            ry="22"
            fill="none"
            stroke="var(--color-ink)"
            strokeWidth="1.2"
          />
          <path
            d="M0 -22 C 18 -22, 22 22, 0 22 Z"
            fill="var(--color-ink)"
            opacity=".10"
          />
          <ellipse cx="-6" cy="-2" rx="2" ry="1" fill="var(--color-ink)" />
          <ellipse cx="6" cy="-2" rx="2" ry="1" fill="var(--color-ink)" />
        </g>
      </svg>
    </div>
  );
}

function shortAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}
