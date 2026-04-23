"use client";

import { useCallback, useState } from "react";

interface Profile {
  display_name: string | null;
  handle: string | null;
  bio: string | null;
  website: string | null;
}

export function ProfileForm({
  email,
  initialProfile,
}: {
  email: string;
  initialProfile: Profile;
}) {
  const [form, setForm] = useState<Profile>(initialProfile);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const set = <K extends keyof Profile>(key: K, value: Profile[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = useCallback(async () => {
    setError(null);
    setSaved(false);
    setBusy(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: form.display_name?.trim() || null,
          handle: form.handle?.trim() || null,
          bio: form.bio?.trim() || null,
          website: form.website?.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Save failed");
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [form]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
      className="space-y-5"
    >
      <Field label="Email">
        <input
          type="email"
          value={email}
          readOnly
          className="w-full rounded border border-ink/15 bg-paper-deep px-3 py-2 font-body text-ink/70"
        />
        <p className="mt-1 font-body text-[11px] text-ink-soft/60">
          Email is locked — rotate via the Supabase dashboard for now.
        </p>
      </Field>

      <Field
        label="Display name"
        hint="Shown as the author on gallery tiles."
      >
        <input
          value={form.display_name ?? ""}
          onChange={(e) => set("display_name", e.target.value)}
          maxLength={80}
          placeholder="Cassandra Okafor"
          className="w-full rounded border border-ink/20 bg-paper px-3 py-2 font-body text-ink focus:border-ink focus:outline-none"
        />
      </Field>

      <Field
        label="Handle"
        hint="Public username. Lowercase letters, digits, _ and -. 3–32 chars. Setting a handle lets your projects appear on the gallery."
      >
        <div className="flex items-center gap-0 overflow-hidden rounded border border-ink/20 bg-paper focus-within:border-ink">
          <span className="pl-3 font-body text-sm text-ink-soft/60">@</span>
          <input
            value={form.handle ?? ""}
            onChange={(e) =>
              set(
                "handle",
                e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
              )
            }
            maxLength={32}
            placeholder="cassandra"
            className="w-full bg-transparent px-2 py-2 font-body text-ink outline-none"
          />
        </div>
      </Field>

      <Field label="Bio" hint="Two or three sentences. 500 chars max.">
        <textarea
          value={form.bio ?? ""}
          onChange={(e) => set("bio", e.target.value)}
          maxLength={500}
          rows={3}
          placeholder="A director who makes short films about ritual and small rooms."
          className="w-full resize-none rounded border border-ink/20 bg-paper px-3 py-2 font-body text-ink focus:border-ink focus:outline-none"
        />
      </Field>

      <Field label="Website">
        <input
          type="url"
          value={form.website ?? ""}
          onChange={(e) => set("website", e.target.value)}
          maxLength={200}
          placeholder="https://your-portfolio.com"
          className="w-full rounded border border-ink/20 bg-paper px-3 py-2 font-body text-ink focus:border-ink focus:outline-none"
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3 pt-2">
        <button
          type="submit"
          disabled={busy}
          className="btn-primary disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
        {saved ? (
          <span className="font-body text-sm text-green-seal">Saved.</span>
        ) : null}
        {error ? (
          <span className="font-body text-sm text-red-grease" role="alert">
            {error}
          </span>
        ) : null}
      </div>
    </form>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block font-body text-[11px] uppercase tracking-[0.18em] text-ink-soft/80">
        {label}
      </span>
      {children}
      {hint ? (
        <p className="mt-1 font-body text-[11px] text-ink-soft/65">{hint}</p>
      ) : null}
    </label>
  );
}
