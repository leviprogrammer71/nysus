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
    <main className="min-h-screen flex flex-col px-4 sm:px-6 lg:px-12 py-6 max-w-[1100px] mx-auto w-full pb-[calc(env(safe-area-inset-bottom)+6rem)] md:pb-8">
      <SectionNav
        projectId={project.id}
        projectTitle={project.title}
        active="bible"
      />

      <header className="flex flex-col gap-3 mt-2 mb-6">
        <div className="eyebrow">The bible · the film's own knowing</div>
        <h1 className="font-display text-[44px] sm:text-[56px] leading-[1] text-ink">
          Everything the film
          <br />
          <span className="italic">already knows about itself</span>.
        </h1>
        <p className="font-hand text-[20px] text-[color:var(--color-sepia-deep)] max-w-[60ch] leading-snug">
          cast, aesthetic, voice — every page below is injected into every
          shot prompt. edit it like a poem.
        </p>
      </header>

      <div className="sepia-rule mb-8" />

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
