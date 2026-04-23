"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Project dashboard card. Shows the project's latest still as a
 * background image behind the title when one exists; falls back to a
 * quiet paper-deep tile otherwise. Hover-delete (× button in the top
 * corner) stays opaque on touch so mobile users can reach it.
 *
 * `thumbUrl` is an already-signed URL from the server render. If it
 * expires before the user interacts, we re-sign on demand via the
 * storage-path extracted from the URL.
 */
export function ProjectCard({
  id,
  title,
  description,
  updatedAt,
  thumbUrl,
  onDeleteAction,
}: {
  id: string;
  title: string;
  description: string | null;
  updatedAt: string;
  thumbUrl: string | null;
  onDeleteAction: (formData: FormData) => void;
}) {
  const [imgUrl, setImgUrl] = useState<string | null>(thumbUrl);

  // If the signed URL 401s, drop it and show the fallback.
  useEffect(() => {
    if (!thumbUrl) return;
    let cancelled = false;
    const probe = new Image();
    probe.onload = () => {
      if (!cancelled) setImgUrl(thumbUrl);
    };
    probe.onerror = () => {
      if (!cancelled) setImgUrl(null);
    };
    probe.src = thumbUrl;
    return () => {
      cancelled = true;
    };
  }, [thumbUrl]);

  return (
    <div className="group relative overflow-hidden rounded-lg border border-ink/10 bg-paper-deep animate-lift hover:border-ink/30">
      <Link href={`/projects/${id}`} className="block">
        <div className="relative aspect-[4/3] w-full bg-paper-deep">
          {imgUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imgUrl}
              alt=""
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div
              aria-hidden
              className="absolute inset-0 flex items-center justify-center font-display text-ink-soft/30 text-5xl"
            >
              ∅
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-paper via-paper/60 to-transparent" />
        </div>
        <div className="relative px-4 py-3 -mt-10">
          <h2 className="font-display text-xl text-ink leading-tight line-clamp-2">
            {title}
          </h2>
          {description ? (
            <p className="font-body text-xs text-ink-soft line-clamp-2 mt-1 leading-snug">
              {description}
            </p>
          ) : null}
          <p className="font-hand text-sm text-sepia-deep mt-1.5">
            updated {new Date(updatedAt).toLocaleDateString()}
          </p>
        </div>
      </Link>

      <form action={onDeleteAction} className="absolute top-2 right-2">
        <input type="hidden" name="id" value={id} />
        <button
          type="submit"
          aria-label={`Delete ${title}`}
          className="w-8 h-8 rounded-full bg-paper/90 border border-ink/30 inline-flex items-center justify-center text-red-grease hover:text-red-grease/70 font-display text-lg leading-none opacity-40 sm:opacity-0 group-hover:opacity-100 transition-opacity"
          formNoValidate
        >
          &times;
        </button>
      </form>
    </div>
  );
}
