import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import { gateChat, recordUsage } from "@/lib/budget";
import {
  streamChatCompletion,
  parseOpenRouterStream,
  type OpenRouterMessage,
  type OpenRouterToolCall,
} from "@/lib/openrouter";
import {
  DIRECTOR_SYSTEM_PROMPT,
  buildProjectContextSuffix,
} from "@/lib/prompts/director";
import { DIRECTOR_TOOLS, executeDirectorTool } from "@/lib/director-tools";
import { collectLabeledRefs } from "@/lib/references";
import type { CharacterSheet, AestheticBible } from "@/lib/supabase/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  project_id: z.string().uuid(),
  message: z.string().trim().min(1).max(8000),
  attached_image_urls: z.array(z.string().url()).max(8).optional(),
});

const HISTORY_LIMIT = 40;
/** Cap on how many tool-call rounds per user turn. Defensive. */
const MAX_TOOL_ROUNDS = 5;

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid payload" },
      { status: 400 },
    );
  }

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

  const { data: priorMessages, error: messagesError } = await supabase
    .from("messages")
    .select("role, content")
    .eq("project_id", project.id)
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  const admin = createServiceRoleClient();
  const gate = await gateChat(admin);
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason, code: gate.code },
      { status: 429 },
    );
  }

  const attachedImageUrls = body.attached_image_urls ?? [];
  const { data: userMessageRow, error: insertUserError } = await supabase
    .from("messages")
    .insert({
      project_id: project.id,
      role: "user",
      content: body.message,
      attached_frame_urls: attachedImageUrls,
    })
    .select("id, created_at")
    .single();

  if (insertUserError || !userMessageRow) {
    return NextResponse.json(
      { error: insertUserError?.message ?? "Failed to persist message" },
      { status: 500 },
    );
  }

  // Re-read the project's sheet/bible fresh on each turn so tool
  // edits inside a single user turn are reflected in the context.
  async function freshProjectContext(): Promise<{
    suffix: string;
    refParts: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;
  }> {
    const { data } = await admin
      .from("projects")
      .select("title, character_sheet, aesthetic_bible")
      .eq("id", project!.id)
      .single();

    const sheet = (data?.character_sheet ?? project!.character_sheet ?? {}) as CharacterSheet;
    const bible = (data?.aesthetic_bible ?? project!.aesthetic_bible ?? {}) as AestheticBible;

    const suffix = buildProjectContextSuffix({
      title: data?.title ?? project!.title,
      character_sheet: sheet,
      aesthetic_bible: bible,
    });

    // Collect + sign every reference image (per character, per bible).
    // Each gets a short-lived URL and a labeled text anchor so Claude
    // knows what it's looking at.
    const labeled = collectLabeledRefs(sheet, bible);
    const refParts: Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    > = [];
    if (labeled.length > 0) {
      refParts.push({
        type: "text",
        text: "\n\nREFERENCE IMAGES (carry forward into your draft):\n",
      });
      for (const r of labeled) {
        const { data: signed } = await admin.storage
          .from("clips")
          .createSignedUrl(r.path, 60 * 30);
        if (!signed?.signedUrl) continue;
        refParts.push({ type: "text", text: `\n— ${r.label}:` });
        refParts.push({
          type: "image_url",
          image_url: { url: signed.signedUrl },
        });
      }
    }

    return { suffix, refParts };
  }

  const { suffix: initialContextSuffix, refParts: initialRefParts } =
    await freshProjectContext();

  // Build the current user turn. Multipart when we have either chat
  // attachments OR persistent reference images in sheet/bible.
  const hasMultipart =
    attachedImageUrls.length > 0 || initialRefParts.length > 0;

  const currentUserContent: OpenRouterMessage = hasMultipart
    ? {
        role: "user",
        content: [
          { type: "text", text: `${body.message}\n${initialContextSuffix}` },
          // Persistent reference images from character_sheet + bible
          ...initialRefParts,
          // Per-message attachments (paste / drag / picker)
          ...attachedImageUrls.map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
        ],
      }
    : {
        role: "user",
        content: `${body.message}\n${initialContextSuffix}`,
      };

  const baseHistory: OpenRouterMessage[] = [
    { role: "system", content: DIRECTOR_SYSTEM_PROMPT },
    ...(priorMessages ?? [])
      .filter(
        (m): m is { role: "user" | "assistant"; content: string } =>
          m.role === "user" || m.role === "assistant",
      )
      .map<OpenRouterMessage>((m) =>
        m.role === "user"
          ? {
              role: "user",
              content: `${m.content}\n${initialContextSuffix}`,
            }
          : { role: "assistant", content: m.content },
      ),
    currentUserContent,
  ];

  // messages array that accumulates across tool-call rounds
  const messages: OpenRouterMessage[] = baseHistory.slice();

  let accumulated = "";

  const clientStream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const encoder = new TextEncoder();
      const emit = (s: string) => {
        accumulated += s;
        controller.enqueue(encoder.encode(s));
      };

      try {
        for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
          const upstream = await streamChatCompletion({
            messages,
            tools: DIRECTOR_TOOLS,
          });

          let collectedToolCalls: OpenRouterToolCall[] = [];
          let roundText = "";

          for await (const ev of parseOpenRouterStream(upstream)) {
            if (ev.type === "text") {
              roundText += ev.delta;
              emit(ev.delta);
            } else if (ev.type === "tool_calls") {
              collectedToolCalls = ev.calls;
            } else if (ev.type === "done") {
              // Exit for-await loop; outer for-loop decides whether
              // to continue based on tool calls.
            }
          }

          if (collectedToolCalls.length === 0) {
            // Plain completion — done.
            return;
          }

          // Append the assistant turn (possibly with text + tool_calls)
          // to the history.
          messages.push({
            role: "assistant",
            content: roundText.length > 0 ? roundText : null,
            tool_calls: collectedToolCalls,
          });

          // Execute each tool and emit tool-event fences so the
          // client can render the outcome inline.
          for (const tc of collectedToolCalls) {
            const result = await executeDirectorTool(
              tc.function.name,
              tc.function.arguments,
              { admin, projectId: project!.id },
            );

            // Emit the tool-event block for the chat UI.
            const fence = [
              "",
              "```tool-event",
              JSON.stringify(result.event),
              "```",
              "",
            ].join("\n");
            emit(fence);

            // Feed the result back to the model so it can continue.
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: result.result,
            });
          }

          // Refresh PROJECT CONTEXT — tools may have changed state.
          // We rebuild the last user message's content (text or
          // multipart) so the model sees the new sheet/bible +
          // latest reference images in its next call.
          const { suffix: refreshedSuffix, refParts: refreshedRefParts } =
            await freshProjectContext();
          for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            if (m.role === "user") {
              if (typeof m.content === "string") {
                if (refreshedRefParts.length === 0) {
                  m.content = `${body.message}\n${refreshedSuffix}`;
                } else {
                  m.content = [
                    {
                      type: "text",
                      text: `${body.message}\n${refreshedSuffix}`,
                    },
                    ...refreshedRefParts,
                    ...attachedImageUrls.map((url) => ({
                      type: "image_url" as const,
                      image_url: { url },
                    })),
                  ];
                }
              } else if (Array.isArray(m.content)) {
                // Replace the first text part + append the latest
                // reference parts, preserving per-turn attachments.
                const next = [
                  {
                    type: "text" as const,
                    text: `${body.message}\n${refreshedSuffix}`,
                  },
                  ...refreshedRefParts,
                  ...attachedImageUrls.map((url) => ({
                    type: "image_url" as const,
                    image_url: { url },
                  })),
                ];
                m.content = next;
              }
              break;
            }
          }
          // Loop continues — next iteration sends the updated
          // messages back and gets the model's follow-up text.
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        emit(`\n\n[stream error: ${msg}]`);
      } finally {
        controller.close();

        if (accumulated.trim().length > 0) {
          void supabase
            .from("messages")
            .insert({
              project_id: project!.id,
              role: "assistant",
              content: accumulated,
            })
            .then(({ error }) => {
              if (error) {
                console.error(
                  "Failed to persist assistant message:",
                  error.message,
                );
              }
            });
        }

        void recordUsage({
          admin,
          userId: user.id,
          projectId: project!.id,
          provider: "openrouter",
          action: "chat",
          metadata: {
            has_attachments: attachedImageUrls.length > 0,
            attachment_count: attachedImageUrls.length,
            tool_loop: true,
          },
        });
      }
    },
  });

  return new Response(clientStream, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
      "X-User-Message-Id": userMessageRow.id,
    },
  });
}
