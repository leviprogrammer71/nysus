"use client";

import { useCallback, useState } from "react";

/**
 * Hard-delete the current project. Tucked behind a confirm modal —
 * deletes are cascading + irreversible.
 */
export function DeleteProjectButton({
  projectId,
  projectTitle,
}: {
  projectId: string;
  projectTitle: string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const doDelete = useCallback(async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/delete`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Delete failed");
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setBusy(false);
    }
  }, [projectId]);

  return (
    <>
      <button
        type="button"
        onClick={() => setConfirming(true)}
        title="Delete this project"
        className="inline-flex h-8 items-center rounded-full border border-red-grease/40 bg-paper px-3 font-body text-[10px] uppercase tracking-widest text-red-grease hover:bg-red-grease/10 animate-press"
      >
        Delete
      </button>
      {confirming ? (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 px-4 backdrop-blur-sm"
          onClick={() => !busy && setConfirming(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="surface-elevated max-w-sm rounded-xl p-5"
          >
            <h3 className="font-display text-lg text-ink">
              Delete &ldquo;{projectTitle}&rdquo;?
            </h3>
            <p className="mt-2 font-body text-sm text-ink-soft/85 leading-relaxed">
              Wipes every still, clip, narration, and conversation in this
              project. This can&rsquo;t be undone.
            </p>
            {error ? (
              <p className="mt-3 rounded border border-red-grease/30 bg-paper-soft px-3 py-2 font-body text-xs text-red-grease">
                {error}
              </p>
            ) : null}
            <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                disabled={busy}
                onClick={() => setConfirming(false)}
                className="btn-secondary"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={doDelete}
                disabled={busy}
                className="inline-flex h-11 items-center rounded-full bg-red-grease px-5 font-body text-[12px] uppercase tracking-widest text-paper hover:opacity-90 animate-press disabled:opacity-60"
              >
                {busy ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
