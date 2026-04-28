import Link from "next/link";
import Image from "next/image";
import { Logomark } from "@/app/components/logomark";
import { loadGallery } from "@/lib/gallery";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const publicNavLinks = [
  { href: "/gallery", label: "Gallery" },
  { href: "/login", label: "Sign in" },
];
const authedNavLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/gallery", label: "My Gallery" },
];

/**
 * Public discovery page. Lists every project whose owner enabled
 * sharing. No auth — the rows opted themselves into public view via
 * the share toggle on the project header.
 */
export default async function GalleryPage() {
  const entries = await loadGallery({ limit: 48 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const navLinks = user ? authedNavLinks : publicNavLinks;

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 pb-28 pt-8 sm:px-6">
      <header className="mb-8 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2" aria-label="Nysus home">
          <Logomark size={32} />
          <span className="font-display text-lg tracking-[0.2em] text-ink">
            NYSUS
          </span>
        </Link>
        <nav className="flex items-center gap-3 font-body text-xs uppercase tracking-widest text-ink-soft/70">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={link.href === "/gallery" ? "text-ink" : "hover:text-ink"}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </header>

      <section className="mb-8">
        <h1 className="font-display text-3xl text-ink sm:text-4xl">Gallery</h1>
        <p className="mt-2 max-w-xl font-body text-sm text-ink-soft/80">
          Short films assembled by directors using Nysus. Every piece here was
          chained scene-by-scene — prompt, still, animate, stitch — and the
          owner chose to share it.
        </p>
      </section>

      {entries.length === 0 ? (
        <div className="rounded-lg border border-dashed border-ink/20 p-10 text-center">
          <p className="font-body text-sm text-ink-soft/70">
            Nothing here yet. Be the first — sign in, build a project, and hit
            Share.
          </p>
          <Link
            href="/login"
            className="mt-3 inline-block rounded-full border border-ink/25 bg-paper px-4 py-1.5 font-body text-xs uppercase tracking-widest text-ink hover:bg-ink/5"
          >
            Sign in to start
          </Link>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {entries.map((e) => (
            <li
              key={e.id}
              className="group overflow-hidden rounded-lg border border-ink/15 bg-paper transition-shadow hover:shadow-md"
            >
              <Link href={`/share/${e.share_token}`} className="block">
                <div className="relative aspect-[9/16] w-full bg-ink/5">
                  {e.thumb_url ? (
                    <Image
                      src={e.thumb_url}
                      alt={e.title}
                      fill
                      sizes="(max-width: 640px) 45vw, 22vw"
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/50">
                        untitled frame
                      </span>
                    </div>
                  )}
                  <div className="absolute right-1.5 top-1.5 rounded-full bg-paper/90 px-2 py-0.5 font-display text-[10px] uppercase tracking-widest text-ink">
                    {e.scene_count} {e.scene_count === 1 ? "scene" : "scenes"}
                  </div>
                </div>
                <div className="space-y-0.5 px-2.5 py-2">
                  <p
                    className="line-clamp-1 font-display text-[13px] text-ink"
                    style={{ wordBreak: "normal", overflowWrap: "break-word" }}
                  >
                    {e.title}
                  </p>
                  <p
                    className="line-clamp-1 font-body text-[11px] text-ink-soft/70"
                    style={{ wordBreak: "normal", overflowWrap: "break-word" }}
                  >
                    {e.author}
                  </p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
