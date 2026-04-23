"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

/**
 * Floating "more" sheet opened by the BottomNav's more-tab event.
 * Surfaces the navigation the bottom nav can't fit: Gallery, Profile,
 * Dashboard, Account. On a project page it also adds in-project
 * shortcuts (edit, storyboard, stitch, share, delete).
 *
 * A "Check Replicate" tap runs /api/health/replicate and shows the
 * verdict inline — useful when the Send still or Animate buttons are
 * complaining about network.
 */
export function MoreMenu() {
  const [open, setOpen] = useState(false);
  const [healthState, setHealthState] = useState<
    | { kind: "idle" }
    | { kind: "checking" }
    | { kind: "ok"; detail: string }
    | { kind: "bad"; detail: string }
  >({ kind: "idle" });
  const pathname = usePathname() ?? "/";

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("nysus:open-more-menu", onOpen as EventListener);
    return () =>
      window.removeEventListener("nysus:open-more-menu", onOpen as EventListener);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close menu on navigation
    setOpen(false);
  }, [pathname]);

  const runHealth = useCallback(async () => {
    setHealthState({ kind: "checking" });
    try {
      const res = await fetch("/api/health/replicate", { cache: "no-store" });
      const body = await res.json();
      if (res.ok && body.ok) {
        setHealthState({ kind: "ok", detail: body.detail ?? "reachable" });
      } else {
        setHealthState({
          kind: "bad",
          detail: body.detail ?? body.error ?? `HTTP ${res.status}`,
        });
      }
    } catch (err) {
      setHealthState({
        kind: "bad",
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  if (!open) return null;

  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch?.[1] ?? null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="More options"
      className="md:hidden fixed inset-0 z-50 flex items-end"
    >
      <button
        aria-label="Close"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <div className="relative w-full rounded-t-2xl bg-paper border-t border-ink/15 pb-safe-plus-4 shadow-[0_-12px_28px_rgba(27,42,58,0.08)]">
        <div
          aria-hidden
          className="mx-auto mt-2 mb-1 h-1 w-9 rounded-full bg-ink/20"
        />
        <header className="flex items-center justify-between px-5 py-2">
          <span className="font-display text-base uppercase tracking-widest text-ink">
            More
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="px-2 font-display text-2xl text-ink-soft hover:text-ink"
          >
            &times;
          </button>
        </header>

        <ul className="py-1">
          <SectionLabel>Navigate</SectionLabel>
          <MenuLink href="/dashboard" icon={<IconHome />}>
            Dashboard
          </MenuLink>
          <MenuLink href="/gallery" icon={<IconGallery />}>
            Gallery
          </MenuLink>
          <MenuLink href="/projects/new" icon={<IconPlus />}>
            New project
          </MenuLink>
          <MenuLink href="/profile" icon={<IconUser />}>
            Profile
          </MenuLink>

          {projectId ? (
            <>
              <MenuDivider />
              <SectionLabel>This project</SectionLabel>
              <MenuLink
                href={`/projects/${projectId}`}
                icon={<IconWorkspace />}
              >
                Workspace
              </MenuLink>
              <MenuLink
                href={`/projects/${projectId}/storyboard`}
                icon={<IconStoryboard />}
              >
                Storyboard
              </MenuLink>
              <MenuLink
                href={`/projects/${projectId}/stitch`}
                icon={<IconStitch />}
              >
                Stitch &amp; export
              </MenuLink>
              <MenuLink
                href={`/projects/${projectId}/edit`}
                icon={<IconEdit />}
              >
                Edit sheet &amp; bible
              </MenuLink>
            </>
          ) : null}

          <MenuDivider />
          <SectionLabel>Diagnostics</SectionLabel>
          <li>
            <button
              type="button"
              onClick={runHealth}
              className="flex w-full items-center gap-3 px-5 py-3 font-body text-sm text-ink hover:bg-paper-deep animate-press"
            >
              <span className="flex h-8 w-8 items-center justify-center text-ink-soft">
                <IconPulse />
              </span>
              <span className="flex-1 text-left">
                {healthState.kind === "checking"
                  ? "Checking Replicate…"
                  : "Check image generator"}
              </span>
              {healthState.kind === "ok" ? (
                <span className="font-body text-[10px] uppercase tracking-widest text-green-seal">
                  ok
                </span>
              ) : healthState.kind === "bad" ? (
                <span className="font-body text-[10px] uppercase tracking-widest text-red-grease">
                  fail
                </span>
              ) : null}
            </button>
            {healthState.kind === "ok" || healthState.kind === "bad" ? (
              <p
                className={`mx-5 mb-2 rounded border px-3 py-2 font-body text-xs leading-relaxed ${
                  healthState.kind === "ok"
                    ? "border-green-seal/30 bg-paper-soft text-ink-soft"
                    : "border-red-grease/30 bg-paper-soft text-red-grease"
                }`}
              >
                {healthState.detail}
              </p>
            ) : null}
          </li>

          <MenuDivider />
          <li>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="flex w-full items-center gap-3 px-5 py-3 text-left font-body text-sm text-red-grease hover:bg-paper-deep animate-press"
              >
                <span className="flex h-8 w-8 items-center justify-center">
                  <IconSignOut />
                </span>
                Sign out
              </button>
            </form>
          </li>
        </ul>
      </div>
    </div>
  );
}

// --- Bits -------------------------------------------------------------

function MenuLink({
  href,
  children,
  icon,
}: {
  href: string;
  children: React.ReactNode;
  icon: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 px-5 py-3 font-body text-sm text-ink hover:bg-paper-deep animate-press animate-icon-hover"
      >
        <span className="flex h-8 w-8 items-center justify-center text-ink-soft">
          {icon}
        </span>
        <span className="flex-1">{children}</span>
      </Link>
    </li>
  );
}

function MenuDivider() {
  return <li aria-hidden className="my-1 border-t border-ink/10" />;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <li
      aria-hidden
      className="px-5 pb-1 pt-2 font-body text-[10px] uppercase tracking-[0.18em] text-ink-soft/60"
    >
      {children}
    </li>
  );
}

// --- Icons (hand-drawn stroke style, single-color) --------------------

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.2 12 4l9 7.2" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}
function IconGallery() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="14" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m3 17 5-5 4 4 3-3 6 6" />
    </svg>
  );
}
function IconPlus() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}
function IconUser() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5" />
    </svg>
  );
}
function IconWorkspace() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16v10H4z" />
      <path d="M9 20h6M12 16v4" />
    </svg>
  );
}
function IconStoryboard() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="6" height="14" rx="1" />
      <rect x="11" y="5" width="6" height="14" rx="1" />
      <rect x="19" y="5" width="2" height="14" rx="1" />
    </svg>
  );
}
function IconStitch() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
      <path d="M8 4v3M8 10v4M8 16v4M16 4v3M16 10v4M16 16v4" strokeDasharray="2 2" />
    </svg>
  );
}
function IconEdit() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21c2.5-1 4-2 5-3l9.2-9.2a2 2 0 1 0-2.8-2.8L5.2 15.2C4 16.2 3 18 3 21z" />
      <path d="M13.8 5.5 18 9.7" />
    </svg>
  );
}
function IconPulse() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h4l2-5 4 10 2-5h6" />
    </svg>
  );
}
function IconSignOut() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden fill="none"
      stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h12" />
    </svg>
  );
}
