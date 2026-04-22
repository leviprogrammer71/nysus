"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";

/**
 * Global error boundary — caught at the app segment.
 *
 * Any unhandled error in a server component or client render lands
 * here. Keep the UI calm; most users will hit this mid-stream and
 * just need a "try again" path.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (typeof console !== "undefined") {
      console.error("Nysus error boundary:", error);
    }
  }, [error]);

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-md flex flex-col items-center gap-5">
        <div className="relative w-56 sm:w-64 animate-paper-drift">
          <Image
            src="/illustrations/torn-screenplay.png"
            alt="A torn screenplay page"
            width={480}
            height={620}
            priority
            className="w-full h-auto mix-blend-multiply"
            sizes="(max-width: 480px) 60vw, 256px"
          />
        </div>
        <h1 className="font-display text-3xl text-ink">
          the reel <span className="highlight">jammed</span>
        </h1>
        <p className="font-body text-ink-soft leading-relaxed">
          Something went off-script. The director is unharmed &mdash; try again
          or reload the page.
        </p>
        <p className="font-mono text-xs text-ink-soft/70 max-w-sm break-words">
          {error.message}
        </p>
        <div className="flex gap-3 mt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="px-4 py-2 bg-ink text-paper font-body tracking-wide hover:bg-ink-soft transition-colors"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-4 py-2 bg-paper border border-ink text-ink font-body tracking-wide hover:bg-paper-deep transition-colors"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
