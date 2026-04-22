"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

const initialState = { ok: false, message: "" };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="w-full flex flex-col gap-4">
      <label className="flex flex-col gap-2">
        <span className="font-hand text-sepia-deep text-base">email</span>
        <input
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          className="w-full h-12 px-4 bg-paper-deep border border-ink/20 rounded-none font-body text-ink focus:outline-none focus:border-ink placeholder:text-ink-soft/40 transition-colors"
          disabled={pending}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-hand text-sepia-deep text-base">password</span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          minLength={6}
          placeholder="at least 6 characters"
          className="w-full h-12 px-4 bg-paper-deep border border-ink/20 rounded-none font-body text-ink focus:outline-none focus:border-ink placeholder:text-ink-soft/40 transition-colors"
          disabled={pending}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="w-full h-12 px-4 bg-ink text-paper font-body tracking-wide hover:bg-ink-soft disabled:opacity-60 disabled:cursor-wait transition-colors text-left flex justify-between items-center"
      >
        <span>{pending ? "Signing in…" : "Sign in"}</span>
        <span aria-hidden>&rarr;</span>
      </button>

      {state.message ? (
        <p
          aria-live="polite"
          className={`font-hand text-lg ${
            state.ok ? "text-ink-soft" : "text-red-grease"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <p className="font-body text-xs text-ink-soft/60 leading-relaxed">
        This app is single-user. Only the email configured as{" "}
        <code className="font-mono text-[11px]">ALLOWED_EMAIL</code> can sign in.
        First sign-in sets your password; later sign-ins validate it. No emails
        are ever sent.
      </p>
    </form>
  );
}
