"use client";

import { useActionState } from "react";
import { createProject } from "@/app/actions";

const initialState = { ok: false, message: "" };

export function NewProjectForm() {
  const [state, formAction, pending] = useActionState(createProject, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className="font-hand text-sepia-deep text-base">title</span>
        <input
          name="title"
          required
          autoFocus
          maxLength={200}
          placeholder="I Don't Even Like You Tho"
          className="w-full px-4 py-3 bg-paper-deep border border-ink/20 rounded-none font-display text-2xl text-ink focus:outline-none focus:border-ink placeholder:text-ink-soft/30 transition-colors"
          disabled={pending}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-hand text-sepia-deep text-base">
          description <span className="text-ink-soft/50">(optional)</span>
        </span>
        <textarea
          name="description"
          rows={4}
          maxLength={2000}
          placeholder="A short-form series exploring …"
          className="w-full px-4 py-3 bg-paper-deep border border-ink/20 rounded-none font-body text-ink focus:outline-none focus:border-ink placeholder:text-ink-soft/30 resize-none transition-colors"
          disabled={pending}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="self-start mt-2 px-5 py-2.5 bg-ink text-paper font-body tracking-wide hover:bg-ink-soft disabled:opacity-60 disabled:cursor-wait transition-colors"
      >
        {pending ? "Creating…" : "Create project →"}
      </button>

      {state.message && !state.ok ? (
        <p aria-live="polite" className="font-hand text-lg text-red-grease">
          {state.message}
        </p>
      ) : null}

      <p className="font-body text-xs text-ink-soft/60 mt-4 leading-relaxed">
        You can fill in the character sheet and aesthetic bible inside the
        project once it&rsquo;s created &mdash; they inject into every shot
        prompt Claude generates.
      </p>
    </form>
  );
}
