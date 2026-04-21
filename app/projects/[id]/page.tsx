import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Workspace } from "./workspace";
import type { ChatMessage } from "./chat/message";
import type { TimelineClip } from "./timeline/types";

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

  const [{ data: priorMessagesRaw }, { data: clipsRaw }] = await Promise.all([
    supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("project_id", project.id)
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("clips")
      .select(
        "id, project_id, order_index, prompt, shot_metadata, seed_image_url, seed_source, video_url, last_frame_url, sampled_frames_urls, status, replicate_prediction_id, error_message, created_at",
      )
      .eq("project_id", project.id)
      .order("order_index", { ascending: true }),
  ]);

  const priorMessages: ChatMessage[] = (priorMessagesRaw ?? [])
    .filter(
      (m): m is {
        id: string;
        role: "user" | "assistant";
        content: string;
        created_at: string;
      } => m.role === "user" || m.role === "assistant",
    )
    .map((m) => ({ id: m.id, role: m.role, content: m.content }));

  const initialClips: TimelineClip[] = (clipsRaw ?? []) as TimelineClip[];

  const chars = (project.character_sheet?.characters ?? []) as Array<{
    name?: string;
  }>;
  const bible = project.aesthetic_bible ?? {};
  const visualStyle =
    typeof bible === "object" && bible !== null && "visual_style" in bible
      ? ((bible as Record<string, unknown>).visual_style as string | undefined) ?? null
      : null;

  return (
    <Workspace
      projectId={project.id}
      projectTitle={project.title}
      projectDescription={project.description}
      initialMessages={priorMessages}
      initialClips={initialClips}
      updatedAt={project.updated_at}
      characterNames={chars
        .map((c, i) => c.name ?? `Character ${i + 1}`)
        .filter(Boolean)}
      visualStyle={visualStyle}
    />
  );
}
