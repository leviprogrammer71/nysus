"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageBubble, type ChatMessage } from "./message";
import type { ShotPrompt } from "@/lib/shot-prompt";
import { useDictation } from "@/lib/use-dictation";
import { ScriptModeOverlay } from "./script-mode-overlay";
import { Logomark } from "@/app/components/logomark";

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

  // Image attachments for the current draft. Uploaded eagerly so the
  // send path doesn't block on the network.
  type Attachment = {
    id: string;
    previewUrl: string; // local object URL for the chip
    uploading: boolean;
    remoteUrl?: string; // signed URL from /api/chat/attach
    error?: string;
  };
  const [attachments, setAttachments] = useState<Attachment[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const router = useRouter();

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

  const uploadAttachment = useCallback(
    async (file: File) => {
      const id = `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const previewUrl = URL.createObjectURL(file);
      setAttachments((prev) => [
        ...prev,
        { id, previewUrl, uploading: true },
      ]);
      try {
        const form = new FormData();
        form.append("project_id", projectId);
        form.append("file", file);
        const res = await fetch("/api/chat/attach", {
          method: "POST",
          body: form,
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? res.statusText);
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === id
              ? { ...a, uploading: false, remoteUrl: body.url as string }
              : a,
          ),
        );
      } catch (err) {
        setAttachments((prev) =>
          prev.map((a) =>
            a.id === id
              ? {
                  ...a,
                  uploading: false,
                  error: err instanceof Error ? err.message : String(err),
                }
              : a,
          ),
        );
      }
    },
    [projectId],
  );

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/"));
      if (list.length === 0) return;
      const remainingSlots = 8 - attachments.length;
      for (const f of list.slice(0, Math.max(0, remainingSlots))) {
        void uploadAttachment(f);
      }
    },
    [attachments.length, uploadAttachment],
  );

  const removeAttachment = useCallback((id: string) => {
    setAttachments((prev) => {
      const removed = prev.find((a) => a.id === id);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return prev.filter((a) => a.id !== id);
    });
  }, []);

  // Clean up all object URLs on unmount.
  useEffect(() => {
    return () => {
      setAttachments((prev) => {
        prev.forEach((a) => URL.revokeObjectURL(a.previewUrl));
        return prev;
      });
    };
  }, []);

  // Paste handler — when the textarea is focused, pasted images land
  // as attachments instead of garbage text in the input.
  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files: File[] = [];
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        const it = items[i];
        if (it.kind === "file" && it.type.startsWith("image/")) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) {
        e.preventDefault();
        addFiles(files);
      }
    },
    [addFiles],
  );

  const [dragActive, setDragActive] = useState(false);
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLElement>) => {
      e.preventDefault();
      setDragActive(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles],
  );

  const sendText = useCallback(async (
    rawText: string,
    opts?: { source?: "voice" },
  ) => {
    const text = rawText.trim();
    if (!text || streaming) return;
    // Block send while uploads are in flight.
    if (attachments.some((a) => a.uploading)) return;

    if ("vibrate" in navigator) navigator.vibrate?.(6);
    setError(null);
    const messageToSend =
      opts?.source === "voice"
        ? `[User dictated this aloud, may contain transcription errors — interpret generously, ask clarifying questions if ambiguous.]\n\n${text}`
        : text;
    const attachedUrls = attachments
      .filter((a) => a.remoteUrl && !a.error)
      .map((a) => a.remoteUrl!) as string[];

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
        body: JSON.stringify({
          project_id: projectId,
          message: messageToSend,
          ...(attachedUrls.length > 0
            ? { attached_image_urls: attachedUrls }
            : {}),
        }),
        signal: controller.signal,
      });

      // Clear attachments on successful submit start — they ride with
      // the user message we've already sent.
      attachments.forEach((a) => URL.revokeObjectURL(a.previewUrl));
      setAttachments([]);

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
      // Refresh server-rendered project state — if the director used a
      // tool, the sheet/bible/title in the surrounding page should
      // update without a manual reload.
      router.refresh();
    }
  }, [streaming, projectId, attachments, router]);

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
    <div className="flex flex-col bg-paper-deep border border-ink/10 h-[min(70svh,720px)]">
      <div
        ref={scrollerRef}
        className="flex-1 overflow-y-auto px-5 py-6 space-y-6 scroll-smooth"
      >
        {hasMessages ? (
          messages.map((m) => (
            <MessageBubble key={m.id} message={m} onGenerate={onGenerate} />
          ))
        ) : (
          <DioGreeting />
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
        onDragOver={(e) => {
          if (e.dataTransfer.types.includes("Files")) {
            e.preventDefault();
            setDragActive(true);
          }
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={handleDrop}
        className={`relative border-t bg-paper px-4 py-3 pb-safe-plus-3 transition-colors ${
          dragActive ? "border-sepia-deep bg-paper-deep" : "border-ink/10"
        }`}
      >
        {dragActive ? (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none bg-paper/70 backdrop-blur-sm">
            <span className="font-hand text-xl text-sepia-deep">
              drop image to attach
            </span>
          </div>
        ) : null}

        {attachments.length > 0 ? (
          <div className="flex flex-wrap gap-2 mb-3">
            {attachments.map((att) => (
              <div
                key={att.id}
                className="relative w-16 h-16 shrink-0 bg-paper-deep border border-ink/20 overflow-hidden"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={att.previewUrl}
                  alt="Attachment preview"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {att.uploading ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-paper/70">
                    <div className="w-4 h-4 border-2 border-ink/40 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : null}
                {att.error ? (
                  <div
                    title={att.error}
                    className="absolute inset-0 flex items-center justify-center bg-red-grease/30 font-display text-red-grease text-lg"
                  >
                    !
                  </div>
                ) : null}
                <button
                  type="button"
                  aria-label="Remove attachment"
                  onClick={() => removeAttachment(att.id)}
                  className="absolute -top-1 -right-1 w-6 h-6 bg-paper border border-ink/40 rounded-full font-display text-sm text-ink-soft hover:text-ink flex items-center justify-center leading-none"
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        ) : null}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            // Reset so picking the same file twice in a row still fires change.
            e.target.value = "";
          }}
        />

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

          <button
            type="button"
            aria-label="Attach image"
            onClick={() => fileInputRef.current?.click()}
            disabled={streaming || attachments.length >= 8}
            title="Attach an image (or paste / drop one)"
            className="shrink-0 w-10 h-10 rounded-full border border-ink/30 text-ink-soft hover:border-ink hover:text-ink disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center transition-colors"
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
              <path d="M21 14.5 13.5 7a4 4 0 0 0-5.7 5.7l8 8a2.5 2.5 0 0 0 3.5-3.5L11.3 9.2" />
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
            onPaste={handlePaste}
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

/**
 * Pre-first-message greeting. Dio introduces himself with the
 * animated logomark. This is the "reflection" — every time you see
 * Dio, his mark moves.
 */
function DioGreeting() {
  return (
    <div className="flex gap-3">
      <div className="shrink-0 mt-0.5">
        <Logomark size={28} animated />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-2 font-hand text-sepia-deep text-base">
          <span>Dio</span>
        </div>
        <div className="font-body text-ink space-y-3 leading-relaxed">
          <p>
            I&rsquo;m Dio &mdash; your director. Tell me the story, a sentence
            is enough. I&rsquo;ll draft the cast, the aesthetic bible, and the
            first few scenes from it.
          </p>
          <p>
            Each scene gives you an{" "}
            <span className="font-hand text-sepia-deep">image prompt</span>,
            an{" "}
            <span className="font-hand text-sepia-deep">animation prompt</span>,
            and the{" "}
            <span className="font-hand text-sepia-deep">narration</span>. You
            pick what to generate, when.
          </p>
          <p className="font-hand text-ink-soft">what are we making?</p>
        </div>
      </div>
    </div>
  );
}
