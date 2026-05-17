import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { StitchView } from "./stitch-view";
import { SectionNav } from "../section-nav";
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
      "id, project_id, order_index, prompt, shot_metadata, seed_image_url, seed_source, video_url, last_frame_url, sampled_frames_urls, status, replicate_prediction_id, error_message, still_image_url, still_prompt, still_status, still_replicate_prediction_id, narration, narration_audio_url, created_at",
    )
    .eq("project_id", project.id)
    .order("order_index", { ascending: true });

  const clips: TimelineClip[] = (clipsRaw ?? []) as TimelineClip[];

  const rendered = clips.filter((c) => c.status === "complete").length;
  const inFlight = clips.filter(
    (c) => c.status === "queued" || c.status === "processing",
  ).length;

  return (
    <main className="min-h-screen flex flex-col px-4 sm:px-6 py-6 max-w-3xl mx-auto w-full pb-[calc(env(safe-area-inset-bottom)+6rem)] md:pb-8">
      <SectionNav
        projectId={project.id}
        projectTitle={project.title}
        active="stitch"
        counts={{ scenes: clips.length, rendered, inFlight }}
      />

      <h1 className="font-display text-3xl sm:text-4xl text-ink mb-1 mt-2">
        <span className="highlight">stitch</span>
      </h1>
      <p className="font-hand text-lg text-ink-soft mb-6">
        {project.title} &mdash; the final reel
      </p>

      <div className="rule-ink mb-6" />

      <StitchView
        clips={clips}
        projectId={project.id}
        projectTitle={project.title}
      />
    </main>
  );
}
