"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DualChat } from "./chat/dual-chat";
import type { ChatMessage } from "./chat/message";
import { Timeline } from "./timeline/timeline";
import { ClipDetailSheet } from "./timeline/clip-detail-sheet";
import { StillsPanel } from "./timeline/stills-panel";
import type { TimelineClip } from "./timeline/types";
import type { ShotPrompt } from "@/lib/shot-prompt";
import type { CharacterSheet, AestheticBible } from "@/lib/supabase/types";
import { ReferenceStrip } from "./edit/reference-strip";
import { ShareButton } from "@/app/components/share-button";
import { DraftModeToggle } from "@/app/components/draft-mode-toggle";
import { KeepRolling } from "@/app/components/keep-rolling";
import { DeleteProjectButton } from "@/app/components/delete-project-button";
import { StageRail } from "@/app/components/stage-rail";
import type { ProjectStage } from "@/lib/supabase/types";

/**
 * Orchestrates the project workspace: chat, timeline, clip detail.
 * Clip state is owned here so Chat's shot cards and Timeline's clip
 * cards both see live updates without prop drilling.
 */
export function Workspace({
  projectId,
  projectTitle,
  projectDescription,
  initialAriMessages,
  initialConceptMessages,
  initialScriptMessages,
  initialClips,
  updatedAt,
  characterSheet,
  aestheticBible,
  initialStage,
}: {
  projectId: string;
  projectTitle: string;
  projectDescription: string | null;
  /** Legacy alias — points at the Liturgy ledger. */
  initialAriMessages: ChatMessage[];
  /** Oracle (concept) ledger — pre-Liturgy ideation thread. */
  initialConceptMessages?: ChatMessage[];
  /** Liturgy (script) ledger — scene drafting + legacy "ari" rows. */
  initialScriptMessages?: ChatMessage[];
  initialClips: TimelineClip[];
  updatedAt: string;
  characterSheet: CharacterSheet;
  aestheticBible: AestheticBible;
  initialStage: ProjectStage;
}) {
  const [clips, setClips] = useState<TimelineClip[]>(
    [...initialClips].sort((a, b) => a.order_index - b.order_index),
  );
  const [openClipId, setOpenClipId] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);

  const clipsRef = useRef(clips);
  useEffect(() => {
    clipsRef.current = clips;
  }, [clips]);

  const upsertClip = useCallback((clip: TimelineClip) => {
    setClips((prev) => {
      const idx = prev.findIndex((c) => c.id === clip.id);
      if (idx === -1) {
        return [...prev, clip].sort((a, b) => a.order_index - b.order_index);
      }
      const next = prev.slice();
      next[idx] = { ...prev[idx], ...clip };
      return next;
    });
  }, []);

  const latestCompletedClip = useMemo(() => {
    for (let i = clips.length - 1; i >= 0; i--) {
      if (clips[i].status === "complete") return clips[i];
    }
    return null;
  }, [clips]);

  const generateFromShot = useCallback(
    async (shot: ShotPrompt) => {
      setGenError(null);
      const seedUrl = latestCompletedClip?.last_frame_url ?? null;
      const seedSource: TimelineClip["seed_source"] =
        seedUrl && shot.suggested_seed_behavior !== "none" ? "auto" : "none";

      // Optimistic row (negative id prefix avoids collision with real UUIDs)
      const optimistic: TimelineClip = {
        id: `pending-${Date.now()}`,
        project_id: projectId,
        order_index:
          (clipsRef.current[clipsRef.current.length - 1]?.order_index ?? -1) + 1,
        prompt: shot.prompt,
        shot_metadata: {
          shot_type: shot.shot_type,
          shot_number: shot.shot_number,
          duration: shot.duration,
          continuity_notes: shot.continuity_notes,
          voice_direction: shot.voice_direction,
          suggested_seed_behavior: shot.suggested_seed_behavior,
          image_prompt: shot.image_prompt,
          narration: shot.narration,
          animation_model: shot.animation_model,
        },
        seed_image_url: seedUrl,
        seed_source: seedSource,
        video_url: null,
        last_frame_url: null,
        sampled_frames_urls: [],
        status: "queued",
        replicate_prediction_id: null,
        error_message: null,
        still_image_url: null,
        still_prompt: shot.image_prompt || null,
        still_status: "none",
        still_replicate_prediction_id: null,
        narration: shot.narration || null,
        created_at: new Date().toISOString(),
      };
      upsertClip(optimistic);

      try {
        const resp = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            project_id: projectId,
            shot,
            seed_image_url: seedUrl,
            seed_source: seedSource,
          }),
        });
        const body = await resp.json();
        if (!resp.ok) {
          throw new Error(body.error ?? resp.statusText);
        }
        // Replace optimistic with the real row id.
        setClips((prev) => {
          const next = prev.filter((c) => c.id !== optimistic.id);
          const status: TimelineClip["status"] =
            body.status === "starting" ? "queued" : "processing";
          const replacement: TimelineClip = {
            ...optimistic,
            id: body.clip_id as string,
            replicate_prediction_id: body.prediction_id as string,
            status,
          };
          return [...next, replacement].sort(
            (a, b) => a.order_index - b.order_index,
          );
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setGenError(msg);
        // Drop optimistic row
        setClips((prev) => prev.filter((c) => c.id !== optimistic.id));
      }
    },
    [projectId, latestCompletedClip, upsertClip],
  );

  // Poll any non-terminal clips every 3s. The route itself proactively
  // refreshes from Replicate so webhook-less dev still lands on the
  // final state.
  useEffect(() => {
    const interval = setInterval(async () => {
      const pending = clipsRef.current.filter(
        (c) =>
          !c.id.startsWith("pending-") &&
          (c.status === "queued" || c.status === "processing"),
      );
      if (pending.length === 0) return;
      await Promise.all(
        pending.map(async (c) => {
          try {
            const resp = await fetch(`/api/clips/${c.id}`, { cache: "no-store" });
            if (!resp.ok) return;
            const fresh = (await resp.json()) as TimelineClip;
            upsertClip(fresh);
          } catch {
            // ignore transient errors
          }
        }),
      );
    }, 3000);
    return () => clearInterval(interval);
  }, [upsertClip]);

  const openClip = useMemo(
    () => clips.find((c) => c.id === openClipId) ?? null,
    [clips, openClipId],
  );

  const inFlightCount = clips.filter(
    (c) => c.status === "queued" || c.status === "processing",
  ).length;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 pb-[calc(env(safe-area-inset-bottom)+6rem)] pt-6 sm:px-6 md:pb-8">
      {/* Breadcrumb + toolbar — workstation style. Tabs live in the
          primary nav (BottomNav on mobile, Dashboard link in corner). */}
      <header className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-ink/10 pb-3">
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-1.5 font-body text-[11px] uppercase tracking-widest text-ink-soft/70 min-w-0"
        >
          <Link href="/dashboard" className="hover:text-ink">
            Projects
          </Link>
          <span aria-hidden>/</span>
          <span className="truncate text-ink">{projectTitle}</span>
        </nav>
        <div className="flex items-center gap-1.5">
          <Link
            href={`/projects/${projectId}/edit`}
            className="inline-flex h-9 items-center rounded-full border border-ink/20 bg-paper px-3 font-body text-[11px] uppercase tracking-widest text-ink hover:bg-ink/5"
          >
            Edit
          </Link>
          <Link
            href={`/projects/${projectId}/storyboard`}
            className="inline-flex h-9 items-center rounded-full border border-ink/20 bg-paper px-3 font-body text-[11px] uppercase tracking-widest text-ink hover:bg-ink/5"
          >
            Storyboard
          </Link>
          <Link
            href={`/projects/${projectId}/stitch`}
            className="inline-flex h-9 items-center rounded-full bg-ink px-3 font-body text-[11px] uppercase tracking-widest text-paper hover:bg-ink-soft"
          >
            Stitch →
          </Link>
        </div>
      </header>

      {/* Title row with status pill + share + draft toggle */}
      <section className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl sm:text-4xl text-ink leading-tight">
            {projectTitle}
          </h1>
          {projectDescription ? (
            <p className="mt-1 font-body text-sm text-ink-soft/80 leading-relaxed max-w-xl">
              {projectDescription}
            </p>
          ) : null}
          <p className="mt-2 font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
            {clips.length} {clips.length === 1 ? "scene" : "scenes"}
            {inFlightCount > 0 ? ` · ${inFlightCount} rendering` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ShareButton projectId={projectId} />
          <DraftModeToggle projectId={projectId} />
          <DeleteProjectButton
            projectId={projectId}
            projectTitle={projectTitle}
          />
        </div>
      </section>

      {/* The Procession — six stages from seed to cut, rendered as a
          quiet ritual rail just above the chat. Tapping a stage is a
          nudge, not a gate; the underlying state advances naturally as
          the user works. */}
      <StageRail
        projectId={projectId}
        initialStage={initialStage}
        readiness={{
          concept:
            (characterSheet.characters?.length ?? 0) > 0,
          script: clips.length > 0,
          scenes: clips.length > 0,
          image: clips.some((c) => c.still_status === "complete"),
          animate: clips.some((c) => c.status === "complete"),
          stitch: clips.filter((c) => c.status === "complete").length >= 2,
        }}
      />

      {/* Chat comes FIRST — it's the driver for everything else.
          Two panes: Ari plans and Mae builds. User swipes between
          them on mobile, sees both on desktop. */}
      <KeepRolling clips={clips} />
      <section id="chat" className="scroll-mt-20">
        <DualChat
          projectId={projectId}
          initialAriMessages={initialAriMessages}
          initialConceptMessages={initialConceptMessages ?? []}
          initialScriptMessages={initialScriptMessages ?? initialAriMessages}
          clips={clips}
          onGenerate={generateFromShot}
        />
        {genError ? (
          <p
            aria-live="polite"
            className="mb-6 rounded border border-red-grease bg-paper px-3 py-2 font-body text-sm text-red-grease"
          >
            {genError}
          </p>
        ) : null}
      </section>

      {/* Scene outputs below the chat — only when there's something
          to show. Mae's board (above, in DualChat) is the primary
          canvas; this lower section is the rendered-clips timeline so
          you can scrub the finished film without scrolling Mae. */}
      {clips.some((c) => c.status === "complete" || c.still_image_url) ? (
        <>
          <StillsPanel clips={clips} onOpen={setOpenClipId} />
          <section id="timeline" className="mb-6 scroll-mt-20">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-base uppercase tracking-widest text-ink">
                Rendered clips
              </h2>
              <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
                {clips.filter((c) => c.status === "complete").length} of{" "}
                {clips.length}
              </span>
            </div>
            <Timeline clips={clips} onOpen={setOpenClipId} />
          </section>
        </>
      ) : null}

      <CharacterSheetPanel projectId={projectId} sheet={characterSheet} />

      <AestheticBiblePanel projectId={projectId} bible={aestheticBible} />

      <footer className="mt-2 font-body text-[11px] text-ink-soft/50">
        last updated {new Date(updatedAt).toLocaleString()}
      </footer>

      <ClipDetailSheet
        clip={openClip}
        priorCompletedClips={
          openClip
            ? clips.filter(
                (c) =>
                  c.status === "complete" &&
                  !c.id.startsWith("pending-") &&
                  c.order_index < openClip.order_index,
              )
            : []
        }
        onClose={() => setOpenClipId(null)}
        onUpdate={upsertClip}
      />
    </main>
  );
}

/**
 * Inline character sheet panel. Each existing character gets a mini
 * reference strip so users can drop photos right here instead of
 * navigating to /edit. When the sheet is empty, a single hint plus
 * a bible-targeted drop zone lets you start from a reference image
 * before Dio has written anything — the director will see the
 * uploaded image on the next turn and can draft a character from it.
 */
function CharacterSheetPanel({
  projectId,
  sheet,
}: {
  projectId: string;
  sheet: CharacterSheet;
}) {
  const characters = sheet.characters ?? [];
  return (
    <section className="mb-6">
      <h2 className="font-hand text-lg text-sepia-deep mb-2">character sheet</h2>
      <div className="bg-paper-deep p-4 space-y-4">
        {characters.length === 0 ? (
          <div className="space-y-3">
            <p className="font-body text-sm text-ink-soft">
              Not yet populated. Ask Ari to draft a sheet &mdash; or drop a
              photo below and she&rsquo;ll work from it.
            </p>
            <ReferenceStrip
              projectId={projectId}
              target="bible"
              label="start with a photo"
              initialPaths={sheet.setting?.reference_images ?? []}
            />
          </div>
        ) : (
          <ul className="space-y-5">
            {characters.map((c, i) => {
              const refCount = c.reference_images?.length ?? 0;
              return (
                <li key={i} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-display text-lg text-ink">
                      {c.name || `Character ${i + 1}`}
                    </span>
                    <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60 shrink-0">
                      {refCount === 0
                        ? "no refs"
                        : `${refCount} ${refCount === 1 ? "ref" : "refs"}`}
                    </span>
                  </div>
                  {c.appearance ? (
                    <p className="font-body text-sm text-ink-soft leading-snug line-clamp-2">
                      {c.appearance}
                    </p>
                  ) : null}
                  {c.wardrobe ? (
                    <p className="font-hand text-sm text-sepia-deep leading-snug line-clamp-1">
                      {c.wardrobe}
                    </p>
                  ) : null}
                  {c.name?.trim() ? (
                    <ReferenceStrip
                      projectId={projectId}
                      target={`character:${c.name.trim()}`}
                      label={`${c.name.trim()} references`}
                      initialPaths={c.reference_images ?? []}
                    />
                  ) : (
                    <p className="font-body text-xs text-ink-soft/60 italic">
                      Give this character a name in edit mode to attach photos.
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * Inline aesthetic bible panel. Surfaces the visual_style text (if
 * set) plus a mood-board drop strip. Every photo dropped here is
 * fed to Dio on the next chat turn, labeled 'aesthetic bible
 * reference'.
 */
function AestheticBiblePanel({
  projectId,
  bible,
}: {
  projectId: string;
  bible: AestheticBible;
}) {
  const visualStyle =
    typeof bible.visual_style === "string" ? bible.visual_style : null;
  return (
    <section className="mb-8">
      <h2 className="font-hand text-lg text-sepia-deep mb-2">aesthetic bible</h2>
      <div className="bg-paper-deep p-4 space-y-4">
        {visualStyle ? (
          <p className="font-body text-ink leading-relaxed">{visualStyle}</p>
        ) : (
          <p className="font-body text-sm text-ink-soft">
            Not yet populated. Drop a still, a screenshot, a painting &mdash;
            anything you want Ari + Mae to treat as the visual source of truth.
          </p>
        )}
        <ReferenceStrip
          projectId={projectId}
          target="bible"
          label="mood board"
          initialPaths={bible.reference_images ?? []}
        />
      </div>
    </section>
  );
}
