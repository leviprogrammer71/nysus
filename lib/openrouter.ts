import { env } from "@/lib/env";

/**
 * Minimal typed wrapper over OpenRouter's OpenAI-compatible chat
 * completions endpoint with streaming.
 *
 * The default model is set in DEFAULT_CHAT_MODEL and should be
 * verified before Phase 3 goes live (see PROGRESS.md § Deviations).
 */

export const DEFAULT_CHAT_MODEL = "anthropic/claude-opus-4";

export type OpenRouterMessage =
  | { role: "system" | "user" | "assistant"; content: string }
  | {
      role: "user";
      content: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
    };

export interface StreamChatOptions {
  model?: string;
  messages: OpenRouterMessage[];
  signal?: AbortSignal;
  /** Defaults to 0.7. */
  temperature?: number;
  /** Defaults to 8000. */
  max_tokens?: number;
}

/**
 * Kicks off the streaming request. The caller is responsible for
 * reading the returned `ReadableStream<Uint8Array>` (the raw response
 * body from OpenRouter in OpenAI SSE format) and parsing the deltas.
 *
 * Use `parseOpenRouterStream` below for the default text-delta reader.
 */
export async function streamChatCompletion({
  model = DEFAULT_CHAT_MODEL,
  messages,
  signal,
  temperature = 0.7,
  max_tokens = 8000,
}: StreamChatOptions): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      // OpenRouter asks clients to self-identify via these headers.
      "HTTP-Referer": env.NEXT_PUBLIC_APP_URL,
      "X-Title": "Nysus",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
      stream: true,
    }),
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

/**
 * Async iterator that yields text deltas from an OpenRouter SSE
 * stream. Handles `[DONE]` sentinel and tolerant of multi-byte chunks.
 */
export async function* parseOpenRouterStream(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string, void, void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE events are separated by \n\n.
      const events = buffer.split("\n\n");
      buffer = events.pop() ?? "";

      for (const evt of events) {
        const lines = evt.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") return;
          if (!payload) continue;
          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>;
            };
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) yield delta;
          } catch {
            // Ignore partial/malformed chunks; SSE framing can split JSON.
          }
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
