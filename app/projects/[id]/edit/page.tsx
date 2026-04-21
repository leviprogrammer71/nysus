import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectEditForm } from "./edit-form";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditProjectPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title, description, character_sheet, aesthetic_bible")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  return (
    <main className="min-h-screen flex flex-col px-4 sm:px-6 py-8 max-w-3xl mx-auto w-full">
      <header className="flex items-center justify-between mb-8">
        <Link
          href={`/projects/${project.id}`}
          className="font-hand text-lg text-sepia-deep hover:text-ink transition-colors"
        >
          &larr; back to workspace
        </Link>
      </header>

      <h1 className="font-display text-4xl text-ink mb-1">
        <span className="highlight">edit</span> project
      </h1>
      <p className="font-hand text-lg text-ink-soft mb-8">
        title, description, character sheet, and aesthetic bible &mdash; the
        notes injected into every shot prompt.
      </p>

      <div className="rule-ink mb-8" />

      <ProjectEditForm
        projectId={project.id}
        initialTitle={project.title}
        initialDescription={project.description ?? ""}
        initialCharacterSheet={project.character_sheet}
        initialAestheticBible={project.aesthetic_bible}
      />
    </main>
  );
}
