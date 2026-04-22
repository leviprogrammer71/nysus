"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * One-button opt-in for web push. Only renders when:
 *   - the browser has PushManager / serviceWorker
 *   - VAPID keys are configured on the server
 *   - the user hasn't already granted (or permanently denied)
 *
 * Registers /sw.js if it isn't already, subscribes, and posts the
 * subscription to /api/push/subscribe.
 */
export function PushOptIn() {
  // Feature detection in a lazy initializer so we don't set state from
  // inside the effect (react-hooks/set-state-in-effect) on mount.
  const [supported] = useState(
    () =>
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      "PushManager" in window &&
      "Notification" in window,
  );
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [state, setState] = useState<
    "idle" | "loading" | "subscribed" | "denied" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supported) return;
    (async () => {
      try {
        const res = await fetch("/api/push/subscribe", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as {
          configured: boolean;
          public_key: string | null;
        };
        if (body.configured && body.public_key) setPublicKey(body.public_key);
      } catch {
        /* ignore */
      }

      const reg = await navigator.serviceWorker.getRegistration("/");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) setState("subscribed");
      }
      if (Notification.permission === "denied") setState("denied");
    })();
  }, [supported]);

  const subscribe = useCallback(async () => {
    setError(null);
    setState("loading");
    try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState("denied");
        return;
      }
      const reg =
        (await navigator.serviceWorker.getRegistration("/")) ||
        (await navigator.serviceWorker.register("/sw.js"));
      if (!publicKey) throw new Error("Server has no VAPID public key.");

      const keyBytes = urlB64ToUint8Array(publicKey);
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        // Copy into a fresh ArrayBuffer so the TS dom types accept it
        // — PushManager.subscribe() wants BufferSource, and
        // Uint8Array<ArrayBufferLike> isn't assignable.
        applicationServerKey: new Uint8Array(keyBytes).buffer as ArrayBuffer,
      });

      const res = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: sub.endpoint,
          keys: {
            p256dh: arrayBufferToBase64Url(sub.getKey("p256dh")),
            auth: arrayBufferToBase64Url(sub.getKey("auth")),
          },
          user_agent: navigator.userAgent,
        }),
      });
      if (!res.ok) throw new Error(await res.text());
      setState("subscribed");
    } catch (err) {
      setState("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [publicKey]);

  if (!supported || !publicKey) return null;
  if (state === "subscribed") return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-ink/10 bg-paper-deep px-3 py-2">
      <span className="font-body text-xs text-ink-soft">
        Ping my phone when clips finish rendering?
      </span>
      <button
        type="button"
        onClick={subscribe}
        disabled={state === "loading" || state === "denied"}
        className="rounded-full border border-ink/25 bg-paper px-3 py-1 font-body text-[11px] uppercase tracking-widest text-ink hover:bg-ink/5 disabled:opacity-50"
      >
        {state === "denied"
          ? "Blocked in browser"
          : state === "loading"
          ? "Asking…"
          : "Turn on"}
      </button>
      {error ? (
        <span className="font-body text-[11px] text-red-grease" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function urlB64ToUint8Array(base64: string): Uint8Array {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
