"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "Script mode" dictation — unlimited duration, recognizes voice
 * commands to structure long-form input.
 *
 * Recognized commands (spoken during recording):
 *   - "new shot"        inserts a shot break marker
 *   - "scratch that"    deletes the last sentence from the transcript
 *   - "send to Claude"  ends recording and calls `onSubmit(finalText)`
 *   - "character note:" prefixes the following line with that tag
 *
 * Commands are detected case-insensitively and removed from the final
 * transcript (they shouldn't end up in Claude's prompt). The UI layer
 * renders `transcript` + `interim` while recording; on submission the
 * caller typically sends the result with a system hint like:
 *
 *     "User dictated this aloud, may contain transcription errors —
 *      interpret generously, ask clarifying questions if ambiguous."
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

/** Strip trailing sentence from a string. */
function dropLastSentence(s: string): string {
  const t = s.trimEnd();
  // Find the nearest sentence terminator.
  const idx = Math.max(
    t.lastIndexOf(". "),
    t.lastIndexOf("! "),
    t.lastIndexOf("? "),
    t.lastIndexOf("\n"),
  );
  return idx > 0 ? t.slice(0, idx + 1).trimEnd() : "";
}

/**
 * Process a chunk of final text for recognized commands. Returns the
 * remaining text (commands stripped) plus any side-effect signals.
 */
function processCommands(
  incoming: string,
  current: string,
): { next: string; shouldSubmit: boolean } {
  let text = current;
  const lower = incoming.toLowerCase();

  // Greedy: handle multiple commands in one chunk.
  let out = "";
  let i = 0;
  const tokens = lower;
  const original = incoming;
  let origIdx = 0;

  const commitTo = (end: number) => {
    out += original.slice(origIdx, end);
    origIdx = end;
  };

  while (i < tokens.length) {
    if (tokens.startsWith("new shot", i)) {
      commitTo(i);
      text = (text + out + "\n\n— NEW SHOT —\n\n").trimStart();
      out = "";
      i += "new shot".length;
      origIdx = i;
      continue;
    }
    if (tokens.startsWith("scratch that", i)) {
      commitTo(i);
      const combined = (text + out).trimEnd();
      text = dropLastSentence(combined);
      out = "";
      i += "scratch that".length;
      origIdx = i;
      continue;
    }
    if (tokens.startsWith("send to claude", i)) {
      commitTo(i);
      text = text + out;
      out = "";
      i += "send to claude".length;
      origIdx = i;
      return { next: text.trimEnd(), shouldSubmit: true };
    }
    if (tokens.startsWith("character note:", i) || tokens.startsWith("character note", i)) {
      commitTo(i);
      text = (text + out + "\n[CHARACTER NOTE] ").trimStart();
      out = "";
      const len = tokens.startsWith("character note:", i)
        ? "character note:".length
        : "character note".length;
      i += len;
      origIdx = i;
      continue;
    }
    i++;
  }
  commitTo(tokens.length);
  text = text + out;
  return { next: text, shouldSubmit: false };
}

export function useScriptDictation({
  onSubmit,
  lang = "en-US",
}: {
  onSubmit: (finalText: string) => void;
  lang?: string;
}) {
  const [supported] = useState(() => Boolean(getCtor()));
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);

  const recRef = useRef<SpeechRecognitionLike | null>(null);
  const transcriptRef = useRef("");
  const submittedRef = useRef(false);

  const stop = useCallback((submit: boolean) => {
    submittedRef.current = submit;
    recRef.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor || listening) return;

    setError(null);
    setTranscript("");
    setInterim("");
    transcriptRef.current = "";
    submittedRef.current = false;

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = lang;

    rec.onresult = (ev) => {
      let newInterim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        const chunk = r[0]?.transcript ?? "";
        if (r.isFinal) {
          const { next, shouldSubmit } = processCommands(
            chunk,
            transcriptRef.current,
          );
          transcriptRef.current = next;
          setTranscript(next);
          if (shouldSubmit) {
            submittedRef.current = true;
            rec.stop();
            return;
          }
        } else {
          newInterim += chunk;
        }
      }
      setInterim(newInterim);
    };

    rec.onerror = (ev) => {
      const err = (ev as unknown as { error?: string }).error ?? "speech error";
      setError(String(err));
    };

    rec.onend = () => {
      setListening(false);
      setInterim("");
      const finalText = transcriptRef.current.trim();
      if (submittedRef.current && finalText) onSubmit(finalText);
      recRef.current = null;
    };

    try {
      rec.start();
      recRef.current = rec;
      setListening(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [listening, lang, onSubmit]);

  useEffect(() => {
    return () => {
      recRef.current?.abort();
    };
  }, []);

  return { supported, listening, transcript, interim, error, start, stop };
}
