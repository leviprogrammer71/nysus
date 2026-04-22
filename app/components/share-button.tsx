"use client";

import { useCallback, useState } from "react";

/**
 * Share button shown on project pages. First click mints a share
 * token, second click copies the link to clipboard. Tertiary action
 * disables sharing from a menu.
 */
export function ShareButton({ projectId }: { projectId: string }) {
  const [url, setUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const act = useCallback(
    async (action: "enable" | "rotate" | "disable") => {
      setError(null);
      setBusy(true);
      try {
        const res = await fetch(`/api/projects/${projectId}/share`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Share failed");
        if (body.url) {
          const full = `${window.location.origin}${body.url}`;
          setUrl(full);
          try {
            await navigator.clipboard.writeText(full);
            setCopied(true);
            setTimeout(() => setCopied(false), 2500);
          } catch {
            /* clipboard may be blocked; the button still shows the url */
          }
        } else {
          setUrl(null);
        }
        setMenuOpen(false);
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [projectId],
  );

  return (
    <div className="relative inline-flex items-center gap-2">
      {url ? (
        <button
          type="button"
          onClick={() => act("enable")}
          className="rounded-full border border-ink/25 bg-paper px-3 py-1 font-body text-[11px] uppercase tracking-widest text-ink hover:bg-ink/5"
          title={url}
        >
          {copied ? "Link copied" : "Copy share link"}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => act("enable")}
          disabled={busy}
          className="rounded-full border border-ink/25 bg-paper px-3 py-1 font-body text-[11px] uppercase tracking-widest text-ink hover:bg-ink/5 disabled:opacity-50"
        >
          {busy ? "…" : "Share"}
        </button>
      )}
      <button
        type="button"
        onClick={() => setMenuOpen((s) => !s)}
        className="rounded-full border border-ink/25 bg-paper px-2 py-1 font-body text-[11px] uppercase tracking-widest text-ink-soft hover:bg-ink/5"
        aria-label="Share options"
      >
        ⋯
      </button>
      {menuOpen ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-44 rounded border border-ink/15 bg-paper py-1 shadow-lg">
          <button
            type="button"
            onClick={() => act("rotate")}
            className="block w-full px-3 py-2 text-left font-body text-xs text-ink hover:bg-ink/5"
          >
            Rotate link
          </button>
          <button
            type="button"
            onClick={() => act("disable")}
            className="block w-full px-3 py-2 text-left font-body text-xs text-red-grease hover:bg-ink/5"
          >
            Stop sharing
          </button>
        </div>
      ) : null}
      {error ? (
        <span className="font-body text-[11px] text-red-grease" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}
