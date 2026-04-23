"use client";

import { useCallback, useState } from "react";

/**
 * Copy someone's public project into a new one owned by the current
 * user, seeded with the same character sheet + aesthetic bible. Sends
 * them to the new workspace on success.
 */
export function RemixButton({
  shareToken,
  label = "Remix",
  compact,
}: {
  shareToken: string;
  label?: string;
  compact?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/projects/remix", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source_token: shareToken }),
      });
      const body = await res.json();
      if (!res.ok) {
        if (res.status === 401) {
          window.location.href = `/login?next=${encodeURIComponent(
            window.location.pathname,
          )}`;
          return;
        }
        throw new Error(body?.error ?? "Remix failed");
      }
      if (body.url) window.location.href = body.url as string;
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [shareToken]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={error ?? "Start a new project from this one"}
      className={
        compact
          ? "inline-flex h-8 items-center gap-1 rounded-full border border-ink/25 bg-paper px-2.5 font-body text-[10px] uppercase tracking-widest text-ink hover:bg-ink/5 animate-press disabled:opacity-50"
          : "inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/25 bg-paper px-4 font-body text-[11px] uppercase tracking-widest text-ink hover:bg-ink/5 animate-press disabled:opacity-50"
      }
    >
      <svg
        viewBox="0 0 24 24"
        width={compact ? 11 : 13}
        height={compact ? 11 : 13}
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 3v6h-6" />
        <path d="M3 21v-6h6" />
        <path d="M21 9a9 9 0 0 0-15 -5.3L3 6" />
        <path d="M3 15a9 9 0 0 0 15 5.3L21 18" />
      </svg>
      {busy ? "…" : label}
    </button>
  );
}
