import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  project_id: z.string().uuid(),
  message: z.string().trim().min(1).max(8000),
});

// How many of the most-recent prior messages to send to Claude. Keep
// this bounded so a long session doesn't blow up the context window;
// Phase 6+ may introduce summarization.
const HISTORY_LIMIT = 40;

export async function POST(request: NextRequest) {
  // --- Auth gate (belt + suspenders on top of middleware) ------------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  // --- Parse payload -------------------------------------------------
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid payload" },
      { status: 400 },
    );
  }

  // --- Load project (RLS enforces ownership) -------------------------
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id, title, character_sheet, aesthetic_bible")
    .eq("id", body.project_id)
    .maybeSingle();

  if (projectError) {
    return NextResponse.json({ error: projectError.message }, { status: 500 });
  }
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  // --- Load recent history -------------------------------------------
  const { data: priorMessages, error: messagesError } = await supabase
    .from("messages")
    .select("role, content")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  // --- Persist user message before we call Claude --------------------
  const { data: userMessageRow, error: insertUserError } = await supabase
    .from("messages")
    .insert({
      project_id: project.id,
      role: "user",
      content: body.message,
    })
    .select("id, created_at")
    .single();

  if (insertUserError || !userMessageRow) {
    return NextResponse.json(
      { error: insertUserError?.message ?? "Failed to persist message" },
      { status: 500 },
    );
  }

  // --- Build OpenRouter payload --------------------------------------
  const projectContextSuffix = buildProjectContextSuffix({
    title: project.title,
    character_sheet: project.character_sheet,
    aesthetic_bible: project.aesthetic_bible,
  });

  // The brief mandates: PROJECT CONTEXT appears at the bottom of every
  // user message. We store raw user text in the DB and inject fresh
  // context on every send, so updates to the character sheet or
  // aesthetic bible propagate to the full transcript immediately.
  const messages: OpenRouterMessage[] = [
    { role: "system", content: DIRECTOR_SYSTEM_PROMPT },
    ...(priorMessages ?? [])
      .filter(
        (m): m is { role: "user" | "assistant"; content: string } =>
          m.role === "user" || m.role === "assistant",
      )
      .map((m) => ({
        role: m.role,
        content:
          m.role === "user" ? `${m.content}\n${projectContextSuffix}` : m.content,
      })),
    {
      role: "user",
      content: `${body.message}\n${projectContextSuffix}`,
    },
  ];

  // --- Kick off the stream -------------------------------------------
  let upstream: ReadableStream<Uint8Array>;
  try {
    upstream = await streamChatCompletion({ messages });
  } catch (err) {
    // Roll back — don't leave an orphan user message with no assistant reply.
    // (Commented: leaving the user message in place is arguably correct, so
    // the user can retry without re-typing. Keep it; they'll see the error
    // in the toast and send again.)
    const message = err instanceof Error ? err.message : "Upstream error";
    return NextResponse.json({ error: message }, { status: 502 });
  }

  // --- Pipe text deltas to the client, accumulate for DB insert ------
  let accumulated = "";

  const clientStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      try {
        for await (const delta of parseOpenRouterStream(upstream)) {
          accumulated += delta;
          controller.enqueue(encoder.encode(delta));
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        controller.enqueue(encoder.encode(`\n\n[stream error: ${msg}]`));
      } finally {
        controller.close();

        // Persist the assistant reply (fire-and-forget; controller
        // already closed so the client has the text even if this
        // write fails).
        if (accumulated.trim().length > 0) {
          void supabase
            .from("messages")
            .insert({
              project_id: project.id,
              role: "assistant",
              content: accumulated,
            })
            .then(({ error }) => {
              if (error) {
                console.error("Failed to persist assistant message:", error.message);
              }
            });
        }
      }
    },
  });

  return new Response(clientStream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no", // defeat proxy buffering
      "X-User-Message-Id": userMessageRow.id,
    },
  });
}
