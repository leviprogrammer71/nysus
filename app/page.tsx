import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { deleteProject } from "./actions";
import { Logomark } from "./components/logomark";
import { UsageStrip } from "./components/usage-strip";

// Home = projects list. Middleware guarantees `user` is present by
// the time we get here.
export default async function HomePage() {
  const supabase = await createClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, title, description, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    // Detect the classic "migration never run" error. PostgREST raises
    // PGRST202 and its message mentions "schema cache" — covering both
    // lets us survive future phrasing changes.
    const isMissingSchema =
      error.code === "PGRST202" ||
      /schema cache|public\.(projects|clips|messages)/i.test(error.message);

    if (isMissingSchema) {
      return (
        <main className="min-h-screen flex flex-col px-6 py-10 max-w-2xl mx-auto w-full">
          <header className="flex flex-col items-center gap-3 text-center mb-8">
            <Logomark size={72} priority />
            <h1 className="font-display text-3xl text-ink">
              <span className="highlight">one more step</span>
            </h1>
            <p className="font-hand text-lg text-ink-soft max-w-md">
              Supabase is connected, but the tables haven&rsquo;t been created
              yet. Run the migration once and reload.
            </p>
          </header>

          <div className="rule-ink mb-8" />

          <section className="bg-paper-deep p-5 space-y-3">
            <h2 className="font-hand text-xl text-sepia-deep">
              run this in the Supabase SQL editor
            </h2>
            <ol className="list-decimal list-inside space-y-2 font-body text-ink leading-relaxed">
              <li>
                Open{" "}
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline hover:text-ink-soft"
                >
                  supabase.com/dashboard
                </a>{" "}
                → your project → SQL Editor → New query.
              </li>
              <li>
                Paste the contents of{" "}
                <code className="font-mono text-sm">
                  supabase/migrations/0001_init.sql
                </code>{" "}
                from the Nysus repo and hit Run.
              </li>
              <li>
                Come back here and reload — the projects list will appear.
              </li>
            </ol>
            <p className="font-body text-xs text-ink-soft/70 leading-relaxed pt-2">
              This creates <code>projects</code>, <code>clips</code>, and{" "}
              <code>messages</code> tables with row-level security keyed to
              your user.
            </p>
          </section>

          <div className="mt-6 flex items-center gap-3 flex-wrap">
            <form action="/">
              <button
                type="submit"
                className="px-4 h-11 bg-ink text-paper font-body tracking-wide hover:bg-ink-soft transition-colors"
              >
                Reload &rarr;
              </button>
            </form>
            <a
              href="/setup"
              className="px-4 h-11 inline-flex items-center bg-paper border border-ink text-ink font-body tracking-wide hover:bg-paper-deep transition-colors"
            >
              Full env checklist
            </a>
          </div>

          <p className="mt-8 font-mono text-[11px] text-ink-soft/60 break-words">
            {error.message}
          </p>
        </main>
      );
    }

    return (
      <main className="min-h-screen flex flex-col items-center justify-center px-6 py-16">
        <div className="max-w-md text-center space-y-4">
          <p className="font-hand text-2xl text-red-grease">
            Could not load projects.
          </p>
          <p className="font-body text-ink-soft text-sm">{error.message}</p>
          <form action="/">
            <button
              type="submit"
              className="px-4 h-11 bg-ink text-paper font-body tracking-wide hover:bg-ink-soft transition-colors"
            >
              Reload &rarr;
            </button>
          </form>
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
          <Logomark size={36} />
          <span className="font-display text-2xl tracking-[0.2em] text-ink">
            NYSUS
          </span>
        </Link>
        <div className="flex items-center gap-4">
          <UsageStrip />
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              aria-label="Sign out"
              className="px-2 py-2 min-h-11 font-body text-[11px] uppercase tracking-widest text-ink-soft/70 hover:text-ink transition-colors"
            >
              sign out
            </button>
          </form>
        </div>
      </header>

      <div className="flex items-end justify-between mb-6">
        <h1 className="font-display text-4xl text-ink">
          <span className="highlight">projects</span>
        </h1>
        <Link
          href="/projects/new"
          className="-mr-2 px-3 py-2 min-h-11 inline-flex items-center font-hand text-xl text-sepia-deep hover:text-ink transition-colors"
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
                <form action={deleteProject} className="shrink-0">
                  <input type="hidden" name="id" value={p.id} />
                  <button
                    type="submit"
                    aria-label={`Delete ${p.title}`}
                    className="w-11 h-11 inline-flex items-center justify-center text-red-grease hover:text-red-grease/70 font-display text-2xl leading-none opacity-40 sm:opacity-0 group-hover:opacity-100 transition-opacity"
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
        <div className="flex flex-col items-center text-center gap-5 py-8">
          <div className="relative w-full max-w-sm animate-paper-float">
            <Image
              src="/illustrations/empty-notebook.png"
              alt="An open notebook waiting to be filled"
              width={600}
              height={400}
              priority
              sizes="(max-width: 480px) 90vw, 400px"
              className="w-full h-auto mix-blend-multiply"
            />
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
