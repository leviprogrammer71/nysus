"use client";

import { useCallback, useRef, useState } from "react";
import { ChatPanel } from "./chat-panel";
import { MaeBoard } from "./mae-board";
import type { ChatMessage } from "./message";
import type { ShotPrompt } from "@/lib/shot-prompt";
import type { TimelineClip } from "../timeline/types";
import { AriGlyph, MaeGlyph } from "@/app/components/mythic-glyphs";

/**
 * Two chat panes in a single horizontal scroller. Each pane is the
 * FULL width of the container — the user only ever sees one at a time
 * and swipes (mobile) or taps the tabs (desktop) to switch between.
 * This is a deliberate shape: Ari's planning headspace and Mae's
 * execution crew shouldn't share the visual field. You're in one room
 * or the other.
 *
 *   Ari  — Ariadne, the thread-holder. Planning + scene drafting.
 *          Subtoggles Oracle (concept) ↔ Liturgy (script).
 *   Mae  — Maenads, the doers. Silent SceneBoard.
 *
 * Prefill events are namespaced per-pane so the two don't steal each
 * other's input:
 *   nysus:prefill-chat:ari  → Ari's textarea
 *   nysus:prefill-chat:mae  → Mae's textarea
 */
export function DualChat({
  projectId,
  initialAriMessages,
  initialConceptMessages,
  initialScriptMessages,
  clips,
  onGenerate,
}: {
  projectId: string;
  /** Legacy alias — points at the Liturgy ledger. */
  initialAriMessages: ChatMessage[];
  /** Oracle (concept) ledger — pre-Liturgy ideation. */
  initialConceptMessages?: ChatMessage[];
  /** Liturgy (script) ledger — scene drafting + legacy "ari" rows. */
  initialScriptMessages?: ChatMessage[];
  /** Live clip rows for the project — Mae's board renders these. */
  clips: TimelineClip[];
  onGenerate?: (shot: ShotPrompt) => Promise<void>;
}) {
  // Ari has two sub-modes the user toggles between:
  //   concept (the Oracle) — free-form ideation, no scene cards
  //   script  (the Liturgy) — scene drafting; emits json-shot blocks
  // The Rite (scene mode) is opened from a scene card on Mae's
  // board, not from this top-level switch.
  const conceptMessages = initialConceptMessages ?? [];
  const scriptMessages = initialScriptMessages ?? initialAriMessages;
  const [ariMode, setAriMode] = useState<"concept" | "script">(
    // Default to whichever ledger has the most recent activity. Fall
    // back to Oracle if both are empty so first-run users hit the
    // ideation pane first.
    scriptMessages.length > 0 ? "script" : "concept",
  );
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
    // Mae is no longer chat — clicking "Send to Mae" just slides the
    // user over to her board so they can act on whatever Ari has
    // already drafted.
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
      {/* Tab strip — two equal halves with a sliding underline that
          tracks the active pane. Mythology reads quietly:
          'the thread' for Ari, 'the rite' for Mae. */}
      <div className="mb-3 flex items-end justify-between gap-3">
        <div
          role="tablist"
          aria-label="Chat panes"
          className="relative flex w-full max-w-[280px] border-b border-ink/10"
        >
          <TabButton
            active={activePane === "ari"}
            onClick={() => scrollTo("ari")}
            label="Ari"
            sub="the thread"
            glyph={<AriGlyph size={15} />}
          />
          <TabButton
            active={activePane === "mae"}
            onClick={() => scrollTo("mae")}
            label="Mae"
            sub="the rite"
            glyph={<MaeGlyph size={15} />}
          />
          <span
            aria-hidden
            className="pointer-events-none absolute bottom-[-1px] h-0.5 w-1/2 rounded-full bg-ink transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
            style={{
              transform:
                activePane === "ari" ? "translateX(0%)" : "translateX(100%)",
            }}
          />
        </div>
        <span className="font-body text-[10px] uppercase tracking-[0.22em] text-ink-soft/60">
          {clips.length} {clips.length === 1 ? "scene" : "scenes"}
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

          {/* Ari sub-mode toggle — Oracle (concept) ↔ Liturgy (script).
              Each ledger has its own thread on the server, so flipping
              modes mounts a fresh ChatPanel via the `key` prop and the
              user sees their saved messages for that mode. */}
          <AriModeToggle
            mode={ariMode}
            onChange={setAriMode}
            conceptCount={conceptMessages.length}
            scriptCount={scriptMessages.length}
          />

          <ChatPanel
            key={`ari-${ariMode}`}
            projectId={projectId}
            initialMessages={
              ariMode === "concept" ? conceptMessages : scriptMessages
            }
            mode={ariMode}
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
          <MaeBoard projectId={projectId} clips={clips} />
        </section>
      </div>
    </div>
  );
}

/**
 * Sub-mode pill toggle for Ari's pane: Oracle (concept) ↔ Liturgy (script).
 * Sits between the pane header and the chat panel. Each pill shows
 * the mythological subtitle in lowercase hand, with a tiny dot when
 * that mode has stored messages so the user can see which ledgers
 * have history at a glance.
 */
function AriModeToggle({
  mode,
  onChange,
  conceptCount,
  scriptCount,
}: {
  mode: "concept" | "script";
  onChange: (m: "concept" | "script") => void;
  conceptCount: number;
  scriptCount: number;
}) {
  const items: Array<{
    id: "concept" | "script";
    label: string;
    sub: string;
    count: number;
  }> = [
    {
      id: "concept",
      label: "Oracle",
      sub: "the seed",
      count: conceptCount,
    },
    {
      id: "script",
      label: "Liturgy",
      sub: "the thread",
      count: scriptCount,
    },
  ];
  return (
    <div
      role="tablist"
      aria-label="Ari sub-mode"
      className="mb-2 inline-flex items-center gap-1 rounded-full border border-ink/10 bg-paper-deep p-1"
    >
      {items.map((it) => {
        const active = mode === it.id;
        return (
          <button
            key={it.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.id)}
            className={`group inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 transition-colors animate-press ${
              active
                ? "bg-paper text-ink shadow-[0_1px_3px_rgba(27,42,58,0.08)]"
                : "text-ink-soft/70 hover:text-ink"
            }`}
          >
            <span className="font-display text-[10px] uppercase tracking-[0.22em] leading-none">
              {it.label}
            </span>
            <span
              className={`font-hand text-[11px] leading-none ${
                active ? "text-sepia-deep" : "text-ink-soft/55"
              }`}
            >
              · {it.sub}
            </span>
            {it.count > 0 && !active ? (
              <span
                aria-hidden
                className="ml-0.5 h-1 w-1 rounded-full bg-sepia-deep/70"
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  label,
  sub,
  glyph,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  sub: string;
  glyph: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={`group flex flex-1 flex-col items-start py-2 pr-3 text-left transition-colors animate-press ${
        active ? "text-ink" : "text-ink-soft/65 hover:text-ink"
      }`}
    >
      <span className="flex items-center gap-1.5">
        <span
          className={`transition-colors ${
            active ? "text-sepia-deep" : "text-ink-soft/40"
          }`}
        >
          {glyph}
        </span>
        <span className="font-display text-sm uppercase tracking-[0.22em]">
          {label}
        </span>
      </span>
      <span className="font-hand text-[11px] text-ink-soft/55 leading-none mt-0.5">
        {sub}
      </span>
    </button>
  );
}
