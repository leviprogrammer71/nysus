"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logomark } from "./logomark";
import { UsageStrip } from "./usage-strip";

/**
 * Authenticated top bar used across /dashboard, /projects/*, /gallery
 * (when signed in). Signals this is a product with sections, not just
 * one person's home page.
 *
 * Desktop: logo · tabs · usage strip · account menu
 * Mobile:  logo · active-tab label · account menu (tabs collapse into
 *          the existing BottomNav)
 */
export function AppTopbar({ email }: { email?: string | null }) {
  const pathname = usePathname() ?? "/";
  const tabs = [
    { href: "/dashboard", label: "Projects" },
    { href: "/gallery", label: "Gallery" },
  ];

  return (
    <div className="mb-6 flex items-center justify-between gap-3 border-b border-ink/10 pb-3">
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard"
          className="flex items-center gap-2.5"
          aria-label="Nysus home"
        >
          <Logomark size={28} animated />
          <span className="font-display text-sm tracking-[0.2em] text-ink">
            NYSUS
          </span>
        </Link>
        <nav className="hidden items-center gap-1 sm:flex">
          {tabs.map((t) => {
            const active =
              t.href === "/dashboard"
                ? pathname === "/dashboard" ||
                  pathname.startsWith("/projects/")
                : pathname.startsWith(t.href);
            return (
              <Link
                key={t.href}
                href={t.href}
                className={`px-3 h-9 inline-flex items-center font-body text-[11px] uppercase tracking-widest transition-colors ${
                  active
                    ? "text-ink border-b-2 border-ink"
                    : "text-ink-soft/70 hover:text-ink"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-3">
        <div className="hidden sm:block">
          <UsageStrip />
        </div>
        <AccountMenu email={email ?? null} />
      </div>
    </div>
  );
}

function AccountMenu({ email }: { email: string | null }) {
  const initials = email
    ? email
        .split("@")[0]
        .split(/[.\-_]/)
        .filter(Boolean)
        .slice(0, 2)
        .map((s) => s[0]?.toUpperCase() ?? "")
        .join("") || email[0]?.toUpperCase() || "?"
    : "?";
  return (
    <details className="relative">
      <summary
        className="flex h-9 w-9 cursor-pointer list-none items-center justify-center rounded-full border border-ink/20 bg-paper font-display text-[11px] text-ink hover:bg-ink/5 [&::-webkit-details-marker]:hidden"
        aria-label="Account menu"
      >
        {initials}
      </summary>
      <div className="absolute right-0 top-full z-30 mt-1 w-48 rounded border border-ink/15 bg-paper py-1 shadow-lg">
        {email ? (
          <p className="truncate px-3 pb-2 pt-1 font-body text-[11px] text-ink-soft/80">
            {email}
          </p>
        ) : null}
        <Link
          href="/dashboard"
          className="block px-3 py-2 font-body text-xs text-ink hover:bg-ink/5"
        >
          Projects
        </Link>
        <Link
          href="/gallery"
          className="block px-3 py-2 font-body text-xs text-ink hover:bg-ink/5"
        >
          Gallery
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="block w-full px-3 py-2 text-left font-body text-xs text-red-grease hover:bg-ink/5"
          >
            Sign out
          </button>
        </form>
      </div>
    </details>
  );
}
