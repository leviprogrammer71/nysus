"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { shotPromptSchema, type ShotPrompt } from "@/lib/shot-prompt";
import { ShotCard } from "./shot-card";
import { ToolEventCard } from "./tool-event-card";
import { Logomark } from "@/app/components/logomark";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** True while the assistant is still streaming this message. */
  streaming?: boolean;
};

type ToolEvent = {
  name: string;
  summary: string;
  detail?: string;
};

type AssistantSegment =
  | { type: "text"; text: string }
  | { type: "shot"; shot: ShotPrompt }
  | { type: "tool"; event: ToolEvent };

// Split a message into text + shot cards + tool-event cards. We match
// both fence kinds in one pass so they render in the order the director
// wrote them.
function splitAssistantContent(content: string): AssistantSegment[] {
  const fence = /```(json-shot|tool-event)\s*\n([\s\S]*?)\n```/g;
  const out: AssistantSegment[] = [];
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = fence.exec(content)) !== null) {
    if (m.index > lastIndex) {
      out.push({ type: "text", text: content.slice(lastIndex, m.index) });
    }
    const kind = m[1];
    const raw = m[2];
    if (kind === "json-shot") {
      try {
        const parsed = shotPromptSchema.parse(JSON.parse(raw));
        out.push({ type: "shot", shot: parsed });
      } catch {
        out.push({ type: "text", text: m[0] });
      }
    } else {
      // tool-event
      try {
        const ev = JSON.parse(raw) as Partial<ToolEvent>;
        if (typeof ev.name === "string" && typeof ev.summary === "string") {
          out.push({
            type: "tool",
            event: {
              name: ev.name,
              summary: ev.summary,
              detail: typeof ev.detail === "string" ? ev.detail : undefined,
            },
          });
        } else {
          out.push({ type: "text", text: m[0] });
        }
      } catch {
        out.push({ type: "text", text: m[0] });
      }
    }
    lastIndex = fence.lastIndex;
  }
  if (lastIndex < content.length) {
    out.push({ type: "text", text: content.slice(lastIndex) });
  }
  return out;
}

export function MessageBubble({
  message,
  onGenerate,
}: {
  message: ChatMessage;
  onGenerate?: (shot: ShotPrompt) => Promise<void>;
}) {
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
    <div className="flex gap-3">
      <div className="shrink-0 mt-0.5">
        {/* Dio "reflects" — animated logomark avatar on every turn. */}
        <Logomark
          size={28}
          animated={message.streaming}
        />
      </div>
      <div className="max-w-[92%] flex-1">
        <div className="flex items-center gap-2 mb-1 font-hand text-sepia-deep text-base">
          <span>Dio</span>
          {message.streaming ? (
            <span
              className="inline-block w-1.5 h-3.5 bg-ink align-middle animate-pulse"
              aria-hidden
            />
          ) : null}
        </div>
        <div className="font-body text-ink space-y-3 leading-relaxed">
          {segments.map((seg, i) => {
            if (seg.type === "shot") {
              return (
                <ShotCard
                  key={`shot-${i}`}
                  shot={seg.shot}
                  onGenerate={onGenerate}
                />
              );
            }
            if (seg.type === "tool") {
              return <ToolEventCard key={`tool-${i}`} event={seg.event} />;
            }
            return (
              <div key={`text-${i}`} className="prose-nysus">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {seg.text}
                </ReactMarkdown>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
