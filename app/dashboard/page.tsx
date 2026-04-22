import Link from "next/link";
import Image from "next/image";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { deleteProject } from "@/app/actions";
import { Logomark } from "@/app/components/logomark";
import { UsageStrip } from "@/app/components/usage-strip";
import { ProjectCard } from "@/app/components/project-card";
import { ShowcaseStrip } from "@/app/components/showcase-strip";
import { loadShowcase } from "@/lib/showcase";

// Home = dashboard. Middleware guarantees `user` is present by
// the time we get here.
export default async function HomePage() {
  const supabase = await createClient();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, title, description, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
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
                Come back here and reload — the dashboard will appear.
              </li>
            </ol>
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
        </div>
      </main>
    );
  }

  const hasProjects = projects && projects.length > 0;

  // --- Dashboard stats + thumbnails --------------------------------------
  //
  // Fetch aggregate counts and per-project "latest still" thumbnails in
  // parallel so the dashboard lands fast. Use the service role for the
  // count queries (so we can use head:true without a fetch round-trip
  // per row). RLS is redundant here — the user already owns everything
  // the project list returned.
  const admin = createServiceRoleClient();
  const [videoCountR, stillCountR, clipsForThumbsR, showcase] = await Promise.all([
    admin
      .from("clips")
      .select("*", { count: "exact", head: true })
      .eq("status", "complete"),
    admin
      .from("clips")
      .select("*", { count: "exact", head: true })
      .eq("still_status", "complete"),
    admin
      .from("clips")
      .select("project_id, still_image_url, video_url, status, still_status, order_index, created_at")
      .order("created_at", { ascending: false })
      .limit(300),
    loadShowcase(),
  ]);

  const totalProjects = projects?.length ?? 0;
  const totalVideos = videoCountR.count ?? 0;
  const totalStills = stillCountR.count ?? 0;

  // Pick the freshest still (falling back to video's mirrored frame)
  // per project for the card thumbnails.
  const thumbByProject: Record<string, string | null> = {};
  for (const c of clipsForThumbsR.data ?? []) {
    if (!c.project_id) continue;
    if (thumbByProject[c.project_id]) continue;
    // Prefer a complete still, then any completed video's implicit
    // last-frame URL we already cache, then any still in progress.
    if (c.still_status === "complete" && c.still_image_url) {
      thumbByProject[c.project_id] = c.still_image_url;
      continue;
    }
  }

  return (
    <main className="min-h-screen flex flex-col px-6 py-8 max-w-3xl mx-auto w-full">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <Link
          href="/"
          className="flex items-center gap-3"
          aria-label="Nysus home"
        >
          <Logomark size={36} animated />
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

      {/* Hero */}
      <section className="mb-8 pt-2 pb-6 border-b border-ink/10">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6">
          <div className="shrink-0 animate-paper-breath">
            <Logomark size={120} animated />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-4xl sm:text-5xl text-ink leading-tight">
              <span className="highlight">dionysian</span>
              <br />
              cinema, by chat.
            </h1>
            <p className="font-hand text-lg text-ink-soft mt-3 leading-snug">
              Dio drafts the scenes, you tap generate. Every still and
              every clip lives in the same notebook.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <Link
                href="/projects/new"
                className="px-5 py-2.5 bg-ink text-paper font-body tracking-wide hover:bg-ink-soft transition-colors"
              >
                New project &rarr;
              </Link>
              {hasProjects ? (
                <Link
                  href={`/projects/${projects[0].id}`}
                  className="px-4 py-2.5 bg-paper border border-ink text-ink font-body tracking-wide hover:bg-paper-deep transition-colors"
                >
                  continue {projects[0].title.slice(0, 28)}
                  {projects[0].title.length > 28 ? "…" : ""} &rarr;
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      {/* Stats strip */}
      <section className="mb-8 grid grid-cols-3 gap-2">
        <StatCard label="projects" value={totalProjects} />
        <StatCard label="stills" value={totalStills} />
        <StatCard label="videos" value={totalVideos} />
      </section>

      {/* Finished films (user's own) */}
      <ShowcaseStrip reels={showcase} />

      {/* Projects */}
      <section className="mb-8">
        <div className="flex items-end justify-between mb-3">
          <h2 className="font-display text-2xl text-ink">
            <span className="highlight">projects</span>
          </h2>
          <Link
            href="/projects/new"
            className="-mr-2 px-3 py-2 min-h-11 inline-flex items-center font-hand text-lg text-sepia-deep hover:text-ink transition-colors"
          >
            + new
          </Link>
        </div>

        {hasProjects ? (
          <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {projects.map((p) => (
              <li key={p.id}>
                <ProjectCard
                  id={p.id}
                  title={p.title}
                  description={p.description ?? null}
                  updatedAt={p.updated_at}
                  thumbUrl={thumbByProject[p.id] ?? null}
                  onDeleteAction={deleteProject}
                />
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
              Start a new project to begin directing a series. Each project
              holds its own character sheet, aesthetic bible, and chain of
              clips.
            </p>
            <Link
              href="/projects/new"
              className="px-5 py-2.5 bg-ink text-paper font-body tracking-wide hover:bg-ink-soft transition-colors"
            >
              New project &rarr;
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-paper-deep border border-ink/10 px-3 py-3 flex flex-col items-start">
      <span className="font-display text-3xl text-ink leading-none">
        {value}
      </span>
      <span className="mt-1 font-body text-[10px] uppercase tracking-widest text-ink-soft/70">
        {label}
      </span>
    </div>
  );
}
