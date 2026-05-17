"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * WorkspaceShell — the persistent chrome of the authenticated app.
 *
 *   Desktop (md+): a left rail with the logo, primary navigation,
 *                  a Recent Projects switcher, and a footer with
 *                  Profile + Sign out. Always visible while you're
 *                  inside the app.
 *   Mobile:        a slim top header with the wordmark + a "Projects"
 *                  switcher button that drops a sheet. The existing
 *                  BottomNav handles in-context actions.
 *
 * The shell deliberately hides on public/pre-auth pages (landing,
 * login, setup, auth callback, share-link pages) so they keep their
 * own narrow framing.
 */

const PUBLIC_PATHS = ["/", "/login", "/setup", "/auth", "/share", "/pricing"];

function isPublic(pathname: string): boolean {
  return (
    PUBLIC_PATHS.some(
      (p) => pathname === p || pathname.startsWith(`${p}/`),
    ) ||
    // Auth route group
    pathname.startsWith("/auth/")
  );
}

type RecentProject = {
  id: string;
  title: string;
  updated_at: string;
};

export function WorkspaceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "/";
  const hidden = isPublic(pathname);
  const [recent, setRecent] = useState<RecentProject[]>([]);
  const [recentLoaded, setRecentLoaded] = useState(false);

  // Fetch recent projects once the user lands inside the app. Cheap
  // call — RLS scopes it — and a re-fetch on path change keeps the
  // switcher current when the user creates / renames a project.
  useEffect(() => {
    if (hidden) return;
    let canceled = false;
    fetch("/api/projects/recent", { cache: "no-store" })
      .then((r) => r.json())
      .then((body) => {
        if (canceled) return;
        const list = Array.isArray(body.projects) ? body.projects : [];
        setRecent(list);
        setRecentLoaded(true);
      })
      .catch(() => setRecentLoaded(true));
    return () => {
      canceled = true;
    };
  }, [hidden, pathname]);

  if (hidden) return <>{children}</>;

  // Which top-level surface we're on, for highlighting nav.
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const activeProjectId = projectMatch?.[1] ?? null;
  const surface: "dashboard" | "project" | "playground" | "gallery" | "photos" | "profile" | "other" =
    pathname === "/dashboard"
      ? "dashboard"
      : activeProjectId
      ? "project"
      : pathname.startsWith("/playground")
      ? "playground"
      : pathname.startsWith("/gallery")
      ? "gallery"
      : pathname.startsWith("/my-photos")
      ? "photos"
      : pathname.startsWith("/profile")
      ? "profile"
      : "other";

  return (
    <div className="flex min-h-screen w-full">
      {/* === Desktop sidebar === */}
      <aside
        aria-label="Workspace navigation"
        className="hidden md:flex md:w-64 md:shrink-0 md:flex-col md:border-r md:border-ink/10 md:bg-paper-deep/40"
      >
        <div className="sticky top-0 flex h-screen flex-col">
          {/* Brand */}
          <Link
            href="/dashboard"
            className="flex items-center gap-2 px-4 py-4 border-b border-ink/10 hover:bg-paper transition-colors"
          >
            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink text-paper font-display text-xs">
              N
            </span>
            <span className="font-display text-sm tracking-[0.22em] text-ink">
              NYSUS
            </span>
          </Link>

          {/* Primary nav */}
          <nav className="flex flex-col gap-0.5 px-2 py-3 font-body text-[12px]">
            <PrimaryLink
              href="/projects/new"
              label="New film"
              variant="primary"
              icon={<IconPlus />}
            />
            <PrimaryLink
              href="/dashboard"
              label="Dashboard"
              icon={<IconHome />}
              active={surface === "dashboard"}
            />
            <PrimaryLink
              href="/playground"
              label="Playground"
              icon={<IconForge />}
              active={surface === "playground"}
              subtitle="the threshold"
            />
            <PrimaryLink
              href="/gallery"
              label="Gallery"
              icon={<IconGallery />}
              active={surface === "gallery"}
            />
            <PrimaryLink
              href="/my-photos"
              label="My photos"
              icon={<IconArchive />}
              active={surface === "photos"}
            />
          </nav>

          {/* Recent projects */}
          <div className="px-2 pt-2 pb-1 mt-1 border-t border-ink/10">
            <p className="px-2 py-1 font-body text-[9px] uppercase tracking-[0.22em] text-ink-soft/55">
              Recent projects
            </p>
            <ul className="flex flex-col gap-0.5">
              {!recentLoaded ? (
                <li className="px-2 py-1.5 font-hand text-[12px] text-ink-soft/50">
                  loading…
                </li>
              ) : recent.length === 0 ? (
                <li className="px-2 py-1.5 font-hand text-[12px] text-ink-soft/60">
                  no films yet — start one
                </li>
              ) : (
                recent.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md font-body text-[12px] transition-colors animate-press ${
                        activeProjectId === p.id
                          ? "bg-paper text-ink shadow-[0_1px_3px_rgba(27,42,58,0.08)]"
                          : "text-ink-soft/75 hover:text-ink hover:bg-paper/60"
                      }`}
                    >
                      <span
                        aria-hidden
                        className="inline-block h-1.5 w-1.5 rounded-full bg-sepia-deep/60 shrink-0"
                      />
                      <span className="truncate">{p.title || "Untitled"}</span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>

          <div className="flex-1" />

          {/* Footer — profile + sign out */}
          <div className="px-2 py-3 border-t border-ink/10">
            <PrimaryLink
              href="/profile"
              label="Profile"
              icon={<IconUser />}
              active={surface === "profile"}
            />
            <form action="/auth/signout" method="POST">
              <button
                type="submit"
                className="w-full mt-0.5 flex items-center gap-2 px-2 py-1.5 rounded-md font-body text-[12px] text-ink-soft/70 hover:text-ink hover:bg-paper/60 transition-colors animate-press"
              >
                <span className="inline-flex h-5 w-5 items-center justify-center text-ink-soft/60">
                  <IconSignOut />
                </span>
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      {/* === Mobile top header === */}
      <div className="md:hidden fixed inset-x-0 top-0 z-30 bg-paper/95 backdrop-blur border-b border-ink/10">
        <div className="flex items-center justify-between px-4 py-2.5">
          <Link href="/dashboard" className="flex items-center gap-1.5">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-ink text-paper font-display text-[10px]">
              N
            </span>
            <span className="font-display text-xs tracking-[0.22em] text-ink">
              NYSUS
            </span>
          </Link>
          <ProjectSwitcherMobile
            recent={recent}
            activeProjectId={activeProjectId}
          />
        </div>
      </div>

      {/* === Main content === */}
      <main className="flex-1 min-w-0 pt-[44px] md:pt-0">{children}</main>
    </div>
  );
}

function PrimaryLink({
  href,
  label,
  icon,
  active,
  subtitle,
  variant,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  subtitle?: string;
  variant?: "primary";
}) {
  const base =
    "flex items-center gap-2 px-2 py-1.5 rounded-md font-body text-[12px] transition-colors animate-press";
  const styles = variant === "primary"
    ? "bg-ink text-paper hover:bg-ink-soft"
    : active
    ? "bg-paper text-ink shadow-[0_1px_3px_rgba(27,42,58,0.08)]"
    : "text-ink-soft/80 hover:text-ink hover:bg-paper/60";
  return (
    <Link href={href} className={`${base} ${styles}`} prefetch={false}>
      <span
        className={`inline-flex h-5 w-5 items-center justify-center shrink-0 ${
          variant === "primary"
            ? "text-paper"
            : active
            ? "text-sepia-deep"
            : "text-ink-soft/60"
        }`}
      >
        {icon}
      </span>
      <span className="flex-1 truncate">{label}</span>
      {subtitle ? (
        <span
          className={`font-hand text-[10px] leading-none ${
            variant === "primary" ? "text-paper/70" : "text-ink-soft/50"
          }`}
        >
          · {subtitle}
        </span>
      ) : null}
    </Link>
  );
}

function ProjectSwitcherMobile({
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
        aria-label="Switch project"
        className="inline-flex h-8 items-center gap-1 rounded-full border border-ink/20 bg-paper px-3 font-body text-[10px] uppercase tracking-widest text-ink"
      >
        Films
        <span aria-hidden className="ml-0.5">↓</span>
      </button>
      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div
            className="absolute inset-x-0 top-0 bg-paper border-b border-ink/10 pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-ink/10">
              <span className="font-display text-sm tracking-[0.22em] text-ink">
                FILMS
              </span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="font-body text-[11px] uppercase tracking-widest text-ink-soft hover:text-ink"
              >
                close
              </button>
            </div>
            <ul className="flex flex-col gap-0 py-2 max-h-[60vh] overflow-y-auto">
              <li>
                <Link
                  href="/projects/new"
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 font-body text-sm text-ink bg-ink/0 hover:bg-paper-deep border-b border-ink/5"
                >
                  + New film
                </Link>
              </li>
              {recent.length === 0 ? (
                <li className="px-4 py-3 font-hand text-sm text-ink-soft/70">
                  no films yet
                </li>
              ) : (
                recent.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/projects/${p.id}`}
                      onClick={() => setOpen(false)}
                      className={`block px-4 py-3 font-body text-sm border-b border-ink/5 ${
                        activeProjectId === p.id
                          ? "bg-paper-deep text-ink"
                          : "text-ink-soft/85 hover:bg-paper-deep hover:text-ink"
                      }`}
                    >
                      {p.title || "Untitled"}
                    </Link>
                  </li>
                ))
              )}
            </ul>
          </div>
        </div>
      ) : null}
    </>
  );
}

// --- Icons ---------------------------------------------------------

function Stroke({ children }: { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="16"
      height="16"
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}
function IconPlus() {
  return (
    <Stroke>
      <path d="M12 5v14M5 12h14" />
    </Stroke>
  );
}
function IconHome() {
  return (
    <Stroke>
      <path d="M3 11.2 12 4l9 7.2" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </Stroke>
  );
}
function IconForge() {
  return (
    <Stroke>
      <path d="M4 13h12a3 3 0 0 0 3-3" />
      <path d="M6 13v3a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-3" />
      <path d="M8 17v3M12 17v3" />
      <path d="M19 5l1 2-2 1 1 2" />
    </Stroke>
  );
}
function IconGallery() {
  return (
    <Stroke>
      <rect x="3" y="4" width="18" height="14" rx="1" />
      <circle cx="9" cy="9" r="1.5" />
      <path d="m3 16 5-5 4 4 4-3 5 4" />
    </Stroke>
  );
}
function IconArchive() {
  return (
    <Stroke>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8" />
      <path d="M10 12h4" />
    </Stroke>
  );
}
function IconUser() {
  return (
    <Stroke>
      <circle cx="12" cy="9" r="3.5" />
      <path d="M5 20c1-3.5 4-5.5 7-5.5s6 2 7 5.5" />
    </Stroke>
  );
}
function IconSignOut() {
  return (
    <Stroke>
      <path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3" />
      <path d="M10 17l-5-5 5-5" />
      <path d="M5 12h12" />
    </Stroke>
  );
}
