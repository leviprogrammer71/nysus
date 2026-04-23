import Link from "next/link";
import Image from "next/image";
import type { GalleryEntry } from "@/lib/gallery";

/**
 * Horizontal strip of publicly shared projects, shown on the landing
 * page and dashboard. Builds legibility as a multi-user product —
 * someone stumbling onto the app sees other directors' work, not just
 * "the owner's notebook".
 */
export function GalleryStrip({
  entries,
  title = "From the gallery",
  emptyMessage,
  viewAllHref = "/gallery",
}: {
  entries: GalleryEntry[];
  title?: string;
  emptyMessage?: string;
  viewAllHref?: string;
}) {
  if (entries.length === 0) {
    if (!emptyMessage) return null;
    return (
      <section className="mb-8 rounded-lg border border-dashed border-ink/15 bg-paper-deep px-4 py-5 text-center">
        <p className="font-body text-xs uppercase tracking-widest text-ink-soft/60">
          {title}
        </p>
        <p className="mt-1 font-body text-sm text-ink-soft/80">{emptyMessage}</p>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="mb-2 flex items-end justify-between">
        <h2 className="font-display text-base uppercase tracking-widest text-ink">
          {title}
        </h2>
        <Link
          href={viewAllHref}
          className="font-body text-[11px] uppercase tracking-widest text-ink-soft/70 hover:text-ink"
        >
          View all →
        </Link>
      </div>
      <ul className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
        {entries.map((e) => (
          <li
            key={e.id}
            className="relative w-36 shrink-0 snap-start overflow-hidden rounded-lg border border-ink/15 bg-paper sm:w-40 animate-lift"
          >
            <Link href={`/share/${e.share_token}`} className="block">
              <div className="relative aspect-[9/16] w-full bg-ink/5">
                {e.thumb_url ? (
                  <Image
                    src={e.thumb_url}
                    alt={e.title}
                    fill
                    sizes="(max-width: 640px) 144px, 160px"
                    className="object-cover"
                  />
                ) : null}
              </div>
              <div className="p-2">
                <p className="line-clamp-1 font-display text-[12px] text-ink">
                  {e.title}
                </p>
                <p className="line-clamp-1 font-body text-[10px] text-ink-soft/70">
                  {e.author}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
