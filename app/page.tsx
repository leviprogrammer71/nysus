import Link from "next/link";
import { Logomark } from "./components/logomark";
import { ShowcaseStrip } from "./components/showcase-strip";
import { LandingChatPreview } from "./components/landing-chat-preview";
import { loadShowcase } from "@/lib/showcase";

/**
 * Public landing page.
 *
 * Mobile-first. Hero + showcase reels + "try Dio" chat preview that
 * signed-out users can type into (Send / attach / mic all prompt
 * sign-in). Middleware redirects signed-in users to /dashboard.
 */
export default async function LandingPage() {
  const reels = await loadShowcase();
  return (
    <main className="min-h-screen flex flex-col px-4 sm:px-6 py-6 max-w-3xl mx-auto w-full">
      <header className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Logomark size={36} animated />
          <span className="font-display text-xl sm:text-2xl tracking-[0.18em] text-ink">
            NYSUS
          </span>
        </div>
        <Link
          href="/login"
          className="px-3 h-11 inline-flex items-center bg-ink text-paper font-body text-[11px] uppercase tracking-widest hover:bg-ink-soft transition-colors"
        >
          sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="mb-8 pt-2 pb-6 border-b border-ink/10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 sm:gap-6">
          <div className="shrink-0 animate-paper-breath">
            <Logomark size={96} animated priority />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-3xl sm:text-5xl text-ink leading-tight">
              <span className="highlight">dionysian</span>
              <br />
              cinema, by chat.
            </h1>
            <p className="font-hand text-base sm:text-lg text-ink-soft mt-3 leading-snug">
              Dio is your director. Drop a sentence; he drafts the cast, the
              aesthetic, the opening scene. You tap generate; the image and
              the clip arrive.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/login"
                className="px-4 h-11 inline-flex items-center bg-ink text-paper font-body tracking-wide hover:bg-ink-soft transition-colors"
              >
                Start directing &rarr;
              </Link>
              <span className="font-hand text-sm text-sepia-deep">
                no credit card to try
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Showcase — the user's own films anchor the landing */}
      <ShowcaseStrip reels={reels} />

      {/* Try Dio — demo chat that prompts sign-in on send */}
      <section className="mb-8 scroll-mt-20" id="try">
        <div className="flex items-end justify-between mb-3">
          <h2 className="font-display text-2xl text-ink">
            <span className="highlight">talk to Dio</span>
          </h2>
          <span className="font-hand text-sm text-sepia-deep">
            a preview of the real thing
          </span>
        </div>
        <LandingChatPreview />
      </section>

      {/* What it does — three compact beats so unsigned visitors understand */}
      <section className="mb-10 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Beat
          step="01"
          title="talk it through"
          body="Dio drafts the character sheet, the aesthetic bible, and the first scenes from a sentence."
        />
        <Beat
          step="02"
          title="generate stills"
          body="Each scene gets a DALL-E image prompt. One tap produces a production still."
        />
        <Beat
          step="03"
          title="animate"
          body="Seedance 2.0 for realistic, Kling for stylized. Every clip keeps the face and wardrobe consistent."
        />
      </section>

      <footer className="mt-auto pt-6 pb-safe border-t border-ink/10 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Logomark size={28} />
          <span className="font-body text-[11px] uppercase tracking-widest text-ink-soft/70">
            after Dionysus
          </span>
        </div>
        <Link
          href="/login"
          className="font-hand text-base text-sepia-deep hover:text-ink transition-colors"
        >
          sign in &rarr;
        </Link>
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
    <div className="bg-paper-deep border border-ink/10 p-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="font-display text-sm text-sepia-deep">{step}</span>
        <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
          {title}
        </span>
      </div>
      <p className="font-body text-sm text-ink leading-snug">{body}</p>
    </div>
  );
}
