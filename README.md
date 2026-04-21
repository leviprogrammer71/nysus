# Nysus

> A filmmaker's notebook for chained AI video generation. Named after Dionysus — patron of theater, ecstatic vision, and the dissolving of boundaries.

Mobile-first PWA where you direct philosophical short-form video by conversation. Chat with Claude as your creative director, get back Seedance-ready shot prompts as inline cards, generate each clip, and every clip seeds its successor with its own last frame.

**Status**: feature-complete through Phase 9. See [`PROGRESS.md`](./PROGRESS.md) for phase-by-phase breakdown and deviations from the original brief.

---

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill in values (see below)
npm run dev                    # http://localhost:3000
```

If you open the app with no env set, you'll land on `/setup` which shows exactly which variables are missing and how to populate each one.

### Environment

Copy the template from `.env.example`. Staged in `secrets.txt` (gitignored): `REPLICATE_API_TOKEN`, `OPENROUTER_API_KEY`, Supabase service-role + anon JWTs. You supply:

- `NEXT_PUBLIC_SUPABASE_URL` — `https://<project-ref>.supabase.co`
- `NEXT_PUBLIC_APP_URL` — `http://localhost:3000` dev, `https://nysus.media` prod
- `ALLOWED_EMAIL` — the one email allowed to sign in
- `CRON_SECRET` — `openssl rand -hex 32`
- `CRITIQUE_MODE=on_demand`
- Optional: `SEEDANCE_MODEL` override

### Supabase setup

1. Create a project at supabase.com.
2. SQL Editor → run `supabase/migrations/0001_init.sql`.
3. Optionally run `supabase/seed/example_project.sql` after your first sign-in to get the _I Don't Even Like You Tho_ seed project.
4. Authentication → URL Configuration → add `http://localhost:3000/auth/callback` (and `https://nysus.media/auth/callback` for prod) to the allowed redirect list.

### Replicate webhooks in dev

Replicate's webhook can't reach `localhost`. For dev, either:

- Skip it and let the client poll: the app polls any non-terminal clip every 3 seconds and the poll endpoint itself pings Replicate, so clips resolve within ~3s of Replicate finishing. Works fine in dev. **Just don't change anything.**
- Or tunnel: `ngrok http 3000`, then set `NEXT_PUBLIC_APP_URL=https://<subdomain>.ngrok.app` and restart dev.

---

## Stack

- **Next.js 16** App Router + TypeScript
- **Tailwind v4** with the Director's Desk design system (see `app/globals.css`)
- **Supabase** — Postgres + Storage + magic-link auth
- **Replicate** — ByteDance Seedance 2.0 for video generation
- **OpenRouter** — Claude streaming SSE (default `anthropic/claude-opus-4`), including vision for critique
- **FFmpeg.wasm** — client-side last-frame extraction, sample-frame sampling, final stitch
- **Vercel** — hosting + cron (`/api/clips/pending` every minute as the webhook fallback)

---

## Feature map

| Area | What works |
| :--- | :--- |
| Auth | Magic link gated to `ALLOWED_EMAIL` at 3 layers. Service-role key stays server-side. |
| Projects | List / create / delete. Per-project character sheet + aesthetic bible editable as JSON at `/projects/[id]/edit`. |
| Chat | Streaming SSE from OpenRouter. Director system prompt. `PROJECT CONTEXT` injected on every user turn. Messages persist to Supabase. |
| Shot prompts | `json-shot` code blocks in the chat stream render as inline cards with a Generate button. |
| Generation | Seedance predictions with webhook callback. Auto-seed from prior clip's last frame. Regenerate / delete / cancel in-flight predictions. |
| Continuity | FFmpeg.wasm extracts `last.jpg` + three sample frames the first time you open a completed clip. |
| Critique | "Consult the chorus" sends the 3 sample frames + prompt to Claude with vision. On-demand only — never automatic. |
| Voice | Web Speech dictation on the chat input (Chrome + Safari). 2s silence auto-stops; finalized text appends to the draft. |
| Stitch | `/projects/[id]/stitch` — reorder, export. Client-side FFmpeg.wasm concat, direct MP4 download. |
| PWA | Manifest, theme color, install prompt on second visit, haptic feedback on key actions. |
| Error UX | Global error boundary (`the reel jammed`), 404 (`cut`), setup landing when env is missing. |

---

## Route map

```
/                             projects list (auth)
/login                        magic-link form
/setup                        env checklist (pre-auth, only when Supabase unconfigured)
/projects/new                 create
/projects/[id]                workspace: chat + timeline + sheets
/projects/[id]/edit           title / description / character sheet / bible
/projects/[id]/stitch         reorder + export MP4

/api/chat                     POST streaming chat SSE
/api/generate                 POST create Replicate prediction
/api/clips/[id]               GET status (proactively refreshes from Replicate) / DELETE
/api/clips/[id]/regenerate    POST
/api/clips/[id]/frames        POST multipart (last + sample_0..2)
/api/clips/[id]/critique      POST — on-demand only
/api/clips/[id]/signed-url    GET — signs video / last_frame / sampled_N
/api/clips/pending            GET — Vercel cron, checks stuck predictions
/api/replicate/webhook        POST — signed via ?secret=CRON_SECRET
/api/projects/[id]            PATCH — update sheet/bible/metadata
/api/auth/magic-link          (handled as a server action inside /login)
/auth/callback                GET — code→session exchange + second ALLOWED_EMAIL check
/auth/signout                 POST
```

---

## Design system quick reference

Cream paper (`#F5EFE0`) + navy ink (`#1B2A3A`) with a Dionysian wine-dark accent (`#5B1A2B`) reserved for brand moments. Highlighter yellow (`#E8D27A`) for the one keyword per screen title. `.hand` font (Caveat) for margin notes and live voice transcripts. JetBrains Mono for prompt text and code. Everything else is Inter (body) or Cormorant Garamond (display).

Palette tokens in Tailwind:

```
bg-paper / bg-paper-deep
text-ink / text-ink-soft
text-sepia / text-sepia-deep / bg-highlight
text-wine-dark        <- sparingly, brand only
text-red-grease       <- errors + critique only
```

---

## Security

- `.env.local` and `secrets.txt` are gitignored. Always scan staged diffs before pushing.
- `ALLOWED_EMAIL` enforced at: login server action → magic-link callback → middleware on every request.
- Service-role key imported only by `lib/supabase/server.ts` (`createServiceRoleClient`) and never exposed to the client.
- Replicate webhook authenticated via `CRON_SECRET` in the query string; cron endpoint authenticated via `Authorization: Bearer CRON_SECRET`.
- Storage bucket `clips` is private; URLs are re-signed on demand with 1-hour TTL.
- CRITIQUE_MODE must equal `on_demand`; the critique endpoint refuses to run otherwise. No auto-critique pathway exists.

---

## Deploy

1. `vercel link` this folder to a new Vercel project.
2. Vercel → Settings → Environment Variables: paste everything from `.env.local` (don't forget `CRON_SECRET` — Vercel Cron will send this automatically as a Bearer token).
3. Vercel → Domains → add `nysus.media` (apex + `www`), follow DNS.
4. In Supabase Authentication, add `https://nysus.media/auth/callback` to allowed redirects.
5. `vercel --prod`.
