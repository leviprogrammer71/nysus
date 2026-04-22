import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { StoryboardGrid } from "./storyboard-grid";
import type { TimelineClip } from "../timeline/types";

type PageProps = {
  params: Promise<{ id: string }>;
};

/**
 * /projects/[id]/storyboard
 *
 * A 9:16 grid view of every clip's still. Approve before animating so
 * a bad still never burns video render credits. Stills are cheap,
 * videos are not.
 */
export default async function StoryboardPage({ params }: PageProps) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, title")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!project) notFound();

  const { data: clipsRaw } = await supabase
    .from("clips")
    .select(
      "id, project_id, order_index, prompt, shot_metadata, seed_image_url, seed_source, video_url, last_frame_url, sampled_frames_urls, status, replicate_prediction_id, error_message, still_image_url, still_prompt, still_status, still_replicate_prediction_id, still_approved, narration, narration_audio_url, captions_srt, created_at",
    )
    .eq("project_id", project.id)
    .order("order_index", { ascending: true });

  const clips: TimelineClip[] = (clipsRaw ?? []) as TimelineClip[];

  return (
    <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 sm:px-6">
      <nav className="flex items-center justify-between gap-3">
        <Link
          href={`/projects/${project.id}`}
          className="font-body text-xs uppercase tracking-widest text-ink-soft/70 hover:text-ink"
        >
          ← Back to project
        </Link>
        <span className="font-display text-xs uppercase tracking-widest text-ink-soft/70">
          Storyboard
        </span>
      </nav>

      <header className="mt-4">
        <h1 className="font-display text-2xl text-ink sm:text-3xl">
          {project.title}
        </h1>
        <p className="mt-1 font-body text-sm text-ink-soft/70">
          Review and approve each still before animating. Approved stills can
          be sent to Seedance/Kling with one tap.
        </p>
      </header>

      <StoryboardGrid projectId={project.id} initialClips={clips} />
    </main>
  );
}
