"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import type { MyPhoto } from "@/lib/my-photos";

/**
 * Personal media grid. Tiles render the signed url and expose a delete
 * affordance per item. Stills + portraits + bible refs all delete via
 * /api/photos/[?]; the kind discriminator picks the right path.
 */
export function MyPhotosGrid({ initialPhotos }: { initialPhotos: MyPhoto[] }) {
  const [photos, setPhotos] = useState<MyPhoto[]>(initialPhotos);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const remove = useCallback(async (p: MyPhoto) => {
    if (
      !window.confirm(
        `Delete "${p.label}"? This removes the file from storage and detaches it from "${p.project_title}".`,
      )
    ) {
      return;
    }
    setError(null);
    setBusy(p.id);
    try {
      const res = await fetch("/api/photos/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: p.kind,
          project_id: p.project_id,
          clip_id: p.clip_id,
          character_name: p.character_name,
          ref_index: p.ref_index,
          bible_index: p.bible_index,
          path: p.path,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Delete failed");
      setPhotos((prev) => prev.filter((x) => x.id !== p.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  }, []);

  if (photos.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-ink/15 bg-paper-deep p-10 text-center">
        <p className="font-body text-sm text-ink-soft/80">
          Nothing yet. Generate stills, animate scenes, or upload references
          to a character sheet — they&rsquo;ll all show up here.
        </p>
      </div>
    );
  }

  return (
    <>
      {error ? (
        <p className="mb-3 rounded border border-red-grease/30 bg-paper-soft px-3 py-2 font-body text-xs text-red-grease">
          {error}
        </p>
      ) : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
        {photos.map((p) => (
          <li
            key={p.id}
            className="group relative overflow-hidden rounded-lg border border-ink/10 bg-paper-deep animate-lift"
          >
            <Link
              href={`/projects/${p.project_id}`}
              className="block"
              prefetch={false}
            >
              <div className="relative aspect-[3/4] w-full bg-ink/5">
                {p.kind === "video" ? (
                  p.signed_url ? (
                    <video
                      src={p.signed_url}
                      muted
                      loop
                      playsInline
                      preload="metadata"
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
                      no preview
                    </div>
                  )
                ) : p.signed_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={p.signed_url}
                    alt={p.label}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
                    no preview
                  </div>
                )}
                <div className="absolute left-1.5 top-1.5 rounded-full bg-paper/90 px-2 py-0.5 font-display text-[10px] uppercase tracking-widest text-ink">
                  {p.kind === "still"
                    ? "still"
                    : p.kind === "portrait"
                    ? "portrait"
                    : p.kind === "character_ref"
                    ? "ref"
                    : p.kind === "bible_ref"
                    ? "bible"
                    : "clip"}
                </div>
              </div>
              <div className="space-y-0.5 px-2.5 py-2">
                <p className="line-clamp-1 font-display text-[12px] text-ink">
                  {p.label}
                </p>
                <p className="line-clamp-1 font-body text-[10px] text-ink-soft/70">
                  {p.project_title}
                </p>
              </div>
            </Link>
            <button
              type="button"
              onClick={() => remove(p)}
              disabled={busy === p.id}
              aria-label="Delete"
              className="absolute right-1.5 top-1.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-paper/90 text-red-grease shadow-sm hover:bg-paper animate-press disabled:opacity-50"
            >
              {busy === p.id ? (
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  aria-hidden
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="animate-icon-spin"
                >
                  <path d="M21 12a9 9 0 1 1-6.2-8.55" />
                </svg>
              ) : (
                <svg
                  viewBox="0 0 24 24"
                  width="13"
                  height="13"
                  aria-hidden
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M4 7h16" />
                  <path d="M9 7v-2a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
                  <path d="m6 7 1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" />
                </svg>
              )}
            </button>
          </li>
        ))}
      </ul>
    </>
  );
}
