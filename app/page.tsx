export default function Home() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 gap-10">
      <header className="flex flex-col items-center gap-3 text-center">
        <div
          aria-hidden
          className="w-14 h-14 rounded-full border border-ink/60 flex items-center justify-center font-display text-3xl text-ink"
        >
          N
        </div>
        <h1 className="font-display text-5xl md:text-6xl tracking-[0.18em] text-ink">
          NYSUS
        </h1>
        <p className="font-hand text-xl text-ink-soft">
          a filmmaker&rsquo;s <span className="highlight">notebook</span>
        </p>
      </header>

      <div className="w-full max-w-md rule-ink" />

      <section className="max-w-md text-center space-y-4">
        <p className="font-body text-ink-soft leading-relaxed">
          Chained AI video generation, directed by conversation. Clip by clip,
          frame by frame &mdash; each shot seeds the next.
        </p>
        <p className="font-hand text-lg text-sepia-deep">
          Phase 0 &mdash; scaffold online &rarr;
        </p>
      </section>

      <footer className="mt-10 flex items-center gap-3 text-xs uppercase tracking-widest text-ink-soft/70 font-body">
        <span className="inline-block w-6 h-px bg-ink/30" />
        <span>after Dionysus</span>
        <span className="inline-block w-6 h-px bg-ink/30" />
      </footer>
    </main>
  );
}
