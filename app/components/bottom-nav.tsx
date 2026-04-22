"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback } from "react";

/**
 * Mobile-first persistent bottom navigation.
 *
 * Renders globally on authenticated pages; hides on /login and /setup
 * where there's no authenticated session yet. On project pages adds
 * contextual anchors (timeline, chat) that scroll to the matching
 * section instead of navigating.
 *
 * Pure client component so it can read usePathname() + handle the
 * smooth-scroll anchor behavior itself (Next Link doesn't do an
 * intelligent same-page scroll-to-id).
 */

// Bottom nav is an authenticated-app affordance; hide on the public
// landing and any pre-auth page.
const HIDDEN_PATHS = ["/login", "/setup", "/auth"];
const HIDDEN_EXACT = new Set<string>(["/"]);

type NavItem = {
  key: string;
  label: string;
  icon: React.ReactNode;
  href?: string;
  anchor?: string; // element id to scroll to, same page
  active?: boolean;
};

function IconHome() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden
      fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 11.2 12 4l9 7.2" />
      <path d="M5 10v9a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1v-9" />
    </svg>
  );
}
function IconReel() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden
      fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="2.2" />
      <circle cx="12" cy="5"  r="1.2" />
      <circle cx="12" cy="19" r="1.2" />
      <circle cx="5"  cy="12" r="1.2" />
      <circle cx="19" cy="12" r="1.2" />
    </svg>
  );
}
function IconPen() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden
      fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21c2.5-1 4-2 5-3l9.2-9.2a2 2 0 1 0-2.8-2.8L5.2 15.2C4 16.2 3 18 3 21z" />
      <path d="M13.8 5.5 18 9.7" />
    </svg>
  );
}
function IconStitch() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden
      fill="none" stroke="currentColor" strokeWidth="1.7"
      strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 7h16M4 12h16M4 17h16" />
      <path d="M8 4v3M8 10v4M8 16v4" strokeDasharray="2 2" />
      <path d="M16 4v3M16 10v4M16 16v4" strokeDasharray="2 2" />
    </svg>
  );
}
function IconMore() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden
      fill="currentColor">
      <circle cx="6" cy="12" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="18" cy="12" r="1.6" />
    </svg>
  );
}

function scrollToId(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  // Offset for the fixed top margin — a small visual breather.
  const top = el.getBoundingClientRect().top + window.scrollY - 12;
  window.scrollTo({ top, behavior: "smooth" });
}

export function BottomNav() {
  const pathname = usePathname() ?? "/";

  // Hide on auth-wall pages.
  if (HIDDEN_EXACT.has(pathname)) return null;
  if (HIDDEN_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return null;
  }

  const onProjectPage =
    /^\/projects\/[^/]+$/.test(pathname) ||
    /^\/projects\/[^/]+\/(edit|stitch)$/.test(pathname);
  const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
  const projectId = projectMatch?.[1] ?? null;
  const onStitch = pathname.endsWith("/stitch");
  const onEdit = pathname.endsWith("/edit");

  const items: NavItem[] = [];

  items.push({
    key: "home",
    label: "Home",
    icon: <IconHome />,
    href: "/",
    active: pathname === "/",
  });

  if (onProjectPage && projectId) {
    items.push({
      key: "timeline",
      label: "Timeline",
      icon: <IconReel />,
      anchor: onStitch || onEdit ? undefined : "timeline",
      href: onStitch || onEdit ? `/projects/${projectId}` : undefined,
    });
    items.push({
      key: "chat",
      label: "Chat",
      icon: <IconPen />,
      anchor: onStitch || onEdit ? undefined : "chat",
      href: onStitch || onEdit ? `/projects/${projectId}#chat` : undefined,
    });
    items.push({
      key: "stitch",
      label: "Stitch",
      icon: <IconStitch />,
      href: `/projects/${projectId}/stitch`,
      active: onStitch,
    });
  }

  items.push({
    key: "more",
    label: "More",
    icon: <IconMore />,
    anchor: "__more__", // see below — opens the floating menu
  });

  return (
    <>
      <nav
        role="navigation"
        aria-label="Primary"
        className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-paper/95 backdrop-blur border-t border-ink/15 pb-safe"
      >
        <ul className="flex items-stretch justify-around">
          {items.map((it) => (
            <li key={it.key} className="flex-1 min-w-0">
              {it.href ? (
                <Link
                  href={it.href}
                  className={`flex flex-col items-center justify-center gap-0.5 py-2 h-14 w-full font-body text-[10px] uppercase tracking-widest transition-colors ${
                    it.active
                      ? "text-ink"
                      : "text-ink-soft/70 hover:text-ink"
                  }`}
                  prefetch={false}
                >
                  <span className="h-5 flex items-center">{it.icon}</span>
                  <span>{it.label}</span>
                </Link>
              ) : (
                <BottomNavAction item={it} />
              )}
            </li>
          ))}
        </ul>
      </nav>
    </>
  );
}

function BottomNavAction({ item }: { item: NavItem }) {
  const onClick = useCallback(() => {
    if (item.anchor === "__more__") {
      // Dispatch a global event the Workspace (or root layout) listens
      // for. Keeps the menu content decoupled from the nav bar.
      window.dispatchEvent(new CustomEvent("nysus:open-more-menu"));
      return;
    }
    if (item.anchor) scrollToId(item.anchor);
  }, [item]);

  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 py-2 h-14 w-full font-body text-[10px] uppercase tracking-widest text-ink-soft/70 hover:text-ink transition-colors"
    >
      <span className="h-5 flex items-center">{item.icon}</span>
      <span>{item.label}</span>
    </button>
  );
}
