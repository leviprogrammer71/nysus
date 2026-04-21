import Link from "next/link";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-md flex flex-col items-center gap-4">
        <div
          aria-hidden
          className="w-14 h-14 rounded-full border border-ink/60 flex items-center justify-center font-display text-3xl text-ink"
        >
          ∅
        </div>
        <h1 className="font-display text-4xl text-ink tracking-wide">
          <span className="highlight">cut</span>
        </h1>
        <p className="font-hand text-lg text-ink-soft">
          this scene isn&rsquo;t in the notebook
        </p>
        <Link
          href="/"
          className="mt-4 px-4 py-2 bg-ink text-paper font-body tracking-wide hover:bg-ink-soft transition-colors"
        >
          Back home &rarr;
        </Link>
      </div>
    </main>
  );
}
