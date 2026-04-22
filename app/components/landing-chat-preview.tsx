"use client";

import Link from "next/link";
import { useRef, useState } from "react";

/**
 * Demo chat input the public landing ships. Anyone can type into it
 * to feel the surface, but every send/attach/mic action pops a sign-in
 * modal. We never hit a real API here.
 */
export function LandingChatPreview() {
  const [input, setInput] = useState("");
  const [modal, setModal] = useState<
    null | "send" | "mic" | "attach"
  >(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const trigger = (why: "send" | "mic" | "attach") => setModal(why);

  return (
    <div className="flex flex-col bg-paper-deep border border-ink/10">
      <div className="px-5 py-6 space-y-4 min-h-[180px]">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5">
            {/* Inline logomark — avoids importing the animated one which
                pulls in the welcome video for a preview bubble. */}
            <span
              aria-hidden
              className="inline-flex w-7 h-7 rounded-full overflow-hidden border border-ink/20"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/illustrations/logo-mark.png"
                alt=""
                className="w-full h-full object-cover"
              />
            </span>
          </div>
          <div className="flex-1">
            <div className="font-hand text-sepia-deep text-base mb-1">Dio</div>
            <p className="font-body text-ink leading-relaxed">
              I&rsquo;m Dio &mdash; your director. Tell me the story, a
              sentence is enough.
            </p>
            <p className="font-hand text-ink-soft mt-2">what are we making?</p>
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!input.trim()) return;
          trigger("send");
        }}
        className="border-t border-ink/10 bg-paper px-4 py-3 pb-safe-plus-3"
      >
        <div className="flex items-end gap-3">
          <button
            type="button"
            aria-label="Voice input (sign in first)"
            onClick={() => trigger("mic")}
            className="shrink-0 w-10 h-10 rounded-full border border-ink/30 text-ink-soft flex items-center justify-center hover:border-ink hover:text-ink transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              aria-hidden
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
            aria-label="Attach image (sign in first)"
            onClick={() => trigger("attach")}
            className="shrink-0 w-10 h-10 rounded-full border border-ink/30 text-ink-soft flex items-center justify-center hover:border-ink hover:text-ink transition-colors"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              aria-hidden
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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (input.trim()) trigger("send");
              }
            }}
            placeholder="say it to the director…"
            rows={1}
            className="flex-1 resize-none bg-paper-deep border border-ink/20 focus:border-ink px-3 py-2 font-body text-ink placeholder:text-ink-soft/40 outline-none transition-colors"
          />

          <button
            type="submit"
            disabled={!input.trim()}
            className="shrink-0 px-4 h-10 bg-ink text-paper font-body text-sm tracking-wide hover:bg-ink-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Send &rarr;
          </button>
        </div>
        <p className="font-body text-[10px] uppercase tracking-widest text-ink-soft/50 mt-2">
          enter to send · sign in to actually talk to Dio
        </p>
      </form>

      {modal ? (
        <SignInPrompt
          reason={modal}
          onClose={() => setModal(null)}
          pending={input.trim()}
        />
      ) : null}
    </div>
  );
}

function SignInPrompt({
  reason,
  onClose,
  pending,
}: {
  reason: "send" | "mic" | "attach";
  onClose: () => void;
  pending: string;
}) {
  const heading =
    reason === "send"
      ? "sign in to send"
      : reason === "mic"
      ? "sign in to speak"
      : "sign in to attach";
  const body =
    reason === "send"
      ? "Dio only writes back for signed-in directors. It's free to sign up, no credit card."
      : reason === "mic"
      ? "Voice goes through Dio's pipeline — signed-in only."
      : "Attachments get routed to your own project in Supabase. Sign in first.";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={heading}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
    >
      <button
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/40 backdrop-blur-sm"
      />
      <div className="relative w-full sm:max-w-md bg-paper border-t sm:border border-ink/20 pb-safe-plus-4">
        <header className="flex items-center justify-between px-5 py-3 border-b border-ink/10">
          <span className="font-hand text-xl text-ink">{heading}</span>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="font-display text-2xl text-ink-soft hover:text-ink px-2"
          >
            &times;
          </button>
        </header>
        <div className="px-5 py-5 space-y-4">
          <p className="font-body text-ink leading-relaxed">{body}</p>
          {pending ? (
            <div className="bg-paper-deep p-3">
              <p className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60 mb-1">
                you were about to say
              </p>
              <p className="font-body text-sm text-ink line-clamp-3 whitespace-pre-wrap">
                {pending}
              </p>
            </div>
          ) : null}
          <div className="flex items-center gap-3 flex-wrap">
            <Link
              href="/login"
              className="px-4 h-11 inline-flex items-center bg-ink text-paper font-body tracking-wide hover:bg-ink-soft transition-colors"
            >
              Sign in / sign up &rarr;
            </Link>
            <button
              type="button"
              onClick={onClose}
              className="px-3 h-11 font-body text-[11px] uppercase tracking-widest text-ink-soft/70 hover:text-ink transition-colors"
            >
              keep browsing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
