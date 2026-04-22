import Link from "next/link";
import { NewProjectForm } from "./new-project-form";

export const metadata = {
  title: "New project · Nysus",
};

export default function NewProjectPage() {
  return (
    <main className="min-h-screen flex flex-col px-6 py-10 max-w-2xl mx-auto w-full">
      <header className="flex items-center justify-between mb-10">
        <Link
          href="/"
          className="-ml-2 px-2 py-2 font-hand text-lg text-sepia-deep hover:text-ink transition-colors inline-flex items-center min-h-11"
        >
          &larr; back
        </Link>
      </header>

      <h1 className="font-display text-4xl text-ink mb-2">
        a <span className="highlight">new</span> project
      </h1>
      <p className="font-hand text-lg text-ink-soft mb-8">
        a world of shots, a chain of clips
      </p>

      <div className="rule-ink mb-8" />

      <NewProjectForm />
    </main>
  );
}
