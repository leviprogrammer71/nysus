"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChatPanel } from "./chat/chat-panel";
import type { ChatMessage } from "./chat/message";
import { Timeline } from "./timeline/timeline";
import { ClipDetailSheet } from "./timeline/clip-detail-sheet";
import type { TimelineClip } from "./timeline/types";
import type { ShotPrompt } from "@/lib/shot-prompt";

/**
 * Orchestrates the project workspace: chat, timeline, clip detail.
 * Clip state is owned here so Chat's shot cards and Timeline's clip
 * cards both see live updates without prop drilling.
 */
export function Workspace({
  projectId,
  projectTitle,
  projectDescription,
  initialMessages,
  initialClips,
  updatedAt,
  characterNames,
  visualStyle,
}: {
  projectId: string;
  projectTitle: string;
  projectDescription: string | null;
  initialMessages: ChatMessage[];
  initialClips: TimelineClip[];
  updatedAt: string;
  characterNames: string[];
  visualStyle: string | null;
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
        },
        seed_image_url: seedUrl,
        seed_source: seedSource,
        video_url: null,
        last_frame_url: null,
        sampled_frames_urls: [],
        status: "queued",
        replicate_prediction_id: null,
        error_message: null,
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

  return (
    <main className="min-h-screen flex flex-col px-4 sm:px-6 py-8 max-w-3xl mx-auto w-full">
      <header className="flex items-center justify-between mb-8">
        <Link
          href="/"
          className="font-hand text-lg text-sepia-deep hover:text-ink transition-colors"
        >
          &larr; all projects
        </Link>
        <div className="flex items-center gap-4">
          <Link
            href={`/projects/${projectId}/edit`}
            className="font-hand text-sm text-sepia-deep hover:text-ink transition-colors"
          >
            edit
          </Link>
          <Link
            href={`/projects/${projectId}/stitch`}
            className="font-hand text-sm text-sepia-deep hover:text-ink transition-colors"
          >
            stitch &rarr;
          </Link>
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="font-body text-xs uppercase tracking-widest text-ink-soft/70 hover:text-ink transition-colors"
            >
              sign out
            </button>
          </form>
        </div>
      </header>

      <h1 className="font-display text-4xl sm:text-5xl text-ink leading-tight mb-1">
        {projectTitle}
      </h1>
      {projectDescription ? (
        <p className="font-body text-ink-soft leading-relaxed max-w-xl">
          {projectDescription}
        </p>
      ) : null}

      <div className="rule-ink mt-6 mb-6" />

      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-hand text-lg text-sepia-deep">timeline</h2>
          <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/50">
            {clips.length} {clips.length === 1 ? "clip" : "clips"}
          </span>
        </div>
        <Timeline clips={clips} onOpen={setOpenClipId} />
      </section>

      <section className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-hand text-lg text-sepia-deep">chat</h2>
          <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/50">
            the director
          </span>
        </div>
        <ChatPanel
          projectId={projectId}
          initialMessages={initialMessages}
          onGenerate={generateFromShot}
        />
        {genError ? (
          <p
            aria-live="polite"
            className="mt-3 px-3 py-2 bg-paper border border-red-grease text-red-grease font-hand text-base"
          >
            {genError}
          </p>
        ) : null}
      </section>

      <section className="mb-6">
        <h2 className="font-hand text-lg text-sepia-deep mb-2">
          character sheet
        </h2>
        <div className="bg-paper-deep p-5">
          {characterNames.length > 0 ? (
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {characterNames.map((name, i) => (
                <li key={i} className="font-display text-lg text-ink">
                  {name}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-sm text-ink-soft">
              Not yet populated. Ask the director to draft a sheet.
            </p>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-hand text-lg text-sepia-deep mb-2">
          aesthetic bible
        </h2>
        <div className="bg-paper-deep p-5">
          {visualStyle ? (
            <p className="font-body text-ink leading-relaxed">{visualStyle}</p>
          ) : (
            <p className="font-body text-sm text-ink-soft">
              Not yet populated.
            </p>
          )}
        </div>
      </section>

      <footer className="mt-2 font-body text-[11px] text-ink-soft/50">
        last updated {new Date(updatedAt).toLocaleString()}
      </footer>

      <ClipDetailSheet
        clip={openClip}
        onClose={() => setOpenClipId(null)}
        onUpdate={upsertClip}
      />
    </main>
  );
}
