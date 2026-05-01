import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { gateChat, recordUsage } from "@/lib/budget";
import {
  streamChatCompletion,
  parseOpenRouterStream,
  type OpenRouterMessage,
  type OpenRouterToolCall,
} from "@/lib/openrouter";
import { ARI_SYSTEM_PROMPT, buildAriContextSuffix } from "@/lib/prompts/ari";
import { MAE_SYSTEM_PROMPT } from "@/lib/prompts/mae";
import {
  CONCEPT_SYSTEM_PROMPT,
  buildConceptContextSuffix,
} from "@/lib/prompts/concept";
import {
  SCRIPT_SYSTEM_PROMPT,
  buildScriptContextSuffix,
} from "@/lib/prompts/script";
import {
  SCENE_SYSTEM_PROMPT,
  buildSceneContextSuffix,
} from "@/lib/prompts/scene";
import {
  ARI_TOOLS,
  MAE_TOOLS,
  CONCEPT_TOOLS,
  SCRIPT_TOOLS,
  SCENE_TOOLS,
  executeDirectorTool,
  type ToolDefinition,
} from "@/lib/director-tools";
import { collectLabeledRefs } from "@/lib/references";
import type {
  CharacterSheet,
  AestheticBible,
  ChatMode,
} from "@/lib/supabase/types";
import type { ShotPromptMetadata } from "@/lib/shot-prompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  project_id: z.string().uuid(),
  message: z.string().trim().min(1).max(8000),
  attached_image_urls: z.array(z.string().url()).max(8).optional(),
  /**
   * Which half of the director the message is going to.
   *   - ari    — legacy alias, routed to Liturgy (script) mode.
   *   - mae    — legacy executor chat (Mae no longer chats; left in for
   *              read-only history tabs).
   *   - concept — Oracle: free-form ideation pre-Liturgy.
   *   - script  — Liturgy: scene drafting (json-shot blocks).
   *   - scene   — Rite: per-scene refinement, requires scene_id.
   */
  mode: z
    .enum(["ari", "mae", "concept", "script", "scene"])
    .default("script"),
  /** Required when mode === "scene". The clip the Rite is bound to. */
  scene_id: z.string().uuid().optional(),
});

const HISTORY_LIMIT = 40;
/** Cap on how many tool-call rounds per user turn. Defensive. */
const MAX_TOOL_ROUNDS = 5;

function pickSystemPrompt(
  mode: "ari" | "mae" | "concept" | "script" | "scene",
): string {
  switch (mode) {
    case "concept":
      return CONCEPT_SYSTEM_PROMPT;
    case "script":
      return SCRIPT_SYSTEM_PROMPT;
    case "scene":
      return SCENE_SYSTEM_PROMPT;
    case "mae":
      return MAE_SYSTEM_PROMPT;
    case "ari":
    default:
      // Legacy "ari" rows came from before the StoryFlow split. Treat
      // them as Liturgy (script) so the historical ledger stays
      // coherent.
      return ARI_SYSTEM_PROMPT;
  }
}

function pickTools(
  mode: "ari" | "mae" | "concept" | "script" | "scene",
): ToolDefinition[] {
  switch (mode) {
    case "concept":
      return CONCEPT_TOOLS;
    case "script":
      return SCRIPT_TOOLS;
    case "scene":
      return SCENE_TOOLS;
    case "mae":
      return MAE_TOOLS;
    case "ari":
    default:
      return ARI_TOOLS;
  }
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
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

  // Rite mode requires a scene binding. Reject up front so the
  // model is never asked to refine "the active scene" with no scene.
  if (body.mode === "scene" && !body.scene_id) {
    return NextResponse.json(
      { error: "scene_id required for Rite mode" },
      { status: 400 },
    );
  }

  // The Liturgy and the Oracle live under different chat_mode keys
  // so each thread is its own ledger. "ari" is treated as a legacy
  // alias for "script" — historical rows stay readable, new rows
  // land under the canonical key.
  const persistedMode: ChatMode =
    body.mode === "ari" ? "script" : (body.mode as ChatMode);

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

  // Build the chat_mode filter. Liturgy threads should also see the
  // legacy "ari" rows so users on long-running projects don't lose
  // their planning history; Rite threads scope down to the active
  // scene_id so different scenes have different ledgers.
  let priorQuery = supabase
    .from("messages")
    .select("role, content")
    .eq("project_id", project.id);
  if (persistedMode === "script") {
    priorQuery = priorQuery.in("chat_mode", ["script", "ari"]);
  } else {
    priorQuery = priorQuery.eq("chat_mode", persistedMode);
  }
  if (persistedMode === "scene" && body.scene_id) {
    priorQuery = priorQuery.eq("scene_id", body.scene_id);
  }
  const { data: priorMessages, error: messagesError } = await priorQuery
    .order("created_at", { ascending: true })
    .limit(HISTORY_LIMIT);

  if (messagesError) {
    return NextResponse.json({ error: messagesError.message }, { status: 500 });
  }

  const admin = createServiceRoleClient();
  const gate = await gateChat({ admin, userId: user.id, email: user.email });
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
      chat_mode: persistedMode,
      ...(persistedMode === "scene" && body.scene_id
        ? { scene_id: body.scene_id }
        : {}),
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
    const title = data?.title ?? project!.title;

    let suffix: string;
    if (body.mode === "concept") {
      suffix = buildConceptContextSuffix({
        title,
        character_sheet: sheet,
        aesthetic_bible: bible,
      });
    } else if (body.mode === "script" || body.mode === "ari") {
      // Look up the highest existing shot_number so Ari continues
      // numbering when she adds to a draft.
      const { data: maxClip } = await admin
        .from("clips")
        .select("shot_metadata, order_index")
        .eq("project_id", project!.id)
        .order("order_index", { ascending: false })
        .limit(1)
        .maybeSingle();
      const maxShotNumber =
        ((maxClip?.shot_metadata as ShotPromptMetadata | null)?.shot_number ??
          maxClip?.order_index ??
          0) || 0;
      suffix = buildScriptContextSuffix({
        title,
        character_sheet: sheet,
        aesthetic_bible: bible,
        highest_shot_number: maxShotNumber,
      });
    } else if (body.mode === "scene" && body.scene_id) {
      const { data: clip } = await admin
        .from("clips")
        .select(
          "id, order_index, prompt, still_prompt, narration, shot_metadata, still_status, status, bible_overrides",
        )
        .eq("id", body.scene_id)
        .eq("project_id", project!.id)
        .single();
      const meta = (clip?.shot_metadata ?? {}) as ShotPromptMetadata;
      suffix = buildSceneContextSuffix({
        title,
        character_sheet: sheet,
        aesthetic_bible: bible,
        scene: {
          id: clip?.id ?? body.scene_id,
          order_index: clip?.order_index ?? -1,
          prompt: clip?.prompt ?? null,
          image_prompt: clip?.still_prompt ?? meta.image_prompt ?? null,
          motion_prompt: clip?.prompt ?? null,
          narration: clip?.narration ?? meta.narration ?? null,
          still_status: clip?.still_status ?? "none",
          video_status: clip?.status ?? "queued",
          animation_model: meta.animation_model ?? null,
          bible_overrides: clip?.bible_overrides ?? {},
        },
      });
    } else {
      // mae / legacy fallback
      suffix = buildAriContextSuffix({
        title,
        character_sheet: sheet,
        aesthetic_bible: bible,
      });
    }

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

  const systemPrompt = pickSystemPrompt(body.mode);
  const tools = pickTools(body.mode);

  const baseHistory: OpenRouterMessage[] = [
    { role: "system", content: systemPrompt },
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
            tools,
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
          const toolOrigin = new URL(request.url).origin;
          const toolCookies = request.headers.get("cookie") ?? undefined;
          for (const tc of collectedToolCalls) {
            const result = await executeDirectorTool(
              tc.function.name,
              tc.function.arguments,
              {
                admin,
                projectId: project!.id,
                origin: toolOrigin,
                cookieHeader: toolCookies,
                sceneId: body.scene_id,
              },
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
              chat_mode: persistedMode,
              ...(persistedMode === "scene" && body.scene_id
                ? { scene_id: body.scene_id }
                : {}),
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
            mode: body.mode,
            ...(body.scene_id ? { scene_id: body.scene_id } : {}),
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
