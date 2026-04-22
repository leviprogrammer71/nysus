/**
 * Env access — centralized + typed.
 *
 * Each getter validates lazily on first call so Phase 0 can render
 * without the full env being populated. Anything that reads env from
 * this module will throw a clear error if the variable is missing,
 * instead of silently undefined.
 */

function req(name: string, value: string | undefined, hint?: string): string {
  // Trim once on read so any stray whitespace from a copy-paste in
  // secrets.txt or .env.local can't silently break request URLs and
  // headers. Supabase URL leading-space bug (Apr 2026) lived here.
  const trimmed = (value ?? "").trim();
  if (trimmed.length === 0) {
    throw new Error(
      `Missing env var: ${name}${hint ? ` — ${hint}` : ""}. Check .env.local (see .env.example).`,
    );
  }
  return trimmed;
}

export const env = {
  // Server-side
  get REPLICATE_API_TOKEN() {
    return req("REPLICATE_API_TOKEN", process.env.REPLICATE_API_TOKEN);
  },
  get OPENROUTER_API_KEY() {
    return req("OPENROUTER_API_KEY", process.env.OPENROUTER_API_KEY);
  },
  get SUPABASE_SERVICE_ROLE_KEY() {
    return req("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY);
  },
  get CRON_SECRET() {
    return req("CRON_SECRET", process.env.CRON_SECRET);
  },
  get ALLOWED_EMAIL() {
    // Soft env now — the owner email gets premium budget caps. Not
    // required for the app to function.
    return (process.env.ALLOWED_EMAIL ?? "").toLowerCase().trim();
  },
  get OPENAI_API_KEY() {
    // Optional. When present, stills use OpenAI gpt-image-1;
    // otherwise we fall back to Replicate Flux.
    return (process.env.OPENAI_API_KEY ?? "").trim();
  },
  get CRITIQUE_MODE(): "on_demand" {
    const v = process.env.CRITIQUE_MODE ?? "on_demand";
    if (v !== "on_demand") {
      throw new Error(
        `CRITIQUE_MODE must be "on_demand" (got "${v}"). Auto-critique is considered a bug; see AGENTS.md.`,
      );
    }
    return v;
  },

  // Public (exposed to the client)
  get NEXT_PUBLIC_SUPABASE_URL() {
    return req("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL);
  },
  get NEXT_PUBLIC_SUPABASE_ANON_KEY() {
    return req("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  },
  get NEXT_PUBLIC_APP_URL() {
    return req(
      "NEXT_PUBLIC_APP_URL",
      process.env.NEXT_PUBLIC_APP_URL,
      "e.g. http://localhost:3000 in dev, https://nysus.media in prod",
    );
  },
};

/**
 * Non-throwing readiness checks. Use these BEFORE calling into
 * `env.*` getters when you want to show a setup page instead of a 500.
 *
 * Example: middleware.ts short-circuits when Supabase isn't configured
 * so Phase 0 verification still works with zero env.
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

export function envStatus() {
  return {
    supabase_url: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
    supabase_anon_key: Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    supabase_service_role: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    allowed_email: Boolean(process.env.ALLOWED_EMAIL),
    app_url: Boolean(process.env.NEXT_PUBLIC_APP_URL),
    replicate: Boolean(process.env.REPLICATE_API_TOKEN),
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    cron_secret: Boolean(process.env.CRON_SECRET),
    critique_mode_on_demand: (process.env.CRITIQUE_MODE ?? "on_demand") === "on_demand",
  };
}
