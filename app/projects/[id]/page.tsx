import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Workspace } from "./workspace";
import type { ChatMessage } from "./chat/message";
import type { TimelineClip } from "./timeline/types";
import type { CharacterSheet, AestheticBible } from "@/lib/supabase/types";

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
        "id, project_id, order_index, prompt, shot_metadata, seed_image_url, seed_source, video_url, last_frame_url, sampled_frames_urls, status, replicate_prediction_id, error_message, still_image_url, still_prompt, still_status, still_replicate_prediction_id, narration, created_at",
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

  const sheet = (project.character_sheet ?? {}) as CharacterSheet;
  const bible = (project.aesthetic_bible ?? {}) as AestheticBible;

  return (
    <Workspace
      projectId={project.id}
      projectTitle={project.title}
      projectDescription={project.description}
      initialMessages={priorMessages}
      initialClips={initialClips}
      updatedAt={project.updated_at}
      characterSheet={sheet}
      aestheticBible={bible}
    />
  );
}
