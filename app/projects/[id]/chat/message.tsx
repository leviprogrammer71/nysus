"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { shotPromptSchema, type ShotPrompt } from "@/lib/shot-prompt";
import { ShotCard } from "./shot-card";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** True while the assistant is still streaming this message. */
  streaming?: boolean;
};

// Split a message into text segments and shot cards so shots render
// as proper components instead of raw JSON code blocks.
function splitAssistantContent(
  content: string,
): Array<{ type: "text"; text: string } | { type: "shot"; shot: ShotPrompt }> {
  const fence = /```json-shot\s*\n([\s\S]*?)\n```/g;
  const out: Array<
    { type: "text"; text: string } | { type: "shot"; shot: ShotPrompt }
  > = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(content)) !== null) {
    if (m.index > lastIndex) {
      out.push({ type: "text", text: content.slice(lastIndex, m.index) });
    }
    try {
      const parsed = shotPromptSchema.parse(JSON.parse(m[1]));
      out.push({ type: "shot", shot: parsed });
    } catch {
      // Malformed shot block — render the raw fenced block as text so
      // the user can see what went wrong.
      out.push({ type: "text", text: m[0] });
    }
    lastIndex = fence.lastIndex;
  }
  if (lastIndex < content.length) {
    out.push({ type: "text", text: content.slice(lastIndex) });
  }
  return out;
}

export function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] px-4 py-3 bg-ink text-paper font-body whitespace-pre-wrap">
          {message.content}
        </div>
      </div>
    );
  }

  const segments = splitAssistantContent(message.content);

  return (
    <div className="flex">
      <div className="max-w-[92%] flex-1">
        <div className="flex items-center gap-2 mb-1 font-hand text-sepia-deep text-base">
          <span>the director</span>
          {message.streaming ? (
            <span
              className="inline-block w-1.5 h-3.5 bg-ink align-middle animate-pulse"
              aria-hidden
            />
          ) : null}
        </div>
        <div className="font-body text-ink space-y-3 leading-relaxed">
          {segments.map((seg, i) =>
            seg.type === "shot" ? (
              <ShotCard key={`shot-${i}`} shot={seg.shot} />
            ) : (
              <div key={`text-${i}`} className="prose-nysus">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {seg.text}
                </ReactMarkdown>
              </div>
            ),
          )}
        </div>
      </div>
    </div>
  );
}
