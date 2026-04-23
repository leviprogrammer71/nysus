"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Project-level draft-mode switch. When on, stills route to
 * gpt-image-2 at "low" quality (1:1 square) and videos use Seedance
 * Lite. Great for sketching a 6-shot sequence before committing to
 * the expensive models.
 */
export function DraftModeToggle({ projectId }: { projectId: string }) {
  const [on, setOn] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/projects/${projectId}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const body = (await res.json()) as { draft_mode?: boolean };
        if (!cancelled) setOn(Boolean(body.draft_mode));
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const toggle = useCallback(async () => {
    if (on == null) return;
    setError(null);
    setBusy(true);
    const next = !on;
    setOn(next);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ draft_mode: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error ?? "Draft toggle failed");
      }
    } catch (err) {
      setOn(!next);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [on, projectId]);

  if (on == null) return null;

  return (
    <label
      className="inline-flex items-center gap-1.5 font-body text-[11px] uppercase tracking-widest text-ink"
      title="Draft mode routes to cheaper models for quick exploration"
    >
      <input
        type="checkbox"
        checked={on}
        disabled={busy}
        onChange={toggle}
        className="h-4 w-4"
      />
      Draft mode
      {error ? (
        <span className="ml-2 text-red-grease" role="alert">
          {error}
        </span>
      ) : null}
    </label>
  );
}
