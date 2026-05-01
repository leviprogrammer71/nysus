"use client";

import { useCallback, useState } from "react";
import type { TimelineClip } from "../timeline/types";
import type { SceneBibleOverrides } from "@/lib/supabase/types";
import { ChatPanel } from "./chat-panel";
import {
  IMAGE_MODELS,
  ANIMATION_MODELS,
  DEFAULT_IMAGE_MODEL,
  DEFAULT_ANIMATION_MODEL,
  type ImageModelId,
  type AnimationModelId,
} from "@/lib/models";

/**
 * Tabbed scene card on Mae's board.
 *
 *   Script  · the order of service — image_prompt, motion prompt,
 *             narration. Open the Rite to refine with Ari.
 *   Image   · the mask — still preview, model dropdown, redraw.
 *   Animate · the rite — video, model dropdown, animate / re-animate.
 *   Notes   · the carve-out — per-scene bible overrides + free notes.
 *
 * The card stays compact when collapsed (just the still + status)
 * and expands into the tab strip when the user opens it. The Rite
 * (scene-mode chat) is reachable from the Script tab via "Open the
 * Rite", which renders a ChatPanel scoped to this clip.
 */

type Tab = "script" | "image" | "animate" | "notes";

export function SceneCard({
  clip,
  busy,
  onGenerateStill,
  onAnimate,
  onPatchClip,
}: {
  clip: TimelineClip;
  busy: boolean;
  /** Optional model override (Image tab dropdown). */
  onGenerateStill: (modelId?: ImageModelId) => void;
  /** Optional model override (Animate tab dropdown). */
  onAnimate: (modelId?: AnimationModelId) => void;
  /**
   * Persist a partial change back to the clip row. Used by the Notes
   * tab to write bible_overrides via PATCH /api/clips/[id]. Returning
   * a Promise so the parent can refresh after.
   */
  onPatchClip: (id: string, partial: Partial<TimelineClip>) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("script");
  const [riteOpen, setRiteOpen] = useState(false);

  const stillBusy = busy && clip.still_status !== "complete";
  const animateBusy = busy && clip.still_status === "complete";
  const animateRunning =
    clip.status === "queued" || clip.status === "processing";

  return (
    <article className="surface-card animate-lift overflow-hidden rounded-lg">
      {/* Compact head — still preview + summary + open toggle */}
      <div className="flex gap-3 p-3">
        <div className="relative h-20 w-16 shrink-0 overflow-hidden rounded-md bg-ink/5">
          {clip.still_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={clip.still_image_url}
              alt={`Scene ${clip.order_index + 1}`}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center font-body text-[10px] uppercase tracking-widest text-ink-soft/50">
              {stillBusy ? "…" : "no still"}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-[13px] text-ink">
              Scene {clip.order_index + 1}
            </span>
            <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
              {animateRunning
                ? "rendering"
                : clip.status === "complete"
                ? "rendered"
                : clip.still_status === "complete"
                ? "still ready"
                : "drafted"}
            </span>
          </div>
          <p className="mt-0.5 line-clamp-2 font-body text-[12px] leading-snug text-ink-soft/85">
            {clip.prompt}
          </p>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            className="mt-1 font-body text-[10px] uppercase tracking-widest text-ink-soft/60 hover:text-ink"
          >
            {open ? "close" : "open"}
          </button>
        </div>
      </div>

      {open ? (
        <>
          {/* Tab strip — Script · Image · Animate · Notes. Mythological
              subtitles live under each label so the card reads as part
              of the procession, not a project board. */}
          <TabStrip tab={tab} setTab={setTab} clip={clip} />

          <div className="border-t border-ink/10 bg-paper/60 px-3 py-3">
            {tab === "script" ? (
              <ScriptTab
                clip={clip}
                onOpenRite={() => setRiteOpen((v) => !v)}
                riteOpen={riteOpen}
              />
            ) : null}
            {tab === "image" ? (
              <ImageTab
                clip={clip}
                stillBusy={stillBusy}
                onGenerateStill={onGenerateStill}
              />
            ) : null}
            {tab === "animate" ? (
              <AnimateTab
                clip={clip}
                animateBusy={animateBusy}
                animateRunning={animateRunning}
                onAnimate={onAnimate}
              />
            ) : null}
            {tab === "notes" ? (
              <NotesTab clip={clip} onPatchClip={onPatchClip} />
            ) : null}
          </div>

          {/* The Rite — scene-scoped Ari chat. Inline drawer so the
              user keeps the still in their peripheral vision while
              they rework prompts. */}
          {riteOpen ? (
            <div className="border-t border-ink/10 bg-paper px-3 py-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="font-hand text-sepia-deep text-sm">
                  the Rite — scene {clip.order_index + 1}
                </span>
                <button
                  type="button"
                  onClick={() => setRiteOpen(false)}
                  className="font-body text-[10px] uppercase tracking-widest text-ink-soft hover:text-ink"
                >
                  close rite
                </button>
              </div>
              <ChatPanel
                projectId={clip.project_id}
                initialMessages={[]}
                mode="scene"
                sceneId={clip.id}
                prefillEventName={`nysus:prefill-chat:rite:${clip.id}`}
                placeholder="rework this scene with Ari…"
              />
            </div>
          ) : null}
        </>
      ) : null}

      {/* Always-visible action footer when there's a video to play */}
      {clip.video_url && clip.status === "complete" && !open ? (
        <video
          src={clip.video_url}
          controls
          playsInline
          webkit-playsinline="true"
          muted
          preload="metadata"
          className="w-full bg-ink/90"
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-1.5 border-t border-ink/10 bg-paper px-3 py-2">
        <button
          type="button"
          onClick={() => onGenerateStill()}
          disabled={stillBusy}
          className="inline-flex h-9 items-center rounded-full border border-ink/25 bg-paper px-3 font-body text-[11px] uppercase tracking-widest text-ink hover:bg-ink/5 animate-press disabled:opacity-50"
        >
          {stillBusy
            ? "Drawing…"
            : clip.still_image_url
            ? "Redraw"
            : "Generate still"}
        </button>
        <button
          type="button"
          onClick={() => onAnimate()}
          disabled={
            animateBusy ||
            !clip.still_image_url ||
            animateRunning
          }
          title={
            !clip.still_image_url
              ? "Generate the still first"
              : "Animate this scene"
          }
          className="inline-flex h-9 items-center rounded-full bg-ink px-3 font-body text-[11px] uppercase tracking-widest text-paper hover:bg-ink-soft animate-press disabled:opacity-40"
        >
          {animateRunning
            ? "Rendering…"
            : clip.status === "complete"
            ? "Re-animate"
            : "Animate →"}
        </button>
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------
// Tab strip
// ---------------------------------------------------------------------

function TabStrip({
  tab,
  setTab,
  clip,
}: {
  tab: Tab;
  setTab: (t: Tab) => void;
  clip: TimelineClip;
}) {
  const overrideCount =
    (clip.bible_overrides?.disable_character_ids?.length ?? 0) +
    (clip.bible_overrides?.disable_style ? 1 : 0) +
    (clip.bible_overrides?.notes ? 1 : 0);

  const items: Array<{ id: Tab; label: string; sub: string; dot?: boolean }> = [
    { id: "script", label: "Script", sub: "the order" },
    {
      id: "image",
      label: "Image",
      sub: "the mask",
      dot: clip.still_status === "complete",
    },
    {
      id: "animate",
      label: "Animate",
      sub: "the rite",
      dot: clip.status === "complete",
    },
    {
      id: "notes",
      label: "Notes",
      sub: "the carve-out",
      dot: overrideCount > 0,
    },
  ];

  return (
    <div className="flex gap-0.5 border-t border-ink/10 bg-paper-deep px-1.5 pt-1.5">
      {items.map((it) => {
        const active = tab === it.id;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTab(it.id)}
            className={`relative flex flex-1 flex-col items-center rounded-t-md px-1 py-1.5 transition-colors animate-press ${
              active
                ? "bg-paper text-ink shadow-[0_-1px_3px_rgba(27,42,58,0.04)]"
                : "text-ink-soft/65 hover:text-ink"
            }`}
          >
            <span className="font-display text-[10px] uppercase tracking-[0.18em] leading-none">
              {it.label}
            </span>
            <span
              className={`mt-0.5 font-hand text-[10px] leading-none ${
                active ? "text-sepia-deep" : "text-ink-soft/50"
              }`}
            >
              {it.sub}
            </span>
            {it.dot && !active ? (
              <span
                aria-hidden
                className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-green-seal"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------
// Tab bodies
// ---------------------------------------------------------------------

function ScriptTab({
  clip,
  onOpenRite,
  riteOpen,
}: {
  clip: TimelineClip;
  onOpenRite: () => void;
  riteOpen: boolean;
}) {
  const imagePrompt =
    clip.still_prompt ?? clip.shot_metadata?.image_prompt ?? "";
  const animationModel = clip.shot_metadata?.animation_model ?? "seedance";
  return (
    <div className="space-y-3 font-body text-[12px] leading-relaxed text-ink-soft/90">
      {imagePrompt ? (
        <Field label="Image prompt">
          <p className="font-mono text-[11px] text-ink whitespace-pre-wrap">
            {imagePrompt}
          </p>
        </Field>
      ) : null}
      <Field label="Motion prompt">
        <p className="font-mono text-[11px] text-ink whitespace-pre-wrap">
          {clip.prompt}
        </p>
      </Field>
      {clip.narration ? (
        <Field label="Narration">
          <p className="font-hand text-[13px] text-sepia-deep whitespace-pre-wrap">
            {clip.narration}
          </p>
        </Field>
      ) : null}
      <Field label="Animation model">
        <span className="font-mono text-[11px] text-ink">{animationModel}</span>
      </Field>

      <button
        type="button"
        onClick={onOpenRite}
        className="inline-flex h-9 items-center rounded-full border border-ink/25 bg-paper px-3 font-body text-[11px] uppercase tracking-widest text-ink hover:bg-ink/5 animate-press"
      >
        {riteOpen ? "Close the Rite" : "Open the Rite →"}
      </button>
      <p className="font-hand text-[11px] text-ink-soft/70 leading-snug">
        the Rite is Ari, scoped to this scene. open it to refine the image,
        the motion, the line.
      </p>
    </div>
  );
}

function ImageTab({
  clip,
  stillBusy,
  onGenerateStill,
}: {
  clip: TimelineClip;
  stillBusy: boolean;
  onGenerateStill: (modelId?: ImageModelId) => void;
}) {
  const [model, setModel] = useState<ImageModelId>(DEFAULT_IMAGE_MODEL);
  return (
    <div className="space-y-3">
      {clip.still_image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={clip.still_image_url}
          alt={`Still for scene ${clip.order_index + 1}`}
          className="w-full rounded-md border border-ink/10 object-cover"
        />
      ) : (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-ink/15 bg-paper-deep font-body text-[11px] uppercase tracking-widest text-ink-soft/55">
          no still yet
        </div>
      )}

      <ModelSelect
        kind="image"
        value={model}
        onChange={(v) => setModel(v as ImageModelId)}
      />

      <button
        type="button"
        onClick={() => onGenerateStill(model)}
        disabled={stillBusy}
        className="inline-flex h-10 w-full items-center justify-center rounded-full bg-ink px-3 font-body text-[11px] uppercase tracking-widest text-paper hover:bg-ink-soft animate-press disabled:opacity-40"
      >
        {stillBusy
          ? "Drawing…"
          : clip.still_image_url
          ? "Redraw with this forge"
          : "Generate still with this forge"}
      </button>
      <p className="font-hand text-[11px] text-ink-soft/70 leading-snug">
        each draw adds a generation to your archive — the previous still is
        preserved in case you want to come back to it.
      </p>
    </div>
  );
}

function AnimateTab({
  clip,
  animateBusy,
  animateRunning,
  onAnimate,
}: {
  clip: TimelineClip;
  animateBusy: boolean;
  animateRunning: boolean;
  onAnimate: (modelId?: AnimationModelId) => void;
}) {
  const [model, setModel] = useState<AnimationModelId>(
    DEFAULT_ANIMATION_MODEL,
  );
  return (
    <div className="space-y-3">
      {clip.video_url && clip.status === "complete" ? (
        <video
          src={clip.video_url}
          controls
          playsInline
          webkit-playsinline="true"
          muted
          preload="metadata"
          className="w-full rounded-md bg-ink/90"
        />
      ) : (
        <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-ink/15 bg-paper-deep font-body text-[11px] uppercase tracking-widest text-ink-soft/55">
          {animateRunning
            ? "rendering…"
            : clip.still_image_url
            ? "no clip yet"
            : "the still must come first"}
        </div>
      )}

      <ModelSelect
        kind="animation"
        value={model}
        onChange={(v) => setModel(v as AnimationModelId)}
      />

      <button
        type="button"
        onClick={() => onAnimate(model)}
        disabled={animateBusy || !clip.still_image_url || animateRunning}
        className="inline-flex h-10 w-full items-center justify-center rounded-full bg-ink px-3 font-body text-[11px] uppercase tracking-widest text-paper hover:bg-ink-soft animate-press disabled:opacity-40"
      >
        {animateRunning
          ? "Rendering…"
          : clip.status === "complete"
          ? "Re-animate with this forge"
          : "Animate with this forge"}
      </button>
    </div>
  );
}

function NotesTab({
  clip,
  onPatchClip,
}: {
  clip: TimelineClip;
  onPatchClip: (id: string, partial: Partial<TimelineClip>) => Promise<void>;
}) {
  const overrides = clip.bible_overrides ?? {};
  const [disableStyle, setDisableStyle] = useState<boolean>(
    Boolean(overrides.disable_style),
  );
  const [omitText, setOmitText] = useState<string>(
    (overrides.disable_character_ids ?? []).join(", "),
  );
  const [notes, setNotes] = useState<string>(overrides.notes ?? "");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = useCallback(async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const ids = omitText
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const next: SceneBibleOverrides = {};
      if (ids.length > 0) next.disable_character_ids = ids;
      if (disableStyle) next.disable_style = true;
      if (notes.trim().length > 0) next.notes = notes.trim();

      const res = await fetch(`/api/clips/${clip.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bible_overrides: next }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error ?? "Save failed");
      await onPatchClip(clip.id, { bible_overrides: next });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [clip.id, omitText, disableStyle, notes, onPatchClip]);

  return (
    <div className="space-y-3 font-body text-[12px] leading-relaxed text-ink-soft/90">
      <p className="font-hand text-[12px] text-ink-soft/80 leading-snug">
        per-scene carve-out. global bible stays intact &mdash; this only
        applies to scene {clip.order_index + 1}.
      </p>

      <label className="flex flex-col gap-1">
        <span className="font-hand text-sepia-deep text-[12px]">
          omit characters (comma-separated names)
        </span>
        <input
          value={omitText}
          onChange={(e) => setOmitText(e.target.value)}
          placeholder="e.g. Marcus, Elena"
          className="w-full h-10 px-3 bg-paper border border-ink/20 focus:border-ink font-body text-ink text-[12px] outline-none"
        />
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={disableStyle}
          onChange={(e) => setDisableStyle(e.target.checked)}
          className="accent-ink h-4 w-4"
        />
        <span className="font-body text-[12px] text-ink">
          drop the bible&rsquo;s visual style for this scene
        </span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-hand text-sepia-deep text-[12px]">notes</span>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          placeholder='e.g. "flashback — protagonist is a child here, palette flips warm to cold"'
          className="w-full px-3 py-2 bg-paper border border-ink/20 focus:border-ink font-body text-ink text-[12px] outline-none resize-none"
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={busy}
          className="inline-flex h-9 items-center rounded-full bg-ink px-3 font-body text-[11px] uppercase tracking-widest text-paper hover:bg-ink-soft animate-press disabled:opacity-40"
        >
          {busy ? "Saving…" : "Save overrides"}
        </button>
        {saved ? (
          <span className="font-hand text-sepia-deep text-[12px]">saved</span>
        ) : null}
        {error ? (
          <span className="font-hand text-red-grease text-[12px]">{error}</span>
        ) : null}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------
// Bits
// ---------------------------------------------------------------------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <span className="font-body text-[9px] uppercase tracking-widest text-ink-soft/60">
        {label}
      </span>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}

function ModelSelect({
  kind,
  value,
  onChange,
}: {
  kind: "image" | "animation";
  value: string;
  onChange: (v: string) => void;
}) {
  const options =
    kind === "image"
      ? Object.values(IMAGE_MODELS)
      : Object.values(ANIMATION_MODELS);
  const active = options.find((m) => m.id === value);
  return (
    <label className="flex flex-col gap-1">
      <span className="font-hand text-sepia-deep text-[12px]">
        {kind === "image" ? "still forge" : "motion forge"}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-10 px-3 bg-paper border border-ink/20 focus:border-ink font-body text-ink text-[12px] outline-none"
      >
        {options.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      {active ? (
        <span className="font-body text-[10px] text-ink-soft/65 leading-snug">
          {active.description}
        </span>
      ) : null}
    </label>
  );
}
