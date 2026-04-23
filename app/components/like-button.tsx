"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Heart + like count on a public gallery entry. Authenticated users
 * toggle; unauthenticated users are bounced to /login. The server
 * returns a fresh aggregate count on every change.
 */
export function LikeButton({
  shareToken,
  initialCount,
  compact,
  onClick: stopProp,
}: {
  shareToken?: string;
  initialCount?: number;
  compact?: boolean;
  /** When embedded inside another <Link>, block propagation to the parent. */
  onClick?: (e: React.MouseEvent) => void;
}) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount ?? 0);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!shareToken) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/gallery/like?share_token=${encodeURIComponent(shareToken)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const body = (await res.json()) as { liked: boolean; count: number };
        if (!cancelled) {
          setLiked(body.liked);
          setCount(body.count);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareToken]);

  const toggle = useCallback(
    async (e: React.MouseEvent) => {
      stopProp?.(e);
      e.preventDefault();
      if (busy || !shareToken) return;
      setBusy(true);
      const next = !liked;
      // Optimistic flip.
      setLiked(next);
      setCount((n) => n + (next ? 1 : -1));
      try {
        const res = await fetch("/api/gallery/like", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            share_token: shareToken,
            action: next ? "like" : "unlike",
          }),
        });
        const body = await res.json();
        if (!res.ok) {
          if (res.status === 401) {
            window.location.href = `/login?next=${encodeURIComponent(
              window.location.pathname,
            )}`;
            return;
          }
          throw new Error(body?.error ?? "Like failed");
        }
        setLiked(body.liked);
        setCount(body.count);
      } catch {
        // Roll back optimistic state.
        setLiked(!next);
        setCount((n) => n + (next ? -1 : 1));
      } finally {
        setBusy(false);
      }
    },
    [busy, liked, shareToken, stopProp],
  );

  const classes = compact
    ? "inline-flex h-8 items-center gap-1 rounded-full border border-ink/20 bg-paper px-2.5 font-body text-[10px] uppercase tracking-widest animate-press"
    : "inline-flex h-10 items-center gap-1.5 rounded-full border border-ink/25 bg-paper px-4 font-body text-[11px] uppercase tracking-widest animate-press";

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={liked}
      className={`${classes} ${
        liked ? "text-red-grease" : "text-ink-soft hover:text-ink"
      }`}
    >
      <svg
        viewBox="0 0 24 24"
        width={compact ? 12 : 14}
        height={compact ? 12 : 14}
        aria-hidden
        fill={liked ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path d="M12 21s-7.5-4.7-9.5-10c-1-2.7.3-6 3.2-6.5 2-.3 3.8.8 4.8 2.2.3.5 1 .5 1.3 0 1-1.4 2.7-2.5 4.7-2.2 3 .5 4.3 3.8 3.3 6.5C19.5 16.3 12 21 12 21z" />
      </svg>
      {count > 0 ? count : "Like"}
    </button>
  );
}
