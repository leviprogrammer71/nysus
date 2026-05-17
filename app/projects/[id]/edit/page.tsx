import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProjectEditForm } from "./edit-form";
import { SectionNav } from "../section-nav";

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
    <main className="min-h-screen flex flex-col px-4 sm:px-6 py-6 max-w-3xl mx-auto w-full pb-[calc(env(safe-area-inset-bottom)+6rem)] md:pb-8">
      <SectionNav
        projectId={project.id}
        projectTitle={project.title}
        active="bible"
      />

      <h1 className="font-display text-3xl sm:text-4xl text-ink mb-1 mt-2">
        <span className="highlight">the bible</span>
      </h1>
      <p className="font-hand text-lg text-ink-soft mb-6">
        cast, aesthetic, voice &mdash; the notes injected into every shot.
      </p>

      <div className="rule-ink mb-6" />

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
