import Link from "next/link";
import Image from "next/image";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { deleteProject } from "@/app/actions";
import { AppTopbar } from "@/app/components/app-topbar";
import { UsageMeter } from "@/app/components/usage-meter";
import { ProgressPanel } from "@/app/components/progress-panel";
import { PushOptIn } from "@/app/components/push-optin";
import { ProjectCard } from "@/app/components/project-card";
import { GalleryStrip } from "@/app/components/gallery-strip";
import { loadGallery } from "@/lib/gallery";

// Dashboard = the user's workspace home. Middleware guarantees `user`
// is present by the time we get here.
export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, title, description, updated_at")
    .order("updated_at", { ascending: false });

  if (error) {
    const isMissingSchema =
      error.code === "PGRST202" ||
      /schema cache|public\.(projects|clips|messages)/i.test(error.message);
    if (isMissingSchema) return <SchemaMissing />;
    return <LoadError message={error.message} />;
  }

  const hasProjects = projects && projects.length > 0;

  // --- Dashboard stats + thumbnails --------------------------------------
  const admin = createServiceRoleClient();
  const [videoCountR, stillCountR, clipsForThumbsR, galleryEntries] =
    await Promise.all([
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
        .select(
          "project_id, still_image_url, video_url, status, still_status, order_index, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(300),
      loadGallery({ limit: 8, excludeUserId: user?.id }),
    ]);

  const totalProjects = projects?.length ?? 0;
  const totalVideos = videoCountR.count ?? 0;
  const totalStills = stillCountR.count ?? 0;

  const thumbByProject: Record<string, string | null> = {};
  for (const c of clipsForThumbsR.data ?? []) {
    if (!c.project_id) continue;
    if (thumbByProject[c.project_id]) continue;
    if (c.still_status === "complete" && c.still_image_url) {
      thumbByProject[c.project_id] = c.still_image_url;
      continue;
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-4xl flex-col px-4 py-6 sm:px-6">
      <AppTopbar email={user?.email ?? null} />

      {/* Workspace header */}
      <section className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="font-body text-[11px] uppercase tracking-[0.25em] text-ink-soft/60">
            Workspace
          </p>
          <h1 className="mt-1 font-display text-3xl text-ink sm:text-4xl">
            Your productions
          </h1>
          <p className="mt-1 font-body text-sm text-ink-soft/75">
            {hasProjects
              ? `${totalProjects} ${
                  totalProjects === 1 ? "project" : "projects"
                } · ${totalStills} stills · ${totalVideos} clips rendered`
              : "Start your first film — Nysus handles the storyboard, stills, animation and stitch."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/gallery"
            className="inline-flex h-10 items-center rounded-full border border-ink/25 bg-paper px-4 font-body text-xs uppercase tracking-widest text-ink hover:bg-paper-deep"
          >
            Browse gallery
          </Link>
          <Link
            href="/projects/new"
            className="inline-flex h-10 items-center rounded-full bg-ink px-4 font-body text-xs uppercase tracking-widest text-paper hover:bg-ink-soft"
          >
            + New project
          </Link>
        </div>
      </section>

      <PushOptIn />
      <ProgressPanel />
      <UsageMeter />

      {/* Stats strip — compact, no highlight typography */}
      <section className="mb-8 grid grid-cols-3 gap-2">
        <StatCard label="Projects" value={totalProjects} />
        <StatCard label="Stills" value={totalStills} />
        <StatCard label="Clips" value={totalVideos} />
      </section>

      {/* Gallery — other directors' work, to signal platform */}
      <GalleryStrip
        entries={galleryEntries}
        title="From other directors"
        emptyMessage="No one else has published yet — be the first."
      />

      {/* Projects */}
      <section className="mb-8">
        <div className="mb-3 flex items-end justify-between">
          <h2 className="font-display text-lg uppercase tracking-widest text-ink">
            Projects
          </h2>
          <Link
            href="/projects/new"
            className="font-body text-[11px] uppercase tracking-widest text-ink-soft/70 hover:text-ink"
          >
            + new
          </Link>
        </div>

        {hasProjects ? (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          <div className="flex flex-col items-center gap-4 py-10 text-center">
            <div className="relative w-full max-w-sm animate-paper-float opacity-90">
              <Image
                src="/illustrations/empty-notebook.png"
                alt=""
                width={600}
                height={400}
                priority
                sizes="(max-width: 480px) 90vw, 400px"
                className="mix-blend-multiply"
              />
            </div>
            <h3 className="font-display text-xl text-ink">No projects yet</h3>
            <p className="max-w-sm font-body text-sm text-ink-soft/80 leading-relaxed">
              Every project holds its own character sheet, aesthetic bible, and
              chain of clips. Start one from a sentence — the assistant drafts
              the rest.
            </p>
            <Link
              href="/projects/new"
              className="rounded-full bg-ink px-5 py-2.5 font-body text-xs uppercase tracking-widest text-paper hover:bg-ink-soft"
            >
              + New project
            </Link>
          </div>
        )}
      </section>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between rounded-lg border border-ink/10 bg-paper-deep px-3 py-3">
      <span className="font-display text-2xl leading-none text-ink">
        {value}
      </span>
      <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/70">
        {label}
      </span>
    </div>
  );
}

function SchemaMissing() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-6 py-10">
      <h1 className="font-display text-3xl text-ink">
        <span className="highlight">One more step</span>
      </h1>
      <p className="mt-2 font-body text-sm text-ink-soft">
        Supabase is connected but the schema isn&rsquo;t applied. Run the
        latest migrations in your SQL editor, then reload.
      </p>
      <ol className="mt-6 space-y-2 font-body text-sm text-ink">
        <li>
          1. Open{" "}
          <a
            href="https://supabase.com/dashboard"
            className="underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            supabase.com/dashboard
          </a>{" "}
          → SQL editor → New query.
        </li>
        <li>
          2. Paste <code>supabase/migrations/0001_init.sql</code> and run.
          Repeat for 0002 → 0005.
        </li>
        <li>3. Reload this page.</li>
      </ol>
    </main>
  );
}

function LoadError({ message }: { message: string }) {
  return (
    <main className="mx-auto flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <p className="font-display text-2xl text-red-grease">
        Could not load projects.
      </p>
      <p className="mt-2 max-w-md font-body text-sm text-ink-soft">
        {message}
      </p>
    </main>
  );
}
