import { env } from "@/lib/env";

/**
 * Minimal typed wrapper over OpenRouter's OpenAI-compatible chat
 * completions endpoint with streaming — now with tool-call support.
 */

export const DEFAULT_CHAT_MODEL = "anthropic/claude-opus-4";

export type TextOrMultipart =
  | string
  | Array<
      | { type: "text"; text: string }
      | { type: "image_url"; image_url: { url: string } }
    >;

export interface OpenRouterToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export type OpenRouterMessage =
  | { role: "system"; content: string }
  | { role: "user"; content: TextOrMultipart }
  | {
      role: "assistant";
      content: string | null;
      tool_calls?: OpenRouterToolCall[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

export interface OpenRouterTool {
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface StreamChatOptions {
  model?: string;
  messages: OpenRouterMessage[];
  signal?: AbortSignal;
  temperature?: number;
  max_tokens?: number;
  tools?: OpenRouterTool[];
  tool_choice?: "auto" | "none" | "required";
}

/**
 * Kick off the streaming request. Returns the raw SSE body; use
 * parseOpenRouterStream below to consume it as a sequence of typed
 * events (text deltas, assembled tool_calls, finish_reason).
 */
export async function streamChatCompletion({
  model = DEFAULT_CHAT_MODEL,
  messages,
  signal,
  temperature = 0.7,
  max_tokens = 8000,
  tools,
  tool_choice,
}: StreamChatOptions): Promise<ReadableStream<Uint8Array>> {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature,
    max_tokens,
    stream: true,
  };
  if (tools && tools.length > 0) {
    body.tools = tools;
    if (tool_choice) body.tool_choice = tool_choice;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
      "X-Title": "Nysus",
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok || !response.body) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `OpenRouter ${response.status} ${response.statusText}: ${text.slice(0, 500)}`,
    );
  }

  return response.body;
}

// ---------------------------------------------------------------------------
// Stream parsing — yields a sequence of typed events so the caller can run a
// tool-call loop without having to understand SSE chunking.
// ---------------------------------------------------------------------------

export type OpenRouterStreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_calls"; calls: OpenRouterToolCall[] }
  | { type: "done"; finish_reason: string | null };

interface DeltaChunk {
  content?: string | null;
  tool_calls?: Array<{
    index: number;
    id?: string;
    type?: "function";
    function?: { name?: string; arguments?: string };
  }>;
}

interface ChoiceChunk {
  index: number;
  delta?: DeltaChunk;
  finish_reason?: string | null;
}

interface StreamChunk {
  choices?: ChoiceChunk[];
}

/**
 * Async generator that yields events. Tool calls are accumulated across
 * partial deltas by `index` and emitted whole when finish_reason arrives.
 */
export async function* parseOpenRouterStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<OpenRouterStreamEvent, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  // tool_call accumulators keyed by index
  const toolBuffers = new Map<
    number,
    { id: string; name: string; arguments: string }
  >();

  let finishReason: string | null = null;

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const evt of events) {
        const lines = evt.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") {
            if (toolBuffers.size > 0) {
              yield {
                type: "tool_calls",
                calls: [...toolBuffers.values()].map((b) => ({
                  id: b.id,
                  type: "function",
                  function: { name: b.name, arguments: b.arguments },
                })),
              };
              toolBuffers.clear();
            }
            yield { type: "done", finish_reason: finishReason };
            return;
          }
          if (!payload) continue;
          let parsed: StreamChunk;
          try {
            parsed = JSON.parse(payload) as StreamChunk;
          } catch {
            continue; // partial chunk, SSE split mid-JSON
          }
          const choice = parsed.choices?.[0];
          if (!choice) continue;

          const delta = choice.delta;
          if (delta?.content) {
            yield { type: "text", delta: delta.content };
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const existing = toolBuffers.get(tc.index) ?? {
                id: "",
                name: "",
                arguments: "",
              };
              if (tc.id) existing.id = tc.id;
              if (tc.function?.name) existing.name = tc.function.name;
              if (tc.function?.arguments)
                existing.arguments += tc.function.arguments;
              toolBuffers.set(tc.index, existing);
            }
          }

          if (choice.finish_reason) {
            finishReason = choice.finish_reason;
            if (
              choice.finish_reason === "tool_calls" &&
              toolBuffers.size > 0
            ) {
              yield {
                type: "tool_calls",
                calls: [...toolBuffers.values()].map((b) => ({
                  id: b.id,
                  type: "function",
                  function: { name: b.name, arguments: b.arguments },
                })),
              };
              toolBuffers.clear();
            }
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (toolBuffers.size > 0) {
    yield {
      type: "tool_calls",
      calls: [...toolBuffers.values()].map((b) => ({
        id: b.id,
        type: "function",
        function: { name: b.name, arguments: b.arguments },
      })),
    };
  }
  yield { type: "done", finish_reason: finishReason };
}
