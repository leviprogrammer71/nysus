"use client";

import { useCallback, useRef, useState } from "react";
import { ChatPanel } from "./chat-panel";
import type { ChatMessage } from "./message";
import type { ShotPrompt } from "@/lib/shot-prompt";
import { AriGlyph, MaeGlyph } from "@/app/components/mythic-glyphs";

/**
 * Two chat panes in a single horizontal scroller. Each pane is the
 * FULL width of the container — the user only ever sees one at a time
 * and swipes (mobile) or taps the tabs (desktop) to switch between.
 * This is a deliberate shape: Ari's planning headspace and Mae's
 * execution crew shouldn't share the visual field. You're in one room
 * or the other.
 *
 *   Ari  — Ariadne, the thread-holder. Planning + conversation.
 *   Mae  — Maenads, the doers. Emits shot cards + portraits.
 *
 * A "Send to Mae" CTA in Ari's header prefills Mae's textarea with a
 * handoff message and scrolls the container to her pane.
 *
 * Prefill events are namespaced per-pane so the two don't steal each
 * other's input:
 *   nysus:prefill-chat:ari  → Ari's textarea
 *   nysus:prefill-chat:mae  → Mae's textarea
 */
export function DualChat({
  projectId,
  initialAriMessages,
  initialMaeMessages,
  onGenerate,
}: {
  projectId: string;
  initialAriMessages: ChatMessage[];
  initialMaeMessages: ChatMessage[];
  onGenerate?: (shot: ShotPrompt) => Promise<void>;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [activePane, setActivePane] = useState<"ari" | "mae">("ari");

  const scrollTo = useCallback((pane: "ari" | "mae") => {
    const el = scrollerRef.current;
    if (!el) return;
    const target = pane === "ari" ? 0 : el.scrollWidth;
    el.scrollTo({ left: target, behavior: "smooth" });
    setActivePane(pane);
  }, []);

  const handoff = useCallback(() => {
    // Prefill Mae with a kickoff message that references the project
    // context. Ari has already written the sheet + bible; Mae reads
    // them via PROJECT CONTEXT on the next turn.
    const kickoff =
      "Ari and I worked out the cast, the aesthetic, and the through-line. Read the project context and draft the opening three shots. Start with a portrait for each lead if we don't have one yet.";
    window.dispatchEvent(
      new CustomEvent("nysus:prefill-chat:mae", {
        detail: { text: kickoff },
      }),
    );
    scrollTo("mae");
  }, [scrollTo]);

  const onScroll = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    // Pane boundary is halfway between the two panes.
    const halfway = el.scrollWidth / 2;
    setActivePane(el.scrollLeft < halfway - 20 ? "ari" : "mae");
  }, []);

  return (
    <div className="mb-8">
      {/* Tab strip — shows which pane is focused on mobile, clickable
          on desktop. Always visible so the mythological framing reads. */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-0.5 rounded-full border border-ink/15 bg-paper-deep p-0.5">
          <button
            type="button"
            onClick={() => scrollTo("ari")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-[11px] uppercase tracking-widest animate-press ${
              activePane === "ari"
                ? "bg-paper text-ink shadow-[0_1px_2px_rgba(27,42,58,0.08)]"
                : "text-ink-soft/70 hover:text-ink"
            }`}
            aria-pressed={activePane === "ari"}
          >
            <AriGlyph size={14} />
            Ari
          </button>
          <button
            type="button"
            onClick={() => scrollTo("mae")}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-body text-[11px] uppercase tracking-widest animate-press ${
              activePane === "mae"
                ? "bg-paper text-ink shadow-[0_1px_2px_rgba(27,42,58,0.08)]"
                : "text-ink-soft/70 hover:text-ink"
            }`}
            aria-pressed={activePane === "mae"}
          >
            <MaeGlyph size={14} />
            Mae
          </button>
        </div>
        <span className="font-body text-[10px] uppercase tracking-[0.18em] text-ink-soft/60">
          {activePane === "ari" ? "the thread" : "the rite"}
        </span>
      </div>

      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="no-scrollbar relative -mx-4 flex snap-x snap-mandatory gap-0 overflow-x-auto overflow-y-visible scroll-smooth sm:-mx-6"
        style={{ scrollPaddingLeft: "0px" }}
      >
        {/* ARI — planning pane. Full width, snap-start so the user
            only ever sees one pane at a time regardless of screen. */}
        <section
          id="ari-pane"
          aria-label="Ari — planning conversation"
          aria-hidden={activePane !== "ari"}
          className="w-screen max-w-full shrink-0 snap-start snap-always px-4 sm:w-full sm:px-6"
        >
          <header className="mb-2 flex items-baseline justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <span className="inline-flex items-center gap-1.5 text-sepia-deep">
                <AriGlyph />
                <span className="font-display text-sm tracking-wider text-ink">
                  Ari
                </span>
              </span>
              <span className="font-hand text-xs text-ink-soft/70">
                the thread-holder
              </span>
            </div>
            <button
              type="button"
              onClick={handoff}
              className="inline-flex h-8 items-center rounded-full border border-ink/25 bg-paper px-3 font-body text-[10px] uppercase tracking-widest text-ink hover:bg-ink/5 animate-press"
              title="Pass the plan to Mae"
            >
              Send to Mae →
            </button>
          </header>
          <ChatPanel
            projectId={projectId}
            initialMessages={initialAriMessages}
            mode="ari"
            prefillEventName="nysus:prefill-chat:ari"
          />
        </section>

        {/* MAE — execution pane. Full width. */}
        <section
          id="mae-pane"
          aria-label="Mae — scene execution"
          aria-hidden={activePane !== "mae"}
          className="w-screen max-w-full shrink-0 snap-start snap-always px-4 sm:w-full sm:px-6"
        >
          <header className="mb-2 flex items-baseline justify-between gap-3">
            <button
              type="button"
              onClick={() => scrollTo("ari")}
              className="inline-flex h-8 items-center rounded-full border border-ink/25 bg-paper px-3 font-body text-[10px] uppercase tracking-widest text-ink-soft hover:text-ink hover:bg-ink/5 animate-press"
              title="Back to Ari"
            >
              ← Ari
            </button>
            <div className="flex items-baseline gap-2">
              <span className="font-hand text-xs text-ink-soft/70">
                the rite-bearer
              </span>
              <span className="inline-flex items-center gap-1.5 text-sepia-deep">
                <span className="font-display text-sm tracking-wider text-ink">
                  Mae
                </span>
                <MaeGlyph />
              </span>
            </div>
          </header>
          <ChatPanel
            projectId={projectId}
            initialMessages={initialMaeMessages}
            mode="mae"
            prefillEventName="nysus:prefill-chat:mae"
            onGenerate={onGenerate}
          />
        </section>
      </div>
    </div>
  );
}
