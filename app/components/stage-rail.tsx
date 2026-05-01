"use client";

import { useCallback, useState } from "react";
import type { ProjectStage } from "@/lib/supabase/types";
import { PROJECT_STAGES } from "@/lib/supabase/types";

/**
 * The Procession — six stages of a Nysus production. Each stage has a
 * concrete name (Concept, Script, Scenes, Stills, Motion, Stitch) and a
 * Dionysian subtitle so the workflow reads as a rite, not a project
 * board:
 *
 *   concept  · the seed     — the idea before it has shape
 *   script   · the thread   — Ari pulls the through-line into structure
 *   scenes   · the line     — the procession laid out shot by shot
 *   image    · the mask     — every scene gets its face (gpt-image-2)
 *   animate  · the rite     — the maenadic charge of motion
 *   stitch   · the cut      — the final reel, wound and severed
 *
 * Tapping a stage:
 *   1. Persists current_stage to the project via PATCH /api/projects/[id].
 *   2. Smooth-scrolls the workspace to the corresponding section.
 * It never blocks — readiness is a nudge, not a gate.
 */

interface StageDef {
  id: ProjectStage;
  label: string;
  sub: string;
  /** Anchor on the workspace page to scroll to. */
  anchor: string;
  /** Hand-drawn glyph; single-color, inherits currentColor. */
  glyph: React.ReactNode;
}

const STAGES: StageDef[] = [
  {
    id: "concept",
    label: "Concept",
    sub: "the seed",
    anchor: "chat",
    glyph: <SeedGlyph />,
  },
  {
    id: "script",
    label: "Script",
    sub: "the thread",
    anchor: "chat",
    glyph: <ThreadGlyph />,
  },
  {
    id: "scenes",
    label: "Scenes",
    sub: "the line",
    anchor: "chat",
    glyph: <LineGlyph />,
  },
  {
    id: "image",
    label: "Stills",
    sub: "the mask",
    anchor: "chat",
    glyph: <MaskGlyph />,
  },
  {
    id: "animate",
    label: "Motion",
    sub: "the rite",
    anchor: "chat",
    glyph: <RiteGlyph />,
  },
  {
    id: "stitch",
    label: "Stitch",
    sub: "the cut",
    anchor: "chat",
    glyph: <CutGlyph />,
  },
];

export function StageRail({
  projectId,
  initialStage,
  /** Per-stage readiness flags so we can render the soft "ready" dot. */
  readiness,
}: {
  projectId: string;
  initialStage: ProjectStage;
  readiness?: Partial<Record<ProjectStage, boolean>>;
}) {
  const [stage, setStage] = useState<ProjectStage>(initialStage);
  const [busy, setBusy] = useState(false);

  const advance = useCallback(
    async (target: ProjectStage, anchor: string) => {
      // Optimistic — snapping is the responsive feel; revert if the
      // patch later fails.
      const prev = stage;
      setStage(target);
      const el =
        typeof document !== "undefined" ? document.getElementById(anchor) : null;
      if (el) {
        const top = el.getBoundingClientRect().top + window.scrollY - 12;
        window.scrollTo({ top, behavior: "smooth" });
      }
      if (target === prev) return;
      setBusy(true);
      try {
        await fetch(`/api/projects/${projectId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ current_stage: target }),
        });
      } catch {
        setStage(prev);
      } finally {
        setBusy(false);
      }
    },
    [projectId, stage],
  );

  const activeIndex = PROJECT_STAGES.indexOf(stage);

  return (
    <nav
      aria-label="Project procession"
      className="surface-card-soft mb-6 rounded-xl px-2 py-2 sm:px-3 sm:py-3"
    >
      <ol className="grid grid-cols-6 gap-0.5 sm:gap-2">
        {STAGES.map((s, i) => {
          const isActive = s.id === stage;
          const isPassed = i < activeIndex;
          const isReady = Boolean(readiness?.[s.id]);
          return (
            <li key={s.id} className="min-w-0">
              <button
                type="button"
                onClick={() => advance(s.id, s.anchor)}
                disabled={busy}
                aria-current={isActive ? "step" : undefined}
                className={`group flex w-full flex-col items-center gap-1 rounded-lg py-2 px-1 text-center transition-colors animate-press ${
                  isActive
                    ? "bg-paper text-ink shadow-[0_1px_3px_rgba(27,42,58,0.08)]"
                    : isPassed
                    ? "text-ink-soft hover:text-ink"
                    : "text-ink-soft/55 hover:text-ink"
                }`}
              >
                <span
                  className={`relative inline-flex h-7 w-7 items-center justify-center rounded-full border transition-colors ${
                    isActive
                      ? "border-ink bg-paper-soft text-ink"
                      : isPassed
                      ? "border-sepia-deep/50 bg-paper-soft text-sepia-deep"
                      : "border-ink/15 bg-paper-soft/40 text-ink-soft/60"
                  }`}
                >
                  {s.glyph}
                  {isReady && !isActive ? (
                    <span
                      aria-hidden
                      className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-green-seal"
                    />
                  ) : null}
                </span>
                <span className="font-display text-[10px] uppercase tracking-[0.18em] leading-none">
                  {s.label}
                </span>
                <span
                  className={`hidden font-hand text-[10px] leading-none sm:block ${
                    isActive ? "text-sepia-deep" : "text-ink-soft/55"
                  }`}
                >
                  {s.sub}
                </span>
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

// --- Glyphs (paper-and-ink, single-color) ----------------------------

function Stroke({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

function SeedGlyph() {
  // A grain — the seed before the play.
  return (
    <Stroke>
      <ellipse cx="12" cy="12" rx="3" ry="6" />
      <path d="M12 6c0-2 1-3 2-3" />
    </Stroke>
  );
}
function ThreadGlyph() {
  // A spool unspooling — the thread of script.
  return (
    <Stroke>
      <ellipse cx="9" cy="11" rx="3" ry="5" />
      <path d="M12 11c2 0 2 2 4 2" />
    </Stroke>
  );
}
function LineGlyph() {
  // The procession — three frames in a row.
  return (
    <Stroke>
      <rect x="3" y="6" width="5" height="12" rx="1" />
      <rect x="10" y="6" width="5" height="12" rx="1" />
      <rect x="17" y="6" width="3" height="12" rx="1" />
    </Stroke>
  );
}
function MaskGlyph() {
  // The Dionysian mask — half-shadow.
  return (
    <Stroke>
      <path d="M5 8c2-3 12-3 14 0v4c0 4-3 7-7 7s-7-3-7-7z" />
      <circle cx="9.5" cy="11.5" r="0.7" fill="currentColor" />
      <circle cx="14.5" cy="11.5" r="0.7" fill="currentColor" />
    </Stroke>
  );
}
function RiteGlyph() {
  // Thyrsus — the maenadic staff.
  return (
    <Stroke>
      <path d="M12 21V9" />
      <path d="M9 5c1.5 1 4.5 1 6 0" />
      <path d="M9 7c1.5 1 4.5 1 6 0" />
      <path d="M14 13c1.6 0 2.5 1 2.5 2.5S15.6 18 14 18" />
    </Stroke>
  );
}
function CutGlyph() {
  // Scissors — the cut.
  return (
    <Stroke>
      <circle cx="6.5" cy="17" r="2.5" />
      <circle cx="6.5" cy="7" r="2.5" />
      <path d="M9 8.5 20 17" />
      <path d="M9 15.5 20 7" />
    </Stroke>
  );
}
