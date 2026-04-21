"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Web Speech API dictation hook.
 *
 * Single-mode (quick dictation): tap the mic, speak, tap again (or
 * 2-second silence) to finalize. Interim transcripts stream into
 * `interim`; finalized text comes through `onFinal`.
 *
 * Fallback-safe: if `webkitSpeechRecognition` isn't available (Firefox,
 * older iOS), `supported` stays false and callers disable the mic UI.
 */
type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

interface SpeechRecognitionLike extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((ev: SpeechRecognitionResultEvent) => void) | null;
  onerror: ((ev: Event) => void) | null;
  onend: ((ev: Event) => void) | null;
}

interface SpeechRecognitionResultEvent extends Event {
  resultIndex: number;
  results: {
    length: number;
    [i: number]: {
      isFinal: boolean;
      [j: number]: { transcript: string };
    };
  };
}

function getCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function useDictation({
  onFinal,
  silenceMs = 2000,
  lang = "en-US",
}: {
  onFinal: (text: string) => void;
  silenceMs?: number;
  lang?: string;
}) {
  // Lazy initializer probes the browser once — avoids setState-in-effect.
  // Returns false during SSR (no window) and the correct answer on hydrate.
  const [supported] = useState(() => Boolean(getCtor()));
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finalBufferRef = useRef<string>("");

  const stop = useCallback(() => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || listening) return;

    setError(null);
    setInterim("");
    finalBufferRef.current = "";

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onresult = (ev) => {
      let interimText = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const txt = r[0]?.transcript ?? "";
        if (r.isFinal) {
          finalBufferRef.current += txt;
        } else {
          interimText += txt;
        }
      }
      setInterim(interimText);

      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = setTimeout(() => {
        rec.stop();
      }, silenceMs);
    };

    rec.onerror = (ev) => {
      const err = (ev as unknown as { error?: string }).error ?? "speech error";
      setError(String(err));
    };

    rec.onend = () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      setListening(false);
      setInterim("");
      const finalText = finalBufferRef.current.trim();
      if (finalText) onFinal(finalText);
      finalBufferRef.current = "";
      recRef.current = null;
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [listening, lang, onFinal, silenceMs]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  useEffect(() => {
    return () => {
      stop();
    };
  }, [stop]);

  return { supported, listening, interim, error, start, stop, toggle };
}
