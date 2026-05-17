"use client";

import Link from "next/link";
import { useCallback } from "react";
import { AriGlyph, MaeGlyph } from "@/app/components/mythic-glyphs";

/**
 * In-project section navigation.
 *
 * Sits at the top of every project page so the user always sees the
 * four core surfaces of a film:
 *   Chat    — Ari (planning) + Mae (the board)
 *   Scenes  — the rendered stills + clips timeline
 *   Stitch  — final export
 *   Bible   — cast + aesthetic sheet
 *
 * The first two are anchors on the workspace page; the last two are
 * sub-routes. Counts and small readiness dots are rendered when the
 * caller passes the relevant numbers, so the user sees state at a
 * glance.
 */

export interface SectionNavProps {
  projectId: string;
  /** Title of the active project — shown on the left of the rail. */
  projectTitle: string;
  /** Currently-active section so we can highlight it. */
  active: "chat" | "scenes" | "stitch" | "bible";
  /** Counts the user might want to see at a glance. */
  counts?: {
    scenes?: number;
    stills?: number;
    rendered?: number;
    inFlight?: number;
  };
}

export function SectionNav({
  projectId,
  projectTitle,
  active,
  counts,
}: SectionNavProps) {
  const inFlight = counts?.inFlight ?? 0;
  const rendered = counts?.rendered ?? 0;
  const totalScenes = counts?.scenes ?? 0;

  return (
    <nav
      aria-label="Project sections"
      className="surface-card-soft mb-4 rounded-xl px-2 py-1.5 sm:px-3 sm:py-2"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0 flex items-center gap-2">
          <Link
            href="/dashboard"
            aria-label="All films"
            className="hidden sm:inline-flex h-7 w-7 items-center justify-center rounded-full border border-ink/15 text-ink-soft hover:text-ink hover:border-ink/40 transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              width="14"
              height="14"
              aria-hidden
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </Link>
          <span
            className="font-display text-sm text-ink truncate max-w-[55vw] sm:max-w-[28ch]"
            title={projectTitle}
          >
            {projectTitle}
          </span>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          {inFlight > 0 ? (
            <span className="font-body text-[10px] uppercase tracking-widest text-sepia-deep">
              {inFlight} rendering
            </span>
          ) : null}
        </div>
      </div>

      <ul className="mt-2 grid grid-cols-4 gap-0.5">
        <SectionButton
          label="Chat"
          sub="Ari · Mae"
          active={active === "chat"}
          anchor="chat"
          href={`/projects/${projectId}#chat`}
          inWorkspace={active !== "stitch" && active !== "bible"}
          icon={<AriGlyph size={14} />}
        />
        <SectionButton
          label="Scenes"
          sub={totalScenes > 0 ? `${rendered}/${totalScenes}` : "the line"}
          active={active === "scenes"}
          anchor="timeline"
          href={`/projects/${projectId}#timeline`}
          inWorkspace={active !== "stitch" && active !== "bible"}
          icon={<IconReel />}
        />
        <SectionLink
          label="Stitch"
          sub="the cut"
          active={active === "stitch"}
          href={`/projects/${projectId}/stitch`}
          icon={<IconStitch />}
        />
        <SectionLink
          label="Bible"
          sub="cast · style"
          active={active === "bible"}
          href={`/projects/${projectId}/edit`}
          icon={<MaeGlyph size={14} />}
        />
      </ul>
    </nav>
  );
}

function SectionButton({
  label,
  sub,
  active,
  anchor,
  href,
  inWorkspace,
  icon,
}: {
  label: string;
  sub: string;
  active: boolean;
  anchor: string;
  href: string;
  inWorkspace: boolean;
  icon: React.ReactNode;
}) {
  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (!inWorkspace) return; // let the link navigate to the workspace + anchor
      e.preventDefault();
      const el = document.getElementById(anchor);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top, behavior: "smooth" });
    },
    [anchor, inWorkspace],
  );
  return (
    <li>
      <Link
        href={href}
        onClick={onClick}
        className={`group flex flex-col items-center gap-0.5 rounded-lg py-2 px-1 text-center transition-colors animate-press ${
          active
            ? "bg-paper text-ink shadow-[0_1px_3px_rgba(27,42,58,0.08)]"
            : "text-ink-soft/70 hover:text-ink"
        }`}
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`transition-colors ${
              active ? "text-sepia-deep" : "text-ink-soft/50"
            }`}
          >
            {icon}
          </span>
          <span className="font-display text-[11px] uppercase tracking-[0.18em] leading-none">
            {label}
          </span>
        </span>
        <span
          className={`font-hand text-[10px] leading-none ${
            active ? "text-sepia-deep" : "text-ink-soft/55"
          }`}
        >
          {sub}
        </span>
      </Link>
    </li>
  );
}

function SectionLink({
  label,
  sub,
  active,
  href,
  icon,
}: {
  label: string;
  sub: string;
  active: boolean;
  href: string;
  icon: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className={`group flex flex-col items-center gap-0.5 rounded-lg py-2 px-1 text-center transition-colors animate-press ${
          active
            ? "bg-paper text-ink shadow-[0_1px_3px_rgba(27,42,58,0.08)]"
            : "text-ink-soft/70 hover:text-ink"
        }`}
        prefetch={false}
      >
        <span className="inline-flex items-center gap-1.5">
          <span
            className={`transition-colors ${
              active ? "text-sepia-deep" : "text-ink-soft/50"
            }`}
          >
            {icon}
          </span>
          <span className="font-display text-[11px] uppercase tracking-[0.18em] leading-none">
            {label}
          </span>
        </span>
        <span
          className={`font-hand text-[10px] leading-none ${
            active ? "text-sepia-deep" : "text-ink-soft/55"
          }`}
        >
          {sub}
        </span>
      </Link>
    </li>
  );
}

function IconReel() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="12" cy="5" r="1.2" />
      <circle cx="12" cy="19" r="1.2" />
      <circle cx="5" cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </svg>
  );
}
function IconStitch() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="14"
      height="14"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="6.5" cy="17" r="2.5" />
      <circle cx="6.5" cy="7" r="2.5" />
      <path d="M9 8.5 20 17" />
      <path d="m9 15.5 11-8.5" />
    </svg>
  );
}
