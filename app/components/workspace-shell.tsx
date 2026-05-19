"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MaskGlyph } from "./mask-glyph";

/**
 * WorkspaceShell — the persistent chrome of the authenticated app.
 *
 * Pulled directly from the design system (Dashboard.html / shell.js):
 *   - 232px sidebar with paper-grain background.
 *   - Half-mask glyph + "Nysus" wordmark + "a director's notebook"
 *     hand-lettered subtitle.
 *   - Sepia-rule dividers.
 *   - "Begin a film" CTA bordered in ink that fills on hover.
 *   - "The desk" nav: Dashboard / The threshold / Gallery / Bibles.
 *   - "Productions" list — the user's most recent films, each with
 *     a colored status dot.
 *   - Monthly-forge usage bar at the bottom in wine-dark.
 *   - Profile chip + "after Dionysus." sign-off.
 *
 * On mobile we ship a slim top bar with the mask + wordmark. Below the
 * fold the existing BottomNav handles in-context actions.
 *
 * Hides itself on landing / login / setup / share / pricing / auth.
 */

const PUBLIC_PATHS = ["/", "/login", "/setup", "/auth", "/share", "/pricing"];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    ) || pathname.startsWith("/auth/")
  );
}

type RecentProject = {
  id: string;
  title: string;
  updated_at: string;
  /** Soft state hint for the colored dot — derived client-side. */
  status?: "ready" | "live" | "draft" | "active";
};

type UsageSummary = {
  /** Percentage 0-100 of monthly forge consumed. */
  percent: number;
};

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const hidden = isPublic(pathname);
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [recentLoaded, setRecentLoaded] = useState(false);
  const [usage, setUsage] = useState<UsageSummary | null>(null);

  useEffect(() => {
    if (hidden) return;
    let canceled = false;
    fetch("/api/projects/recent", { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => {
        if (canceled) return;
        const list = Array.isArray(body.projects) ? body.projects : [];
        // Derive a soft status hint per project so the dots aren't
        // all the same color. Most-recent = highlight (in motion).
        const now = Date.now();
        const decorated: RecentProject[] = list.map(
          (p: RecentProject, i: number) => {
            const ageMs = now - new Date(p.updated_at).getTime();
            const days = ageMs / (1000 * 60 * 60 * 24);
            const status: RecentProject["status"] =
              i === 0
                ? "active"
                : days < 1
                ? "ready"
                : days < 7
                ? "live"
                : "draft";
            return { ...p, status };
          },
        );
        setRecent(decorated);
        setRecentLoaded(true);
      })
      .catch(() => setRecentLoaded(true));
    return () => {
      canceled = true;
    };
  }, [hidden, pathname]);

  // Usage probe (best-effort — degrades silently).
  useEffect(() => {
    if (hidden) return;
    let canceled = false;
    fetch("/api/usage/summary", { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => {
        if (canceled) return;
        if (typeof body?.percent === "number") setUsage({ percent: body.percent });
      })
      .catch(() => undefined);
    return () => {
      canceled = true;
    };
  }, [hidden, pathname]);

  if (hidden) return <>{children}</>;

  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const activeProjectId = projectMatch?.[1] ?? null;
  const surface: "dashboard" | "threshold" | "gallery" | "bibles" | "workspace" | "other" =
    pathname === "/dashboard"
      ? "dashboard"
      : activeProjectId
      ? "workspace"
      : pathname.startsWith("/playground")
      ? "threshold"
      : pathname.startsWith("/gallery")
      ? "gallery"
      : pathname.startsWith("/projects") || pathname.startsWith("/my-photos")
      ? "bibles"
      : "other";

  const navItems: Array<{
    key: typeof surface;
    label: string;
    hint: string;
    hintHand?: boolean;
    href: string;
  }> = [
    { key: "dashboard", label: "Dashboard", hint: "⌘1", href: "/dashboard" },
    {
      key: "threshold",
      label: "The threshold",
      hint: "playground",
      hintHand: true,
      href: "/playground",
    },
    { key: "gallery", label: "Gallery", hint: "", href: "/gallery" },
    { key: "bibles", label: "My photos", hint: "", href: "/my-photos" },
  ];

  return (
    <div className="flex min-h-screen w-full paper-grain vignette">
      {/* === Desktop sidebar (≥lg) === */}
      <aside
        aria-label="Workspace navigation"
        className="hidden lg:flex flex-col w-[232px] shrink-0 border-r border-[color:var(--color-sepia)]/30 min-h-screen px-5 py-7"
      >
        <Link href="/dashboard" className="block group">
          <div className="flex items-end gap-3">
            <MaskGlyph size={34} className="-mb-0.5" />
            <div className="leading-none">
              <div className="font-display text-[26px] tracking-[0.04em] text-ink">
                Nysus
              </div>
              <div className="font-hand text-[15px] text-[color:var(--color-sepia-deep)] -mt-0.5">
                a director&rsquo;s notebook
              </div>
            </div>
          </div>
        </Link>

        <div className="sepia-rule my-6" />

        <Link
          href="/projects/new"
          className="group flex items-baseline justify-between border border-[color:var(--color-ink)]/70 px-3 py-2.5 hover:bg-ink hover:text-paper transition-colors"
        >
          <span className="font-display italic text-[18px]">Begin a film</span>
          <span className="chev font-mono text-[12px] opacity-70 group-hover:opacity-100">
            ⟶
          </span>
        </Link>

        <nav className="mt-8 space-y-1 text-[14px]">
          <div className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-ink-soft)] mb-2 pl-2">
            The desk
          </div>
          {navItems.map((n) => {
            const active = surface === n.key;
            return (
              <Link
                key={n.key}
                href={n.href}
                className={`nav-row ${active ? "active" : ""}`}
                prefetch={false}
              >
                <span>{n.label}</span>
                {n.hint ? (
                  <span
                    className={
                      n.hintHand
                        ? "font-hand text-[14px] text-[color:var(--color-sepia-deep)]"
                        : "font-mono text-[10px] text-[color:var(--color-ink-soft)]"
                    }
                  >
                    {n.hint}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="sepia-rule my-6" />

        <div className="text-[11px]">
          <div className="font-mono uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)] mb-2">
            Productions
          </div>
          {!recentLoaded ? (
            <p className="font-hand text-[14px] text-[color:var(--color-sepia-deep)]/70">
              the page turns…
            </p>
          ) : recent.length === 0 ? (
            <p className="font-hand text-[14px] text-[color:var(--color-sepia-deep)]/80">
              no films yet — light the first torch
            </p>
          ) : (
            <ul className="space-y-1.5">
              {recent.slice(0, 6).map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <ProductionDot status={p.status} />
                  <Link
                    href={`/projects/${p.id}`}
                    className={`font-display text-[15px] truncate hover:text-[color:var(--color-wine-dark)] transition-colors ${
                      activeProjectId === p.id ? "italic text-ink" : "text-ink"
                    }`}
                  >
                    {p.title || "Untitled"}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer — monthly forge bar + profile + sign-off */}
        <div className="mt-auto pt-8 text-[11px] text-[color:var(--color-ink-soft)]">
          <div className="font-mono">
            {usage?.percent != null
              ? `${Math.round(usage.percent)}% of monthly forge`
              : "the forge stands ready"}
          </div>
          <div className="mt-1 h-[3px] bg-[color:var(--color-paper-deeper)] relative">
            <div
              className="absolute inset-y-0 left-0 bg-[color:var(--color-wine-dark)] transition-[width] duration-500"
              style={{ width: `${usage?.percent ?? 0}%` }}
            />
          </div>
          <Link
            href="/profile"
            className="mt-4 flex items-center gap-2 hover:text-ink transition-colors"
          >
            <span className="w-6 h-6 rounded-full bg-ink text-paper font-display text-[14px] grid place-items-center">
              ◉
            </span>
            <span className="font-display text-[15px] text-ink">Director</span>
          </Link>
          <div className="font-hand text-[14px] text-[color:var(--color-sepia-deep)] mt-4">
            after Dionysus.
          </div>
        </div>
      </aside>

      {/* === Mobile top bar (<lg) === */}
      <header className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 border-b border-[color:var(--color-sepia)]/30 bg-[color:var(--color-paper)]/95 backdrop-blur">
        <Link href="/dashboard" className="flex items-center gap-2">
          <MaskGlyph size={22} />
          <span className="font-display text-[22px] text-ink">Nysus</span>
        </Link>
        <MobileSwitcher recent={recent} activeProjectId={activeProjectId} />
      </header>

      {/* === Main === */}
      <main className="flex-1 min-w-0 pt-[58px] lg:pt-0">{children}</main>
    </div>
  );
}

function ProductionDot({ status }: { status?: RecentProject["status"] }) {
  const color =
    status === "active"
      ? "var(--color-highlight)"
      : status === "ready"
      ? "var(--color-green-seal)"
      : status === "live"
      ? "var(--color-sepia)"
      : "var(--color-sepia)";
  return (
    <span
      className="w-1.5 h-1.5 rounded-full shrink-0"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  );
}

function MobileSwitcher({
  recent,
  activeProjectId,
}: {
  recent: RecentProject[];
  activeProjectId: string | null;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        className="font-mono text-[11px] tracking-[0.22em] uppercase text-ink"
      >
        menu
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute inset-x-0 top-0 paper-grain border-b border-[color:var(--color-sepia)]/30 pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--color-sepia)]/30">
              <span className="font-display text-[22px] text-ink">The desk</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="font-mono text-[11px] uppercase tracking-[0.22em] text-[color:var(--color-ink-soft)] hover:text-ink"
              >
                close
              </button>
            </div>
            <nav className="px-2 py-2 space-y-1 text-[14px]">
              <Link
                href="/projects/new"
                onClick={() => setOpen(false)}
                className="flex items-baseline justify-between border border-[color:var(--color-ink)]/70 px-3 py-2.5 m-2 hover:bg-ink hover:text-paper transition-colors"
              >
                <span className="font-display italic text-[18px]">Begin a film</span>
                <span className="font-mono text-[12px]">⟶</span>
              </Link>
              <Link href="/dashboard" onClick={() => setOpen(false)} className="nav-row">
                <span>Dashboard</span>
              </Link>
              <Link href="/playground" onClick={() => setOpen(false)} className="nav-row">
                <span>The threshold</span>
                <span className="font-hand text-[14px] text-[color:var(--color-sepia-deep)]">
                  playground
                </span>
              </Link>
              <Link href="/gallery" onClick={() => setOpen(false)} className="nav-row">
                <span>Gallery</span>
              </Link>
              <Link href="/my-photos" onClick={() => setOpen(false)} className="nav-row">
                <span>My photos</span>
              </Link>
              <Link href="/profile" onClick={() => setOpen(false)} className="nav-row">
                <span>Profile</span>
              </Link>
            </nav>
            <div className="sepia-rule my-2" />
            <div className="px-4 pb-4">
              <div className="font-mono uppercase tracking-[0.22em] text-[11px] text-[color:var(--color-ink-soft)] mb-2">
                Productions
              </div>
              {recent.length === 0 ? (
                <p className="font-hand text-[15px] text-[color:var(--color-sepia-deep)]">
                  no films yet
                </p>
              ) : (
                <ul className="space-y-1.5 max-h-[40vh] overflow-y-auto">
                  {recent.map((p) => (
                    <li key={p.id} className="flex items-center gap-2">
                      <ProductionDot status={p.status} />
                      <Link
                        href={`/projects/${p.id}`}
                        onClick={() => setOpen(false)}
                        className={`font-display text-[16px] truncate ${
                          activeProjectId === p.id ? "italic text-ink" : "text-ink"
                        }`}
                      >
                        {p.title || "Untitled"}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-4 pb-4 font-hand text-[14px] text-[color:var(--color-sepia-deep)]">
              after Dionysus.
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
