import { envStatus } from "@/lib/env";
import { Logomark } from "@/app/components/logomark";

export const metadata = {
  title: "Setup · Nysus",
};

// No session required — middleware explicitly allows /setup through
// so the user can see what's missing before Supabase is configured.

const ROWS: Array<{ key: keyof ReturnType<typeof envStatus>; label: string; phase: string; note?: string }> = [
  { key: "supabase_url", label: "NEXT_PUBLIC_SUPABASE_URL", phase: "Phase 1" },
  { key: "supabase_anon_key", label: "NEXT_PUBLIC_SUPABASE_ANON_KEY", phase: "Phase 1" },
  { key: "supabase_service_role", label: "SUPABASE_SERVICE_ROLE_KEY", phase: "Phase 1" },
  { key: "allowed_email", label: "ALLOWED_EMAIL", phase: "Phase 1", note: "your email — magic-link gate" },
  { key: "app_url", label: "NEXT_PUBLIC_APP_URL", phase: "Phase 1", note: "http://localhost:3000 in dev" },
  { key: "openrouter", label: "OPENROUTER_API_KEY", phase: "Phase 3" },
  { key: "replicate", label: "REPLICATE_API_TOKEN", phase: "Phase 4" },
  { key: "cron_secret", label: "CRON_SECRET", phase: "Phase 4" },
  { key: "critique_mode_on_demand", label: "CRITIQUE_MODE=on_demand", phase: "Phase 6" },
];

export default function SetupPage() {
  const status = envStatus();

  return (
    <main className="min-h-screen flex flex-col px-6 py-10 max-w-2xl mx-auto w-full">
      <header className="flex flex-col items-center gap-3 text-center mb-10">
        <Logomark size={80} priority animated />
        <h1 className="font-display text-4xl tracking-[0.2em] text-ink">
          NYSUS
        </h1>
        <p className="font-hand text-xl text-ink-soft">
          <span className="highlight">setup</span> &mdash; env not yet configured
        </p>
      </header>

      <div className="rule-ink mb-8" />

      <section className="mb-10 space-y-4">
        <p className="font-body text-ink leading-relaxed">
          Nysus needs Supabase + OpenRouter + Replicate to work. Each phase
          unlocks as its env vars land. Copy <code className="font-mono text-sm">.env.example</code> to{" "}
          <code className="font-mono text-sm">.env.local</code>, fill in the values, and restart dev.
        </p>
        <p className="font-hand text-base text-sepia-deep">
          see <code className="font-mono text-sm">PROGRESS.md</code> &rarr; &ldquo;Environment checklist&rdquo; for where each value comes from
        </p>
      </section>

      <section className="mb-10">
        <h2 className="font-hand text-xl text-sepia-deep mb-3">status</h2>
        <ul className="bg-paper-deep divide-y divide-ink/10">
          {ROWS.map((row) => {
            const ok = status[row.key];
            return (
              <li
                key={row.key}
                className="flex items-center justify-between px-4 py-3 gap-3"
              >
                <div className="min-w-0">
                  <code className="font-mono text-sm text-ink">{row.label}</code>
                  <div className="flex gap-2 items-center mt-1">
                    <span className="font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
                      {row.phase}
                    </span>
                    {row.note ? (
                      <span className="font-hand text-sm text-ink-soft">
                        {row.note}
                      </span>
                    ) : null}
                  </div>
                </div>
                <span
                  className={`font-hand text-lg shrink-0 ${ok ? "text-ink-soft" : "text-red-grease"}`}
                >
                  {ok ? "✓ set" : "missing"}
                </span>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="mb-10">
        <h2 className="font-hand text-xl text-sepia-deep mb-3">
          Supabase quickstart
        </h2>
        <ol className="list-decimal list-inside space-y-2 font-body text-ink leading-relaxed">
          <li>
            Create a project at{" "}
            <a
              href="https://supabase.com/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-ink-soft"
            >
              supabase.com/dashboard
            </a>
          </li>
          <li>
            Settings → API → copy <code className="font-mono text-sm">Project URL</code>, <code className="font-mono text-sm">anon</code> key, <code className="font-mono text-sm">service_role</code> key into{" "}
            <code className="font-mono text-sm">.env.local</code>
          </li>
          <li>
            SQL Editor → paste <code className="font-mono text-sm">supabase/migrations/0001_init.sql</code> → Run
          </li>
          <li>
            Authentication → URL Configuration → add{" "}
            <code className="font-mono text-sm">http://localhost:3000/auth/callback</code> (and your prod URL) as a redirect
          </li>
          <li>
            Set <code className="font-mono text-sm">ALLOWED_EMAIL</code> to your email, restart <code className="font-mono text-sm">npm run dev</code>
          </li>
        </ol>
      </section>

      <footer className="mt-4 flex items-center gap-3 text-[10px] uppercase tracking-[0.2em] text-ink-soft/60 font-body">
        <span className="inline-block w-6 h-px bg-ink/30" />
        <span>after Dionysus</span>
        <span className="inline-block w-6 h-px bg-ink/30" />
      </footer>
    </main>
  );
}
