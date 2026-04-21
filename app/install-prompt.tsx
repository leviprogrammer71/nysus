"use client";

import { useEffect, useState } from "react";

/**
 * PWA install nudge. Shows a one-time toast on the second+ visit if
 * the browser has fired `beforeinstallprompt` and the app isn't
 * already installed. Dismissals persist in localStorage.
 */

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "nysus:pwa-prompt-dismissed";
const VISIT_KEY = "nysus:visits";

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Track visits locally — never leaves the device.
    try {
      const visits = Number(localStorage.getItem(VISIT_KEY) ?? "0") + 1;
      localStorage.setItem(VISIT_KEY, String(visits));
    } catch {
      /* ignore */
    }

    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      // Only nudge on second visit or later.
      const visits = Number(localStorage.getItem(VISIT_KEY) ?? "1");
      if (visits >= 2) setVisible(true);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    return () =>
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
  }, []);

  if (!visible || !deferred) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-40 sm:left-auto sm:right-4 sm:w-80 bg-paper border border-ink/30 shadow-lg px-4 py-3 flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-hand text-lg text-ink leading-tight">
          install nysus
        </p>
        <p className="font-body text-sm text-ink-soft mt-1 leading-snug">
          Add to your home screen for full-screen, offline-friendly directing.
        </p>
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        <button
          type="button"
          onClick={async () => {
            try {
              await deferred.prompt();
              await deferred.userChoice;
            } finally {
              setVisible(false);
              localStorage.setItem(DISMISS_KEY, "1");
            }
          }}
          className="px-3 py-1 bg-ink text-paper font-body text-xs tracking-wide hover:bg-ink-soft transition-colors"
        >
          install
        </button>
        <button
          type="button"
          onClick={() => {
            localStorage.setItem(DISMISS_KEY, "1");
            setVisible(false);
          }}
          className="px-3 py-1 bg-paper border border-ink/30 text-ink-soft font-body text-xs tracking-wide hover:border-ink hover:text-ink transition-colors"
        >
          later
        </button>
      </div>
    </div>
  );
}
