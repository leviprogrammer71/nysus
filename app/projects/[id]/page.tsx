import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjectPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, title, description, character_sheet, aesthetic_bible, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw error;
  }
  if (!project) {
    notFound();
  }

  const chars = (project.character_sheet?.characters ?? []) as Array<{
    name?: string;
  }>;
  const bible = project.aesthetic_bible ?? {};
  const visualStyle =
    typeof bible === "object" && bible !== null && "visual_style" in bible
      ? (bible as Record<string, unknown>).visual_style
      : undefined;

  return (
    <main className="min-h-screen flex flex-col px-6 py-10 max-w-3xl mx-auto w-full">
      <header className="flex items-center justify-between mb-8">
        <Link
          href="/"
          className="font-hand text-lg text-sepia-deep hover:text-ink transition-colors"
        >
          &larr; all projects
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

      <h1 className="font-display text-5xl text-ink leading-tight mb-2">
        {project.title}
      </h1>
      {project.description ? (
        <p className="font-body text-ink-soft leading-relaxed max-w-xl">
          {project.description}
        </p>
      ) : null}

      <div className="rule-ink mt-8 mb-8" />

      {/* Timeline strip — real horizontal-scroll clip timeline lands in Phase 4 */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-hand text-xl text-sepia-deep">timeline</h2>
          <span className="font-body text-xs text-ink-soft/50 uppercase tracking-widest">
            phase 4
          </span>
        </div>
        <div className="bg-paper-deep p-10 flex items-center justify-center text-center">
          <p className="font-hand text-lg text-ink-soft/70 max-w-sm">
            clips will appear here as you generate them
          </p>
        </div>
      </section>

      {/* Chat area — streaming Claude chat lands in Phase 3 */}
      <section className="mb-10">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-hand text-xl text-sepia-deep">chat</h2>
          <span className="font-body text-xs text-ink-soft/50 uppercase tracking-widest">
            phase 3
          </span>
        </div>
        <div className="bg-paper-deep p-10 flex items-center justify-center text-center">
          <p className="font-hand text-lg text-ink-soft/70 max-w-sm">
            chat with Claude &mdash; your creative director &mdash; here.
            scripts, critique, shot prompts.
          </p>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-hand text-xl text-sepia-deep mb-3">
          character sheet
        </h2>
        <div className="bg-paper-deep p-6">
          {chars.length > 0 ? (
            <ul className="space-y-2 font-body text-ink">
              {chars.map((c, i) => (
                <li key={i} className="font-display text-xl">
                  {c.name ?? `Character ${i + 1}`}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-sm text-ink-soft">
              Not yet populated. Edit inline in Phase 2.
            </p>
          )}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-hand text-xl text-sepia-deep mb-3">
          aesthetic bible
        </h2>
        <div className="bg-paper-deep p-6">
          {typeof visualStyle === "string" ? (
            <p className="font-body text-ink leading-relaxed">{visualStyle}</p>
          ) : (
            <p className="font-body text-sm text-ink-soft">
              Not yet populated. Edit inline in Phase 2.
            </p>
          )}
        </div>
      </section>

      <footer className="mt-6 font-body text-xs text-ink-soft/50">
        last updated {new Date(project.updated_at).toLocaleString()}
      </footer>
    </main>
  );
}
