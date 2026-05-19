"use client";

import { useActionState } from "react";
import { signIn } from "./actions";

const initialState = { ok: false, message: "" };

export function LoginForm({ returnTo }: { returnTo?: string }) {
  const [state, formAction, pending] = useActionState(signIn, initialState);

  return (
    <form action={formAction} className="w-full flex flex-col gap-5">
      {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}

      <label className="flex flex-col gap-2">
        <span className="font-hand text-[18px] text-[color:var(--color-sepia-deep)]">
          email
        </span>
        <input
          type="email"
          name="email"
          required
          autoFocus
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          className="field"
          disabled={pending}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-hand text-[18px] text-[color:var(--color-sepia-deep)]">
          password
        </span>
        <input
          type="password"
          name="password"
          required
          autoComplete="current-password"
          minLength={6}
          placeholder="at least 6 characters"
          className="field"
          disabled={pending}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="btn-ink w-full mt-1 flex items-center justify-between disabled:opacity-60 disabled:cursor-wait"
      >
        <span>{pending ? "the page turns…" : "Sign in"}</span>
        <span aria-hidden>⟶</span>
      </button>

      {state.message ? (
        <p
          aria-live="polite"
          className={`font-hand text-[18px] ${
            state.ok
              ? "text-[color:var(--color-sepia-deep)]"
              : "text-[color:var(--color-red-grease)]"
          }`}
        >
          {state.message}
        </p>
      ) : null}

      <p className="font-mono text-[10px] tracking-[0.22em] uppercase text-[color:var(--color-ink-soft)] leading-relaxed">
        first sign-in opens the notebook · no emails are sent
      </p>
    </form>
  );
}
