import { NextResponse, type NextRequest } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import {
  streamChatCompletion,
  parseOpenRouterStream,
  type OpenRouterMessage,
} from "@/lib/openrouter";
import {
  DIRECTOR_SYSTEM_PROMPT,
  buildProjectContextSuffix,
} from "@/lib/prompts/director";
import { gateCritique, recordUsage } from "@/lib/budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60; // critique can take a bit with vision

type Params = { params: Promise<{ id: string }> };

/**
 * Consult the Chorus.
 *
 * Gated by CRITIQUE_MODE=on_demand (default). This endpoint is the ONLY
 * place in Nysus that sends sampled frames to Claude — never on clip
 * completion, never in the background.
 */
export async function POST(_req: NextRequest, { params }: Params) {
  if ((process.env.CRITIQUE_MODE ?? "on_demand") !== "on_demand") {
    return NextResponse.json(
      { error: "CRITIQUE_MODE must be 'on_demand'." },
      { status: 500 },
    );
  }

  const { id } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  // RLS-gated project+clip lookup.
  const { data: clip } = await supabase
    .from("clips")
    .select("id, project_id, prompt, shot_metadata, sampled_frames_urls, status")
    .eq("id", id)
    .maybeSingle();
  if (!clip) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (clip.status !== "complete") {
    return NextResponse.json(
      { error: "Clip is not complete yet." },
      { status: 400 },
    );
  }

  const { data: project } = await supabase
    .from("projects")
    .select("title, character_sheet, aesthetic_bible")
    .eq("id", clip.project_id)
    .maybeSingle();
  if (!project) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Budget gate for critique (vision + Claude).
  const admin = createServiceRoleClient();
  const gate = await gateCritique(admin);
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason, code: gate.code },
      { status: 429 },
    );
  }

  // Sign each sampled frame URL for Claude's vision call. Sampled
  // frame paths live under {project}/{clip}/sample_{0..2}.jpg.
  const frameUrls: string[] = [];
  for (let i = 0; i < 3; i++) {
    const path = `${clip.project_id}/${clip.id}/sample_${i}.jpg`;
    const { data } = await admin.storage
      .from("clips")
      .createSignedUrl(path, 60 * 30);
    if (data?.signedUrl) frameUrls.push(data.signedUrl);
  }

  if (frameUrls.length === 0) {
    return NextResponse.json(
      {
        error:
          "No sampled frames available. Open the clip once so the client can extract frames.",
      },
      { status: 409 },
    );
  }

  const contextSuffix = buildProjectContextSuffix({
    title: project.title,
    character_sheet: project.character_sheet,
    aesthetic_bible: project.aesthetic_bible,
  });

  const userMessage: OpenRouterMessage = {
    role: "user",
    content: [
      {
        type: "text",
        text:
          `Critique this generated clip. Prompt used was:\n\n${clip.prompt}\n\n` +
          `Flag composition, lighting, continuity, character consistency, or ` +
          `deviations from the aesthetic bible. If the clip is good, say so ` +
          `plainly. Suggest concrete prompt edits if regeneration is warranted.\n` +
          contextSuffix,
      },
      ...frameUrls.map((url) => ({
        type: "image_url" as const,
        image_url: { url },
      })),
    ],
  };

  const messages: OpenRouterMessage[] = [
    { role: "system", content: DIRECTOR_SYSTEM_PROMPT },
    userMessage,
  ];

  // Collect the full response before returning so the UI can show a
  // single "chorus says" block instead of streaming. Critiques are
  // short enough that buffering is fine.
  try {
    const stream = await streamChatCompletion({
      messages,
      temperature: 0.5,
      max_tokens: 2000,
    });
    let out = "";
    for await (const delta of parseOpenRouterStream(stream)) {
      out += delta;
    }

    // Store the critique as an assistant message scoped to the project
    // so it shows up in the chat history too. (User can see "the chorus
    // said…" in their transcript.)
    await admin.from("messages").insert({
      project_id: clip.project_id,
      role: "assistant",
      content: `*Consulted the chorus on shot #${clip.shot_metadata?.shot_number ?? ""}*\n\n${out}`,
      attached_frame_urls: frameUrls,
    });

    void recordUsage({
      admin,
      userId: user.id,
      projectId: clip.project_id,
      provider: "openrouter",
      action: "critique",
      metadata: {
        clip_id: clip.id,
        frame_count: frameUrls.length,
      },
    });

    return NextResponse.json({ critique: out });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
