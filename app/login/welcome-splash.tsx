"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One-time full-screen welcome splash shown on first visit to /login.
 * Plays welcome.mp4 once, fades to the login form, persists a flag
 * in localStorage so returning users skip straight to sign-in.
 *
 * Tapping anywhere during playback skips — we don't hold users
 * hostage.
 */

const WELCOMED_KEY = "nysus:welcomed";
const HOLD_MS = 700; // visual hold after the video ends before fade
const FADE_MS = 500;

export function WelcomeSplash() {
  const [phase, setPhase] = useState<"waiting" | "playing" | "fading" | "done">(
    "waiting",
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Decide whether to play. One-shot bootstrap: read localStorage
  // once on mount, then flip phase. We use a ref-guarded effect so
  // React's linter is satisfied (no cascading re-renders) and the
  // server-render stays null to avoid hydration mismatch.
  const bootstrapped = useRef(false);
  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    let nextPhase: "playing" | "done" = "playing";
    try {
      if (typeof window !== "undefined") {
        nextPhase =
          window.localStorage.getItem(WELCOMED_KEY) === "1" ? "done" : "playing";
      }
    } catch {
      /* localStorage disabled — default to playing */
    }
    setPhase(nextPhase);
  }, []);

  const finish = useCallback(() => {
    setPhase("fading");
    try {
      window.localStorage.setItem(WELCOMED_KEY, "1");
    } catch {
      /* ignore */
    }
    setTimeout(() => setPhase("done"), FADE_MS);
  }, []);

  // Auto-play once phase enters "playing". Modern browsers allow
  // muted autoplay without a user gesture.
  useEffect(() => {
    if (phase !== "playing") return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {
      /* some browsers refuse — skip rather than hang */
      finish();
    });
  }, [phase, finish]);

  const handleEnded = useCallback(() => {
    setTimeout(finish, HOLD_MS);
  }, [finish]);

  const handleSkip = useCallback(() => {
    finish();
  }, [finish]);

  if (phase === "waiting" || phase === "done") return null;

  return (
    <div
      className={`fixed inset-0 z-[80] flex flex-col items-center justify-center bg-paper px-6 pt-safe pb-safe transition-opacity duration-[${FADE_MS}ms] ${
        phase === "fading" ? "opacity-0 pointer-events-none" : "opacity-100"
      }`}
      role="presentation"
      onClick={handleSkip}
    >
      <div className="relative w-[min(70vw,520px)] aspect-square">
        <video
          ref={videoRef}
          src="/video/welcome.mp4"
          poster="/video/welcome-poster.jpg"
          playsInline
          autoPlay
          muted
          onEnded={handleEnded}
          className="absolute inset-0 w-full h-full object-contain"
        />
      </div>
      <p className="mt-8 font-display text-4xl tracking-[0.2em] text-ink">
        NYSUS
      </p>
      <p className="mt-2 font-hand text-lg text-ink-soft">
        opening the notebook
      </p>
      <button
        type="button"
        onClick={handleSkip}
        className="mt-10 font-body text-[11px] uppercase tracking-widest text-ink-soft/60 hover:text-ink transition-colors"
      >
        tap to skip
      </button>
    </div>
  );
}
