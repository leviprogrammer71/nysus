"use client";

import { useActionState, useState } from "react";
import { createProject } from "@/app/actions";
import { PROJECT_TEMPLATES } from "@/lib/templates";

const initialState = { ok: false, message: "" };

/**
 * New-project form + template picker. Pick a template to pre-seed the
 * character sheet and aesthetic bible; Dio opens the conversation with
 * something concrete to react to instead of an interview. Blank canvas
 * stays the default for anyone who wants to drive from zero.
 */
export function NewProjectForm() {
  const [state, formAction, pending] = useActionState(createProject, initialState);
  const [templateSlug, setTemplateSlug] = useState<string>("blank");

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <fieldset className="flex flex-col gap-2">
        <legend className="font-hand text-sepia-deep text-base">
          start from
        </legend>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {PROJECT_TEMPLATES.map((t) => {
            const active = templateSlug === t.slug;
            return (
              <li key={t.slug}>
                <label
                  className={`flex cursor-pointer flex-col gap-1 rounded-lg border p-3 animate-press animate-lift transition-colors ${
                    active
                      ? "border-ink bg-paper"
                      : "border-ink/15 bg-paper-deep hover:border-ink/30"
                  }`}
                >
                  <input
                    type="radio"
                    name="template"
                    value={t.slug}
                    checked={active}
                    onChange={() => setTemplateSlug(t.slug)}
                    className="sr-only"
                  />
                  <span className="font-display text-sm text-ink">
                    {t.name}
                  </span>
                  <span className="font-body text-xs text-ink-soft/80 leading-snug">
                    {t.blurb}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <label className="flex flex-col gap-2">
        <span className="font-hand text-sepia-deep text-base">title</span>
        <input
          name="title"
          required
          autoFocus
          maxLength={200}
          placeholder="I Don't Even Like You Tho"
          className="w-full rounded-none border border-ink/20 bg-paper-deep px-4 py-3 font-display text-2xl text-ink placeholder:text-ink-soft/30 focus:border-ink focus:outline-none transition-colors"
          disabled={pending}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className="font-hand text-sepia-deep text-base">
          description <span className="text-ink-soft/50">(optional)</span>
        </span>
        <textarea
          name="description"
          rows={3}
          maxLength={2000}
          placeholder="A short-form series exploring …"
          className="w-full resize-none rounded-none border border-ink/20 bg-paper-deep px-4 py-3 font-body text-ink placeholder:text-ink-soft/30 focus:border-ink focus:outline-none transition-colors"
          disabled={pending}
        />
      </label>

      <button
        type="submit"
        disabled={pending}
        className="mt-2 self-start rounded-full bg-ink px-5 py-2.5 font-body text-sm tracking-wide text-paper hover:bg-ink-soft disabled:cursor-wait disabled:opacity-60 animate-press"
      >
        {pending ? "Creating…" : "Create project →"}
      </button>

      {state.message && !state.ok ? (
        <p aria-live="polite" className="font-hand text-lg text-red-grease">
          {state.message}
        </p>
      ) : null}

      <p className="mt-2 font-body text-xs text-ink-soft/60 leading-relaxed">
        Templates pre-fill the character sheet and aesthetic bible.
        You&rsquo;ll refine both inside the project — Ari plans against
        whatever&rsquo;s in there and Mae builds from the same source of truth.
      </p>
    </form>
  );
}
