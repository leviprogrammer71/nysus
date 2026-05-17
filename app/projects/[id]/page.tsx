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

  // Defense in depth: if a migration column hasn't been applied to
  // production yet (e.g. current_stage from 0010_storyflow), the
  // narrow select would throw 42703 (undefined_column) and crash the
  // Server Component. Try the full select first; on 42703, fall back
  // to a minimal select that's always safe, and treat the missing
  // columns as defaults. This keeps the workspace renderable even
  // when the database is one migration behind.
  type ProjectRow = {
    id: string;
    title: string;
    description: string | null;
    character_sheet: CharacterSheet;
    aesthetic_bible: AestheticBible;
    current_stage: string | null;
    updated_at: string;
  };

  const fullSelect = await supabase
    .from("projects")
    .select(
      "id, title, description, character_sheet, aesthetic_bible, current_stage, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  let project: ProjectRow | null;
  if (fullSelect.error) {
    if ((fullSelect.error as { code?: string }).code === "42703") {
      // Migration 0010 not yet applied — drop current_stage and keep
      // rendering. Page falls back to "concept" as the default stage.
      const fallback = await supabase
        .from("projects")
        .select("id, title, description, character_sheet, aesthetic_bible, updated_at")
        .eq("id", id)
        .maybeSingle();
      if (fallback.error) throw fallback.error;
      if (!fallback.data) notFound();
      const row = fallback.data as Omit<ProjectRow, "current_stage">;
      project = { ...row, current_stage: null };
    } else {
      throw fullSelect.error;
    }
  } else if (!fullSelect.data) {
    notFound();
    project = null;
  } else {
    project = fullSelect.data as unknown as ProjectRow;
  }
  if (!project) notFound();

  // Mae's no longer a chat — she's an execution board fed directly
  // by the clips table. We load BOTH Ari sub-modes here:
  //   concept (Oracle) — pre-Liturgy ideation
  //   script  (Liturgy) — scene drafting; treats legacy "ari" rows as
  //                        the same ledger so historical chats stay
  //                        readable after the StoryFlow split.
  // Each select is wrapped so a missing post-0010 column degrades to
  // an empty result instead of crashing the whole Server Component.
  async function selectClips() {
    const full = await supabase
      .from("clips")
      .select(
        "id, project_id, order_index, prompt, shot_metadata, seed_image_url, seed_source, video_url, last_frame_url, sampled_frames_urls, status, replicate_prediction_id, error_message, bible_overrides, still_image_url, still_prompt, still_status, still_replicate_prediction_id, narration, created_at",
      )
      .eq("project_id", project!.id)
      .order("order_index", { ascending: true });
    if (full.error && (full.error as { code?: string }).code === "42703") {
      // bible_overrides missing — retry without it.
      const fallback = await supabase
        .from("clips")
        .select(
          "id, project_id, order_index, prompt, shot_metadata, seed_image_url, seed_source, video_url, last_frame_url, sampled_frames_urls, status, replicate_prediction_id, error_message, still_image_url, still_prompt, still_status, still_replicate_prediction_id, narration, created_at",
        )
        .eq("project_id", project!.id)
        .order("order_index", { ascending: true });
      return { data: fallback.data };
    }
    return { data: full.data };
  }

  const [
    { data: conceptMessagesRaw },
    { data: scriptMessagesRaw },
    { data: clipsRaw },
  ] = await Promise.all([
    supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("project_id", project.id)
      .eq("chat_mode", "concept")
      .order("created_at", { ascending: true })
      .limit(200),
    supabase
      .from("messages")
      .select("id, role, content, created_at")
      .eq("project_id", project.id)
      .in("chat_mode", ["script", "ari"])
      .order("created_at", { ascending: true })
      .limit(200),
    selectClips(),
  ]);

  const toMessages = (
    rows:
      | Array<{
          id: string;
          role: string;
          content: string;
          created_at: string;
        }>
      | null,
  ): ChatMessage[] =>
    (rows ?? [])
      .filter(
        (m): m is {
          id: string;
          role: "user" | "assistant";
          content: string;
          created_at: string;
        } => m.role === "user" || m.role === "assistant",
      )
      .map((m) => ({ id: m.id, role: m.role, content: m.content }));

  const initialConceptMessages = toMessages(conceptMessagesRaw);
  const initialScriptMessages = toMessages(scriptMessagesRaw);
  // Legacy prop kept on Workspace — points at the Liturgy ledger so
  // older callers keep rendering whatever they used to render.
  const initialAriMessages: ChatMessage[] = initialScriptMessages;

  const initialClips: TimelineClip[] = (clipsRaw ?? []) as TimelineClip[];

  const sheet = (project.character_sheet ?? {}) as CharacterSheet;
  const bible = (project.aesthetic_bible ?? {}) as AestheticBible;

  return (
    <Workspace
      projectId={project.id}
      projectTitle={project.title}
      projectDescription={project.description}
      initialAriMessages={initialAriMessages}
      initialConceptMessages={initialConceptMessages}
      initialScriptMessages={initialScriptMessages}
      initialClips={initialClips}
      updatedAt={project.updated_at}
      characterSheet={sheet}
      aestheticBible={bible}
      initialStage={(project.current_stage ?? "concept") as
        | "concept"
        | "script"
        | "scenes"
        | "image"
        | "animate"
        | "stitch"}
    />
  );
}
