"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MessageBubble, type ChatMessage } from "./message";
import type { ShotPrompt } from "@/lib/shot-prompt";
import { useDictation } from "@/lib/use-dictation";
import { ScriptModeOverlay } from "./script-mode-overlay";

export function ChatPanel({
  projectId,
  initialMessages,
  onGenerate,
}: {
  projectId: string;
  initialMessages: ChatMessage[];
  onGenerate?: (shot: ShotPrompt) => Promise<void>;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track whether the current draft contains any voice-dictated text
  // so the dictation hint rides along when the user hits Send. Reset
  // whenever the draft goes empty (fresh type).
  const [inputVoiceTouched, setInputVoiceTouched] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const dictation = useDictation({
    onFinal: (text) => {
      setInput((prev) => (prev ? `${prev.trimEnd()} ${text}` : text));
      setInputVoiceTouched(true);
    },
  });

  // Script-mode overlay (long-press mic)
  const [scriptOpen, setScriptOpen] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressedRef = useRef(false);

  // Auto-scroll to bottom on new content.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Auto-resize textarea up to a cap.
  const autoSizeInput = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "0px";
    const next = Math.min(el.scrollHeight, 240);
    el.style.height = `${next}px`;
  }, []);

  useEffect(autoSizeInput, [input, autoSizeInput]);

  // Abort any in-flight stream on unmount.
  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const sendText = useCallback(async (
    rawText: string,
    opts?: { source?: "voice" },
  ) => {
    const text = rawText.trim();
    if (!text || streaming) return;

    if ("vibrate" in navigator) navigator.vibrate?.(6);
    setError(null);
    const messageToSend =
      opts?.source === "voice"
        ? `[User dictated this aloud, may contain transcription errors — interpret generously, ask clarifying questions if ambiguous.]\n\n${text}`
        : text;

    // Optimistically append the user message + a placeholder assistant
    // message that we'll mutate as the stream arrives.
    const userMsg: ChatMessage = {
      id: `user-pending-${Date.now()}`,
      role: "user",
      content: text,
    };
    const assistantMsg: ChatMessage = {
      id: `assistant-pending-${Date.now()}`,
      role: "assistant",
      content: "",
      streaming: true,
    };
    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId, message: messageToSend }),
        signal: controller.signal,
      });

      if (!resp.ok || !resp.body) {
        const payload = await resp.json().catch(() => ({ error: resp.statusText }));
        throw new Error(payload.error ?? resp.statusText ?? "request failed");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;

        setMessages((prev) => {
          const next = prev.slice();
          const last = next[next.length - 1];
          if (last && last.id === assistantMsg.id) {
            next[next.length - 1] = { ...last, content: last.content + chunk };
          }
          return next;
        });
      }
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        // user cancelled; leave partial content in place
      } else {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        setMessages((prev) => prev.filter((m) => m.id !== assistantMsg.id));
      }
    } finally {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id ? { ...m, streaming: false } : m,
        ),
      );
      setStreaming(false);
      abortRef.current = null;
    }
  }, [streaming, projectId]);

  const send = useCallback(async () => {
    const text = input;
    const opts = inputVoiceTouched ? { source: "voice" as const } : undefined;
    setInput("");
    setInputVoiceTouched(false);
    await sendText(text, opts);
  }, [input, inputVoiceTouched, sendText]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send();
    }
  };

  const hasMessages = messages.length > 0;

  return (
    <div className="flex flex-col bg-paper-deep border border-ink/10 h-[min(70vh,720px)]">
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-5 py-6 space-y-6 scroll-smooth"
      >
        {hasMessages ? (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} onGenerate={onGenerate} />
          ))
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center gap-4 px-4">
            <p className="font-hand text-2xl text-ink-soft">
              the notebook is open
            </p>
            <p className="font-body text-sm text-ink-soft max-w-sm leading-relaxed">
              Talk to the director. Describe a scene, paste a script, or ask
              for a shot. When a shot prompt appears, it&rsquo;ll show up as an
              inline card ready to generate.
            </p>
          </div>
        )}

        {error ? (
          <div className="px-4 py-3 bg-paper border border-red-grease text-red-grease font-hand text-base">
            {error}
          </div>
        ) : null}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="border-t border-ink/10 bg-paper px-4 py-3"
      >
        <div className="flex items-end gap-3">
          <button
            type="button"
            aria-label={
              dictation.listening
                ? "Stop dictation"
                : dictation.supported
                ? "Dictate (long-press for script mode)"
                : "Voice not supported in this browser"
            }
            onPointerDown={() => {
              longPressedRef.current = false;
              if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
              longPressTimerRef.current = setTimeout(() => {
                longPressedRef.current = true;
                if ("vibrate" in navigator) navigator.vibrate?.([10, 30, 10]);
                setScriptOpen(true);
              }, 450);
            }}
            onPointerUp={() => {
              if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
              if (longPressedRef.current) return; // long-press already fired
              if ("vibrate" in navigator) navigator.vibrate?.(10);
              dictation.toggle();
            }}
            onPointerLeave={() => {
              if (longPressTimerRef.current) {
                clearTimeout(longPressTimerRef.current);
                longPressTimerRef.current = null;
              }
            }}
            disabled={!dictation.supported || streaming}
            title={
              dictation.supported
                ? "Tap to dictate; long-press for script mode"
                : "Voice input requires Chrome or Safari"
            }
            className={`shrink-0 w-10 h-10 rounded-full border flex items-center justify-center transition-colors ${
              dictation.listening
                ? "bg-wine-dark text-paper border-wine-dark animate-pulse"
                : "border-ink/30 text-ink-soft hover:border-ink hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed"
            }`}
          >
            <svg
              aria-hidden
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="3" width="6" height="12" rx="3" />
              <path d="M5 11a7 7 0 0 0 14 0" />
              <path d="M12 18v3" />
            </svg>
          </button>

          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => {
              const next = e.target.value;
              setInput(next);
              // If the draft is fully cleared, drop the voice flag so
              // subsequent typed-only messages don't carry the hint.
              if (next.length === 0 && inputVoiceTouched) {
                setInputVoiceTouched(false);
              }
            }}
            onKeyDown={handleKeyDown}
            placeholder="say it to the director…"
            rows={1}
            disabled={streaming}
            className="flex-1 resize-none bg-paper-deep border border-ink/20 focus:border-ink px-3 py-2 font-body text-ink placeholder:text-ink-soft/40 outline-none transition-colors"
          />

          {streaming ? (
            <button
              type="button"
              onClick={cancel}
              className="shrink-0 px-4 h-10 bg-paper border border-ink text-ink font-body text-sm tracking-wide hover:bg-paper-deep transition-colors"
            >
              Stop
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="shrink-0 px-4 h-10 bg-ink text-paper font-body text-sm tracking-wide hover:bg-ink-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Send &rarr;
            </button>
          )}
        </div>

        <p className="font-body text-[10px] uppercase tracking-widest text-ink-soft/50 mt-2">
          {dictation.listening ? (
            <span className="text-wine-dark font-hand text-sm normal-case tracking-normal">
              listening… {dictation.interim}
            </span>
          ) : dictation.error ? (
            <span className="text-red-grease font-hand text-sm normal-case tracking-normal">
              {dictation.error}
            </span>
          ) : (
            <>enter to send · shift+enter for newline · long-press mic for script mode</>
          )}
        </p>
      </form>

      <ScriptModeOverlay
        open={scriptOpen}
        onClose={() => setScriptOpen(false)}
        onSubmit={(text) => {
          void sendText(text, { source: "voice" });
        }}
      />
    </div>
  );
}
