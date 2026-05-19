"use client";

import Link from "next/link";
import { useCallback } from "react";

/**
 * In-project section navigation.
 *
 * Pulled from Workspace.html design: serif italic tabs (Cormorant
 * 22px), border-bottom underline on active, small mono superscript
 * showing counts ("Scenes 14", "Chat with Ari"). The four core
 * sections of a film:
 *
 *   Chat   — Ari (planning) + Mae (the board)
 *   Scenes — the rendered stills + clips timeline
 *   Stitch — final export
 *   Bible  — cast + aesthetic sheet
 *
 * The first two are anchors on the workspace page; the last two are
 * sub-routes.
 */

export interface SectionNavProps {
  projectId: string;
  projectTitle: string;
  active: "chat" | "scenes" | "stitch" | "bible";
  counts?: {
    scenes?: number;
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
  return (
    <div className="border-b border-[color:var(--color-sepia)]/30 mb-6 -mx-4 sm:-mx-6 px-4 sm:px-6 pt-4 pb-0">
      <div className="flex items-baseline justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <Link
            href="/dashboard"
            aria-label="All films"
            className="font-hand text-[15px] text-[color:var(--color-sepia-deep)] hover:text-ink transition-colors shrink-0"
          >
            ← films
          </Link>
          <span className="hidden sm:inline text-[color:var(--color-sepia)]/50">
            /
          </span>
          <h2
            className="font-display text-[20px] sm:text-[22px] text-ink italic truncate"
            title={projectTitle}
          >
            {projectTitle}
          </h2>
        </div>
        {counts?.inFlight && counts.inFlight > 0 ? (
          <span className="tag wine">
            <span className="oracle-pulse">●</span>
            {counts.inFlight} rendering
          </span>
        ) : null}
      </div>

      <nav className="flex items-baseline gap-6 sm:gap-8 overflow-x-auto no-scrollbar">
        <SectionTab
          label="Chat"
          superscript="with Ari"
          superscriptHand
          active={active === "chat"}
          inWorkspace={active !== "stitch" && active !== "bible"}
          anchor="chat"
          href={`/projects/${projectId}#chat`}
        />
        <SectionTab
          label="Scenes"
          superscript={
            counts?.scenes && counts.scenes > 0
              ? String(counts.scenes)
              : undefined
          }
          active={active === "scenes"}
          inWorkspace={active !== "stitch" && active !== "bible"}
          anchor="timeline"
          href={`/projects/${projectId}#timeline`}
        />
        <SectionLinkTab
          label="Stitch"
          superscript={
            counts?.rendered && counts.rendered > 0
              ? `${counts.rendered} ready`
              : undefined
          }
          superscriptHand={Boolean(counts?.rendered && counts.rendered > 0)}
          active={active === "stitch"}
          href={`/projects/${projectId}/stitch`}
        />
        <SectionLinkTab
          label="Bible"
          superscript="cast · style"
          superscriptHand
          active={active === "bible"}
          href={`/projects/${projectId}/edit`}
        />
      </nav>
    </div>
  );
}

function SectionTab({
  label,
  superscript,
  superscriptHand,
  active,
  inWorkspace,
  anchor,
  href,
}: {
  label: string;
  superscript?: string;
  superscriptHand?: boolean;
  active: boolean;
  inWorkspace: boolean;
  anchor: string;
  href: string;
}) {
  const onClick = useCallback(
    (e: React.MouseEvent) => {
      if (!inWorkspace) return;
      e.preventDefault();
      const el = document.getElementById(anchor);
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY - 12;
      window.scrollTo({ top, behavior: "smooth" });
    },
    [anchor, inWorkspace],
  );
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`section-tab whitespace-nowrap ${active ? "active" : ""}`}
    >
      {label}
      {superscript ? (
        <span
          className={`${
            superscriptHand
              ? "font-hand text-[13px] text-[color:var(--color-sepia-deep)]"
              : "font-mono text-[10px] text-[color:var(--color-sepia-deep)]"
          } align-super ml-1`}
        >
          {superscript}
        </span>
      ) : null}
    </Link>
  );
}

function SectionLinkTab({
  label,
  superscript,
  superscriptHand,
  active,
  href,
}: {
  label: string;
  superscript?: string;
  superscriptHand?: boolean;
  active: boolean;
  href: string;
}) {
  return (
    <Link
      href={href}
      className={`section-tab whitespace-nowrap ${active ? "active" : ""}`}
      prefetch={false}
    >
      {label}
      {superscript ? (
        <span
          className={`${
            superscriptHand
              ? "font-hand text-[13px] text-[color:var(--color-sepia-deep)]"
              : "font-mono text-[10px] text-[color:var(--color-sepia-deep)]"
          } align-super ml-1`}
        >
          {superscript}
        </span>
      ) : null}
    </Link>
  );
}
