"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TimelineClip } from "@/app/projects/[id]/timeline/types";

/**
 * "Keep rolling" nudge. Watches the clips array for a clip that just
 * transitioned into `complete` during this browser session (i.e. not
 * already complete on mount). When one lands, show a pill above the
 * chat: "Scene N ready — draft shot N+1?"
 *
 * Click dispatches nysus:prefill-chat with a sensible next-shot prompt
 * so the user confirms in the chat input before it hits Dio.
 */
export function KeepRolling({ clips }: { clips: TimelineClip[] }) {
  const [nudge, setNudge] = useState<{ order: number; clipId: string } | null>(
    null,
  );
  // Snapshot of already-complete clip IDs on mount so we only nudge on
  // completions that happen while the user is watching.
  const seenCompletedRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (seenCompletedRef.current === null) {
      seenCompletedRef.current = new Set(
        clips.filter((c) => c.status === "complete").map((c) => c.id),
      );
      return;
    }
    const seen = seenCompletedRef.current;
    // Find the freshest newly-complete clip.
    for (let i = clips.length - 1; i >= 0; i--) {
      const c = clips[i];
      if (c.status === "complete" && !seen.has(c.id)) {
        seen.add(c.id);
        setNudge({ order: c.order_index, clipId: c.id });
        return;
      }
    }
    // Also remember new not-yet-complete clips so we don't spam on
    // subsequent polls.
    for (const c of clips) {
      if (c.status === "complete") seen.add(c.id);
    }
  }, [clips]);

  const draftNext = useCallback(() => {
    if (!nudge) return;
    const text = `Draft shot ${
      nudge.order + 2
    } — keep the character and aesthetic continuity, pick up from where the previous shot ends.`;
    window.dispatchEvent(
      new CustomEvent("nysus:prefill-chat", { detail: { text } }),
    );
    // Scroll the chat section into view so the user sees the textarea.
    const el = document.getElementById("chat");
    if (el) {
      const top = el.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top, behavior: "smooth" });
    }
    setNudge(null);
  }, [nudge]);

  if (!nudge) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-ink/15 bg-paper-deep px-3 py-2 animate-reveal is-visible">
      <div className="min-w-0">
        <p className="font-display text-sm text-ink">
          Scene {nudge.order + 1} ready.
        </p>
        <p className="font-body text-xs text-ink-soft/80">
          Want Mae to draft the next shot from here?
        </p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={draftNext}
          className="inline-flex h-9 items-center rounded-full bg-ink px-3 font-body text-[11px] uppercase tracking-widest text-paper hover:bg-ink-soft animate-press"
        >
          Keep rolling →
        </button>
        <button
          type="button"
          onClick={() => setNudge(null)}
          aria-label="Dismiss"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-soft hover:text-ink"
        >
          ×
        </button>
      </div>
    </div>
  );
}
