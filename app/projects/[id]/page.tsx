import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ChatPanel } from "./chat/chat-panel";
import type { ChatMessage } from "./chat/message";

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

  if (error) throw error;
  if (!project) notFound();

  const { data: priorMessagesRaw } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true })
    .limit(200);

  const priorMessages: ChatMessage[] = (priorMessagesRaw ?? [])
    .filter(
      (m): m is { id: string; role: "user" | "assistant"; content: string; created_at: string } =>
        m.role === "user" || m.role === "assistant",
    )
    .map((m) => ({ id: m.id, role: m.role, content: m.content }));

  const chars = (project.character_sheet?.characters ?? []) as Array<{
    name?: string;
  }>;
  const bible = project.aesthetic_bible ?? {};
  const visualStyle =
    typeof bible === "object" && bible !== null && "visual_style" in bible
      ? (bible as Record<string, unknown>).visual_style
      : undefined;

  return (
    <main className="min-h-screen flex flex-col px-4 sm:px-6 py-8 max-w-3xl mx-auto w-full">
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

      <h1 className="font-display text-4xl sm:text-5xl text-ink leading-tight mb-1">
        {project.title}
      </h1>
      {project.description ? (
        <p className="font-body text-ink-soft leading-relaxed max-w-xl">
          {project.description}
        </p>
      ) : null}

      <div className="rule-ink mt-6 mb-6" />

      {/* Timeline strip — real clip timeline lands in Phase 4 */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-hand text-lg text-sepia-deep">timeline</h2>
          <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/50">
            phase 4
          </span>
        </div>
        <div className="bg-paper-deep px-6 py-8 flex items-center justify-center text-center">
          <p className="font-hand text-base text-ink-soft/70 max-w-sm">
            clips will appear here as you generate them
          </p>
        </div>
      </section>

      {/* Chat — Phase 3, live */}
      <section className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-hand text-lg text-sepia-deep">chat</h2>
          <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/50">
            phase 3 · live
          </span>
        </div>
        <ChatPanel projectId={project.id} initialMessages={priorMessages} />
      </section>

      <section className="mb-6">
        <h2 className="font-hand text-lg text-sepia-deep mb-2">
          character sheet
        </h2>
        <div className="bg-paper-deep p-5">
          {chars.length > 0 ? (
            <ul className="flex flex-wrap gap-x-5 gap-y-1">
              {chars.map((c, i) => (
                <li
                  key={i}
                  className="font-display text-lg text-ink"
                >
                  {c.name ?? `Character ${i + 1}`}
                </li>
              ))}
            </ul>
          ) : (
            <p className="font-body text-sm text-ink-soft">
              Not yet populated.
            </p>
          )}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="font-hand text-lg text-sepia-deep mb-2">
          aesthetic bible
        </h2>
        <div className="bg-paper-deep p-5">
          {typeof visualStyle === "string" ? (
            <p className="font-body text-ink leading-relaxed">{visualStyle}</p>
          ) : (
            <p className="font-body text-sm text-ink-soft">
              Not yet populated.
            </p>
          )}
        </div>
      </section>

      <footer className="mt-2 font-body text-[11px] text-ink-soft/50">
        last updated {new Date(project.updated_at).toLocaleString()}
      </footer>
    </main>
  );
}
