import Link from "next/link";
import { Logomark } from "./components/logomark";
import { GalleryStrip } from "./components/gallery-strip";
import { LandingChatPreview } from "./components/landing-chat-preview";
import { loadGallery } from "@/lib/gallery";

/**
 * Public landing page.
 *
 * Mobile-first and product-shaped: a clear hero that says what this is,
 * a gallery of work made by real directors on the platform, a live
 * preview of the assistant, and three concrete feature beats.
 *
 * We deliberately keep the paper/ink palette because that's the visual
 * identity, but the language is plural and product-style ("directors",
 * "projects") instead of journal-style ("your notebook"). Middleware
 * redirects signed-in users to /dashboard.
 */
export default async function LandingPage() {
  const entries = await loadGallery({ limit: 12 });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-5 py-5 sm:px-6 sm:py-6">
      {/* Top nav — tight on mobile, comfortable on desktop */}
      <header className="mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logomark size={28} animated />
          <span className="font-display text-[15px] sm:text-lg tracking-[0.22em] text-ink">
            NYSUS
          </span>
        </div>
        <nav className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/gallery"
            className="inline-flex h-11 min-w-11 items-center justify-center px-2.5 font-body text-[11px] uppercase tracking-widest text-ink-soft/80 hover:text-ink transition-colors animate-press"
          >
            Gallery
          </Link>
          <Link
            href="#try"
            className="hidden sm:inline-flex h-11 items-center px-2.5 font-body text-[11px] uppercase tracking-widest text-ink-soft/80 hover:text-ink transition-colors animate-press"
          >
            Try it
          </Link>
          <Link
            href="/login"
            className="ml-1 inline-flex h-11 items-center rounded-full bg-ink px-4 font-body text-[11px] uppercase tracking-widest text-paper hover:bg-ink-soft transition-colors animate-press"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* Hero — mobile-first: tighter type scale, smaller blurs on phones
          (they chew battery), larger CTA stack. */}
      <section className="relative mb-10 overflow-hidden sm:mb-12">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-6 right-[-20%] h-48 w-48 rounded-full bg-highlight/25 blur-2xl sm:-top-10 sm:right-0 sm:h-64 sm:w-64 sm:blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-[-10%] h-36 w-36 rounded-full bg-sepia/20 blur-2xl sm:h-48 sm:w-48 sm:blur-3xl"
        />
        <div className="relative">
          <p className="font-body text-[10px] uppercase tracking-[0.28em] text-ink-soft/70 sm:text-[11px]">
            A studio in your pocket
          </p>
          <h1 className="mt-3 font-display text-[2rem] leading-[1.05] tracking-tight text-ink sm:mt-4 sm:text-6xl sm:leading-[1.02]">
            Short films, <span className="highlight">chained</span> scene by
            scene.
          </h1>
          <p className="mt-4 max-w-xl font-body text-[15px] leading-[1.55] text-ink-soft/85 sm:mt-5 sm:text-lg">
            A chat-driven filmmaking workspace. Ari holds the thread while you
            plan the story; Mae turns it into stills and shots. gpt-image-2 for
            every frame, Seedance 2.0 or Kling for motion, stitched in your
            browser.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:mt-7 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <Link href="/login" className="btn-primary w-full sm:w-auto">
              Start a film →
            </Link>
            <Link href="/gallery" className="btn-secondary w-full sm:w-auto">
              Browse the gallery
            </Link>
            <span className="text-center font-body text-xs text-ink-soft/70 sm:text-left">
              Free to try · no credit card
            </span>
          </div>
        </div>
      </section>

      {/* Gallery — real work by real users, anchor the multi-user story */}
      <GalleryStrip
        entries={entries}
        title="Recent productions"
        emptyMessage="Directors' work will appear here as people publish their first cuts."
      />

      {/* Try the assistant */}
      <section className="mb-10 scroll-mt-20" id="try">
        <div className="mb-3">
          <h2 className="font-display text-2xl text-ink">Try the assistant</h2>
          <p className="font-body text-sm text-ink-soft/75 mt-1">
            A quick preview of the writer&rsquo;s room. Send a message — we&rsquo;ll walk
            you into signup before anything real happens.
          </p>
        </div>
        <LandingChatPreview />
      </section>

      {/* Feature grid */}
      <section className="mb-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Beat
          step="01"
          title="Ari plans"
          body="Tell Ari the story. She drafts the cast, the aesthetic, the through-line — with room for your taste on the calls that matter."
        />
        <Beat
          step="02"
          title="Mae builds"
          body="When the thread's tight, hand it to Mae. She fires character portraits and writes shot cards — gpt-image-2 stills, one tap each."
        />
        <Beat
          step="03"
          title="Animate & export"
          body="Seedance 2.0 for realism, Kling for stylized. Stitch, narrate, and caption in one tap — all in the browser."
        />
      </section>

      <footer className="pb-safe mt-auto flex flex-wrap items-center justify-between gap-3 border-t border-ink/10 pt-5">
        <div className="flex items-center gap-2">
          <Logomark size={22} />
          <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/70 sm:text-[11px]">
            Nysus · after Dionysus
          </span>
        </div>
        <div className="flex items-center gap-3 font-body text-[10px] uppercase tracking-widest text-ink-soft/70 sm:gap-4 sm:text-[11px]">
          <Link href="/gallery" className="hover:text-ink">
            Gallery
          </Link>
          <Link href="/login" className="hover:text-ink">
            Sign in
          </Link>
        </div>
      </footer>
    </main>
  );
}

function Beat({
  step,
  title,
  body,
}: {
  step: string;
  title: string;
  body: string;
}) {
  return (
    <div className="surface-card animate-lift rounded-xl p-5">
      <div className="flex items-center gap-2">
        <span className="font-display text-sm text-sepia-deep tabular-nums">
          {step}
        </span>
        <span className="font-body text-[10px] uppercase tracking-[0.15em] text-ink-soft/70">
          {title}
        </span>
      </div>
      <p className="mt-2 font-body text-sm text-ink/90 leading-relaxed">
        {body}
      </p>
    </div>
  );
}
