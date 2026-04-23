"use client";

import { useCallback, useState } from "react";

/**
 * Download a clip media file with a proper attachment disposition.
 *
 * We POST-like fetch the streaming endpoint and then trigger a
 * client-side anchor download so Safari on iOS behaves (the `download`
 * attribute alone is ignored on cross-origin signed URLs). Works on
 * desktop too.
 */
export function DownloadButton({
  clipId,
  kind = "video",
  label,
  className,
}: {
  clipId: string;
  kind?: "video" | "still" | "narration" | "last_frame";
  label?: string;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onClick = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/clips/${clipId}/download?kind=${encodeURIComponent(kind)}`,
      );
      if (!res.ok) throw new Error(await res.text());
      const blob = await res.blob();
      const disposition = res.headers.get("content-disposition") ?? "";
      const match = /filename="?([^";]+)"?/i.exec(disposition);
      const fallback: Record<string, string> = {
        video: "nysus-scene.mp4",
        still: "nysus-scene.png",
        narration: "nysus-scene.mp3",
        last_frame: "nysus-scene-last-frame.jpg",
      };
      const filename = match?.[1] ?? fallback[kind];
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [clipId, kind]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      title={error ?? `Save ${kind}`}
      className={
        className ??
        "inline-flex items-center gap-1.5 rounded-full border border-ink/25 bg-paper px-3 py-1 font-body text-[11px] uppercase tracking-widest text-ink transition-all hover:bg-ink/5 active:scale-[0.97] disabled:opacity-50"
      }
    >
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        aria-hidden
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={busy ? "animate-pulse" : ""}
      >
        <path d="M12 4v12" />
        <path d="m7 11 5 5 5-5" />
        <path d="M5 20h14" />
      </svg>
      {label ?? "Save"}
    </button>
  );
}
