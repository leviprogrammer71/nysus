import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { deleteProject } from "./actions";

// Home = projects list. Middleware guarantees `user` is present by
// the time we get here.
export default async function HomePage() {
  const supabase = await createClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, title, description, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-md text-center space-y-4">
          <p className="font-hand text-2xl text-red-grease">
            Could not load projects.
          </p>
          <p className="font-body text-ink-soft text-sm">{error.message}</p>
        </div>
      </main>
    );
  }

  const hasProjects = projects && projects.length > 0;

  return (
    <main className="min-h-screen flex flex-col px-6 py-10 max-w-2xl mx-auto w-full">
      <header className="flex items-center justify-between mb-12">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="Nysus home"
        >
          <span
            aria-hidden
            className="w-9 h-9 rounded-full border border-ink/60 flex items-center justify-center font-display text-lg text-ink"
          >
            N
          </span>
          <span className="font-display text-2xl tracking-[0.2em] text-ink">
            NYSUS
          </span>
        </Link>
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="font-body text-xs uppercase tracking-widest text-ink-soft/70 hover:text-ink transition-colors"
          >
            sign out
          </button>
        </form>
      </header>

      <div className="flex items-end justify-between mb-6">
        <h1 className="font-display text-4xl text-ink">
          <span className="highlight">projects</span>
        </h1>
        <Link
          href="/projects/new"
          className="font-hand text-xl text-sepia-deep hover:text-ink transition-colors"
        >
          + new &rarr;
        </Link>
      </div>

      <div className="rule-ink mb-8" />

      {hasProjects ? (
        <ul className="flex flex-col gap-4">
          {projects.map((p) => (
            <li key={p.id} className="group">
              <div className="flex items-start justify-between gap-4 p-4 bg-paper-deep hover:bg-paper-deep/70 transition-colors">
                <Link href={`/projects/${p.id}`} className="flex-1 min-w-0">
                  <h2 className="font-display text-2xl text-ink truncate">
                    {p.title}
                  </h2>
                  {p.description ? (
                    <p className="font-body text-sm text-ink-soft line-clamp-2 mt-1">
                      {p.description}
                    </p>
                  ) : null}
                  <p className="font-hand text-base text-sepia-deep mt-2">
                    updated {new Date(p.updated_at).toLocaleDateString()}
                  </p>
                </Link>
                <form action={deleteProject}>
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    aria-label={`Delete ${p.title}`}
                    className="opacity-0 group-hover:opacity-100 text-red-grease hover:text-red-grease/70 font-hand text-lg transition-opacity"
                    formNoValidate
                  >
                    &times;
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center text-center gap-6 py-16">
          <div
            aria-hidden
            className="w-24 h-24 rounded-full border border-ink/30 flex items-center justify-center font-display text-4xl text-ink-soft/60"
          >
            ∅
          </div>
          <p className="font-hand text-2xl text-ink-soft">
            the notebook is empty
          </p>
          <p className="font-body text-ink-soft max-w-sm leading-relaxed">
            Start a new project to begin directing a series. Each project holds
            its own character sheet, aesthetic bible, and chain of clips.
          </p>
          <Link
            href="/projects/new"
            className="px-5 py-2.5 bg-ink text-paper font-body tracking-wide hover:bg-ink-soft transition-colors"
          >
            New project &rarr;
          </Link>
        </div>
      )}
    </main>
  );
}
