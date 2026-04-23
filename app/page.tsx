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
    <main className="min-h-screen flex flex-col px-4 sm:px-6 py-6 max-w-4xl mx-auto w-full">
      {/* Top nav */}
      <header className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2.5">
          <Logomark size={32} animated />
          <span className="font-display text-lg sm:text-xl tracking-[0.2em] text-ink">
            NYSUS
          </span>
        </div>
        <nav className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/gallery"
            className="px-2 sm:px-3 h-10 inline-flex items-center font-body text-[11px] uppercase tracking-widest text-ink-soft/70 hover:text-ink transition-colors"
          >
            Gallery
          </Link>
          <Link
            href="#try"
            className="hidden sm:inline-flex px-2 h-10 items-center font-body text-[11px] uppercase tracking-widest text-ink-soft/70 hover:text-ink transition-colors"
          >
            Try it
          </Link>
          <Link
            href="/login"
            className="px-3.5 h-10 inline-flex items-center bg-ink text-paper font-body text-[11px] uppercase tracking-widest hover:bg-ink-soft transition-colors"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="relative mb-12 overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute -top-10 right-0 h-64 w-64 rounded-full bg-highlight/20 blur-3xl"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute bottom-0 left-0 h-48 w-48 rounded-full bg-sepia/20 blur-3xl"
        />
        <div className="relative">
          <p className="font-body text-[11px] uppercase tracking-[0.28em] text-ink-soft/70">
            A studio in your pocket
          </p>
          <h1 className="font-display text-[2.5rem] sm:text-6xl text-ink leading-[1.02] mt-4 tracking-tight">
            Short films,{" "}
            <span className="highlight">chained</span> scene by scene.
          </h1>
          <p className="font-body text-base sm:text-lg text-ink-soft/85 mt-5 max-w-xl leading-[1.55]">
            A chat-driven filmmaking workspace. Talk the story through with an
            AI director, build a storyboard, generate every frame with
            gpt-image-2, animate with Seedance 2.0 or Kling, and stitch the
            whole film in your browser.
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3">
            <Link href="/login" className="btn-primary">
              Start a film →
            </Link>
            <Link href="/gallery" className="btn-secondary">
              Browse the gallery
            </Link>
            <span className="font-body text-xs text-ink-soft/70">
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
      <section className="mb-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Beat
          step="01"
          title="Plan"
          body="Chat builds the character sheet, the aesthetic bible, and the first scenes. Paste references any time."
        />
        <Beat
          step="02"
          title="Generate"
          body="Scenes get a still with gpt-image-2 or Flux. A storyboard grid lets you approve tiles before animating."
        />
        <Beat
          step="03"
          title="Animate & export"
          body="Seedance 2.0 for realism, Kling for stylized. Stitch, narrate, and caption in one tap — all in the browser."
        />
      </section>

      <footer className="mt-auto pt-6 pb-safe border-t border-ink/10 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Logomark size={24} />
          <span className="font-body text-[11px] uppercase tracking-widest text-ink-soft/70">
            Nysus · after Dionysus
          </span>
        </div>
        <div className="flex items-center gap-4 font-body text-[11px] uppercase tracking-widest text-ink-soft/70">
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
