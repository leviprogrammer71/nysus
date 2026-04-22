import Link from "next/link";
import Image from "next/image";

export default function NotFound() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16 text-center">
      <div className="max-w-md flex flex-col items-center gap-5">
        <div className="relative w-56 sm:w-64 animate-paper-drift">
          <Image
            src="/illustrations/torn-404.png"
            alt="A torn page marked 404"
            width={480}
            height={620}
            priority
            className="w-full h-auto mix-blend-multiply"
            sizes="(max-width: 480px) 60vw, 256px"
          />
        </div>
        <h1 className="font-display text-4xl text-ink tracking-wide">
          <span className="highlight">cut</span>
        </h1>
        <p className="font-hand text-lg text-ink-soft">
          this scene isn&rsquo;t in the notebook
        </p>
        <Link
          href="/"
          className="mt-2 px-4 py-2 bg-ink text-paper font-body tracking-wide hover:bg-ink-soft transition-colors"
        >
          Back home &rarr;
        </Link>
      </div>
    </main>
  );
}
