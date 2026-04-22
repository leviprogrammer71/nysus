import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StitchView } from "./stitch-view";
import type { TimelineClip } from "../timeline/types";

type PageProps = { params: Promise<{ id: string }> };

export default async function StitchPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const { data: clipsRaw } = await supabase
    .from("clips")
    .select(
      "id, project_id, order_index, prompt, shot_metadata, seed_image_url, seed_source, video_url, last_frame_url, sampled_frames_urls, status, replicate_prediction_id, error_message, created_at",
    )
    .eq("project_id", project.id)
    .order("order_index", { ascending: true });

  const clips: TimelineClip[] = (clipsRaw ?? []) as TimelineClip[];

  return (
    <main className="min-h-screen flex flex-col px-4 sm:px-6 py-8 max-w-3xl mx-auto w-full">
      <header className="flex items-center justify-between mb-8">
        <Link
          href={`/projects/${project.id}`}
          className="-ml-2 px-2 py-2 font-hand text-lg text-sepia-deep hover:text-ink transition-colors inline-flex items-center min-h-11"
        >
          &larr; workspace
        </Link>
      </header>

      <h1 className="font-display text-4xl text-ink mb-1">
        <span className="highlight">stitch</span>
      </h1>
      <p className="font-hand text-xl text-ink-soft mb-8">
        {project.title} &mdash; the final reel
      </p>

      <div className="rule-ink mb-8" />

      <StitchView clips={clips} projectTitle={project.title} />
    </main>
  );
}
