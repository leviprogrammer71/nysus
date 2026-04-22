"use client";

import { useEffect, useRef } from "react";
import { useScriptDictation } from "@/lib/use-script-dictation";

/**
 * Full-screen script-mode overlay.
 *
 * Triggered by a long-press on the mic button. Renders a hand-drawn
 * animated sine wave (Director's Desk aesthetic — no generic bar
 * visualizer) + live transcript. Voice commands: "new shot", "scratch
 * that", "send to Claude", "character note:".
 *
 * On submit, `onSubmit` receives the finalized transcript. The
 * caller is expected to POST it to /api/chat; we don't do that here
 * so the component stays decoupled from the chat implementation.
 */
export function ScriptModeOverlay({
  open,
  onClose,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (finalText: string) => void;
}) {
  const dict = useScriptDictation({
    onSubmit: (text) => {
      onSubmit(text);
      onClose();
    },
  });

  // Start recording as soon as the overlay opens.
  const startedRef = useRef(false);
  useEffect(() => {
    if (!open) {
      startedRef.current = false;
      return;
    }
    if (!startedRef.current && dict.supported) {
      startedRef.current = true;
      dict.start();
    }
  }, [open, dict]);

  // Close shortcuts
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dict.stop(false);
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dict, onClose]);

  if (!open) return null;

  const shownTranscript = dict.transcript;
  const shownInterim = dict.interim;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Script mode"
      className="fixed inset-0 z-[60] bg-paper flex flex-col"
    >
      <header className="flex items-center justify-between px-5 py-3 pt-safe border-b border-ink/10">
        <div className="flex items-center gap-3">
          <span
            className={`w-2 h-2 rounded-full ${
              dict.listening ? "bg-wine-dark animate-pulse" : "bg-ink-soft/40"
            }`}
            aria-hidden
          />
          <span className="font-hand text-xl text-ink">
            {dict.listening ? "script mode · listening" : "script mode"}
          </span>
        </div>
        <button
          type="button"
          onClick={() => {
            dict.stop(false);
            onClose();
          }}
          aria-label="Close"
          className="font-display text-2xl text-ink-soft hover:text-ink px-2"
        >
          &times;
        </button>
      </header>

      {/* Hand-drawn waveform */}
      <div className="shrink-0 px-5 pt-4">
        <IntentionalWaveform active={dict.listening} />
      </div>

      {/* Transcript */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {shownTranscript ? (
          <p className="font-hand text-2xl text-ink leading-relaxed whitespace-pre-wrap">
            {shownTranscript}
          </p>
        ) : (
          <p className="font-hand text-xl text-ink-soft">
            speak &mdash; say things like &ldquo;new shot&rdquo;, &ldquo;scratch that&rdquo;,
            or &ldquo;send to Claude&rdquo; when you&rsquo;re done.
          </p>
        )}
        {shownInterim ? (
          <p className="font-hand text-xl text-ink-soft/70 leading-relaxed italic mt-2 whitespace-pre-wrap">
            {shownInterim}
          </p>
        ) : null}

        {dict.error ? (
          <p aria-live="polite" className="font-hand text-lg text-red-grease mt-4">
            {dict.error}
          </p>
        ) : null}
      </div>

      {/* Footer controls */}
      <footer className="border-t border-ink/10 px-5 py-4 pb-safe-plus-4 flex items-center gap-3 justify-between">
        <div className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
          say <span className="font-hand text-sm normal-case text-ink-soft">new shot</span>
          {" · "}
          <span className="font-hand text-sm normal-case text-ink-soft">scratch that</span>
          {" · "}
          <span className="font-hand text-sm normal-case text-ink-soft">send to Claude</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              dict.stop(false);
              onClose();
            }}
            className="px-3 py-1.5 bg-paper border border-ink/40 text-ink font-body text-sm tracking-wide hover:border-ink transition-colors"
          >
            cancel
          </button>
          <button
            type="button"
            onClick={() => dict.stop(true)}
            disabled={!dict.transcript.trim()}
            className="px-4 py-1.5 bg-ink text-paper font-body text-sm tracking-wide hover:bg-ink-soft disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            send →
          </button>
        </div>
      </footer>
    </div>
  );
}

/**
 * Hand-drawn sine wave that pulses while listening. Pure SVG with
 * stroke-dasharray animation to feel like a fountain pen, not a
 * meter.
 */
function IntentionalWaveform({ active }: { active: boolean }) {
  // Generate a stable but mildly irregular sine path — the second
  // harmonic gives it the "drawn with a pen" unevenness.
  const points: string[] = [];
  const W = 1200;
  const H = 80;
  for (let i = 0; i <= 120; i++) {
    const x = (i / 120) * W;
    const base = Math.sin((i / 120) * Math.PI * 6) * 22;
    const trem = Math.sin((i / 120) * Math.PI * 17) * 4;
    const y = H / 2 + base + trem;
    points.push(`${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`);
  }
  const d = points.join(" ");

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`w-full h-20 text-ink ${active ? "" : "opacity-40"}`}
      aria-hidden
    >
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={active ? "animate-[waveform_2.2s_ease-in-out_infinite]" : ""}
        style={
          {
            strokeDasharray: "2400",
            strokeDashoffset: "0",
          } as React.CSSProperties
        }
      />
      <style>{`
        @keyframes waveform {
          0%   { opacity: 0.55; transform: translateX(0);   }
          50%  { opacity: 1;    transform: translateX(-8px); }
          100% { opacity: 0.55; transform: translateX(0);   }
        }
      `}</style>
    </svg>
  );
}
