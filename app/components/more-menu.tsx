"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Floating "more" sheet opened by the BottomNav's more-tab event.
 * Contextual: on a project page, surfaces edit + stitch + delete
 * shortcuts. Always shows sign out.
 *
 * Entirely client-side; listens for the `nysus:open-more-menu`
 * custom event dispatched by BottomNav.
 */
export function MoreMenu() {
  const [open, setOpen] = useState(false);
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

  // Close on route change. setState-in-effect is the correct pattern
  // here: we're syncing local UI state with a React hook value that
  // only the parent router can change.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- close menu when navigation occurs
    setOpen(false);
  }, [pathname]);

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
      <div className="relative w-full bg-paper border-t border-ink/20 pb-safe-plus-4">
        <header className="flex items-center justify-between px-5 py-3 border-b border-ink/10">
          <span className="font-hand text-xl text-ink">more</span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="font-display text-2xl text-ink-soft hover:text-ink px-2"
          >
            &times;
          </button>
        </header>

        <ul className="py-2">
          {projectId ? (
            <>
              <MenuLink href={`/projects/${projectId}/edit`}>
                edit project
              </MenuLink>
              <MenuLink href={`/projects/${projectId}/stitch`}>
                stitch &amp; export
              </MenuLink>
              <MenuLink href={`/projects/${projectId}`}>
                workspace
              </MenuLink>
              <MenuDivider />
            </>
          ) : null}
          <MenuLink href="/projects/new">new project</MenuLink>
          <MenuDivider />
          <li>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                className="w-full text-left px-5 py-3 font-body text-red-grease hover:bg-paper-deep transition-colors"
              >
                sign out
              </button>
            </form>
          </li>
        </ul>
      </div>
    </div>
  );
}

function MenuLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="block px-5 py-3 font-body text-ink hover:bg-paper-deep transition-colors"
      >
        {children}
      </Link>
    </li>
  );
}

function MenuDivider() {
  return <li aria-hidden className="my-1 mx-5 border-t border-ink/10" />;
}
