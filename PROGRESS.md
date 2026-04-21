# Nysus — Build Progress

> Persistent memory across sessions. Any agent resuming work reads this file **first**, then `git log --oneline -20`, then tries `npm run dev`. Do **not** restart from Phase 0 if this file says Phase 0 is complete.

---

## Current state

| Phase | Name | Status |
| :---- | :--- | :----- |
| 0     | Scaffold | **committed** |
| 1     | Auth + Supabase | **committed** |
| 2     | Design system + illustrations | design system ✓ · illustrations deferred to user (Flux batch) |
| 3     | Chat with Claude | **committed** |
| 4     | Seedance generation | **committed** |
| 5     | Continuity system | **committed** |
| 6     | On-demand critique (_"Consult the chorus"_) | **committed** |
| 7     | Voice input | **committed** (quick dictation — long-form script mode deferred) |
| 8     | Stitch / export | **committed** |
| 9     | Polish | **committed** |

---

## Phase 0 — Scaffold

Status: **committed — awaiting user verification**
Last action: Committed Phase 0 on branch `main`. Working tree clean, git fsck clean, no secret patterns in the staged diff (checked before commit).
Next action: User runs `npm install && npm run dev` locally. Because Phase 1 is also committed, running dev without Supabase env will land on the **`/setup`** page (by design — middleware short-circuits to `/setup` until Supabase env is populated). Phase 0 visual check is still valid there: cream bg, navy wordmark, Caveat highlight on "setup", thin rule, "after Dionysus" footer. If those render, scaffold is good.
Blockers: None on my side. **User verification required** (see _How to verify Phase 0 + 1_ below).

---

## Phase 1 — Auth + Supabase

Status: **committed — awaiting user verification**
Last action: Wrote the full schema migration, the "I Don't Even Like You Tho" seed project, typed Supabase client helpers (browser / server / service-role), magic-link login with ALLOWED_EMAIL gate at three layers, middleware-based session refresh, and projects CRUD (list / new / detail stub).
Next action: User creates Supabase project, runs `supabase/migrations/0001_init.sql` in the SQL editor, sets Auth redirect URL to `<APP_URL>/auth/callback`, populates `.env.local`, restarts dev. Sign in with magic link, create a project, see it at `/`. Optionally run `supabase/seed/example_project.sql` to bootstrap the example series.
Blockers: Supabase env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ALLOWED_EMAIL`, `NEXT_PUBLIC_APP_URL`) need to be set before Phase 1 routes will boot — without them, every request 302s to `/setup`.

Files added:

- `supabase/migrations/0001_init.sql` — projects, clips, messages; RLS on all three (auth.uid() = user_id direct or joined); storage bucket `clips`; `touch_updated_at` trigger
- `supabase/seed/example_project.sql` — "I Don't Even Like You Tho" with David + Maya character sheet + aesthetic bible
- `lib/env.ts` — typed env getters (throw on missing) + `envStatus()` / `isSupabaseConfigured()` for graceful degradation
- `lib/auth.ts` — `isAllowedEmail` / `assertAllowedEmail`
- `lib/projects.ts` — Zod input schema for project CRUD
- `lib/shot-prompt.ts` — Zod schema + `extractShotPrompts` for the Phase-3 `json-shot` parser (shipped early so types line up)
- `lib/supabase/types.ts` — hand-typed `Database` (regenerate via `supabase gen types` once project is live)
- `lib/supabase/client.ts` — browser client (`createBrowserClient`)
- `lib/supabase/server.ts` — cookies-aware server client + service-role client
- `lib/supabase/middleware.ts` — session refresh helper
- `middleware.ts` — root middleware: short-circuit to `/setup` if Supabase unconfigured, otherwise require session + ALLOWED_EMAIL, bounce signed-in users away from `/login`
- `app/setup/page.tsx` — env-status landing with per-phase checklist and Supabase quickstart
- `app/login/{page,login-form,actions}.tsx` — magic-link form (server action), ALLOWED_EMAIL gate at send time
- `app/auth/callback/route.ts` — exchange code for session, second ALLOWED_EMAIL check, sign out + redirect if mismatch
- `app/auth/signout/route.ts` — POST-only signout
- `app/actions.ts` — `createProject`, `deleteProject` server actions
- `app/page.tsx` — replaced placeholder with authenticated projects list + empty state
- `app/projects/new/{page,new-project-form}.tsx` — title + description form
- `app/projects/[id]/page.tsx` — workspace stub with timeline / chat placeholders (real impl in Phase 3/4) + character sheet + aesthetic bible panels

Security posture:

- ALLOWED_EMAIL enforced at three layers: login server action, `/auth/callback` post-exchange, middleware on every request.
- Service-role key only imported by server files; never exposed to browser.
- `/setup` is the only unauthenticated route once env is configured; middleware redirects signed-out users to `/login` (and Phase-1-unconfigured to `/setup`).
- RLS policies cover select / insert / update / delete on all three tables.

---

## Phase 3 — Chat with Claude

Status: **committed — awaiting user verification**
Last action: Director system prompt + OpenRouter streaming client + `/api/chat` SSE route with user-message persistence pre-stream and assistant-message persistence post-stream. Replaced the chat placeholder in the workspace with a live streaming chat panel that renders markdown via `react-markdown` and replaces `json-shot` code blocks with inline `ShotCard` components (Generate button disabled until Phase 4).
Next action: User adds `OPENROUTER_API_KEY` to `.env.local` (already in `secrets.txt`), runs `npm install` to pick up `react-markdown` + `remark-gfm`, restarts dev, sends a test message inside a project.
Blockers: OpenRouter API key. Model slug `anthropic/claude-opus-4` is the current default — **verify before shipping** (see the _Pre-flight model verification_ note in § Deviations).

Files added:

- `lib/prompts/director.ts` — `DIRECTOR_SYSTEM_PROMPT` from the brief plus `buildProjectContextSuffix()` that formats the per-turn PROJECT CONTEXT suffix
- `lib/openrouter.ts` — typed `streamChatCompletion()` + tolerant `parseOpenRouterStream()` async generator (handles multi-byte chunk splits + `[DONE]` sentinel)
- `app/api/chat/route.ts` — POST handler that loads project (RLS-gated), loads history (last 40 messages), persists user message, streams Claude back to client, persists assistant message on stream close
- `app/projects/[id]/chat/chat-panel.tsx` — client component with optimistic user message, streaming assistant bubble with blinking cursor, auto-scroll, Stop button, error bubble, disabled voice-input stub (lights up in Phase 7)
- `app/projects/[id]/chat/message.tsx` — `MessageBubble` that splits assistant content at `json-shot` fences and renders `ShotCard` inline
- `app/projects/[id]/chat/shot-card.tsx` — the inline Generate-button card (button disabled in Phase 3)
- `app/globals.css` — `.prose-nysus` class: minimal markdown styling that respects the Director's Desk palette instead of import­ing a full `prose` stack

Key decisions:

- **PROJECT CONTEXT is re-injected on every user turn**, not stored in the DB with the message. That way edits to the character sheet or aesthetic bible propagate to the entire historical conversation immediately, rather than baking stale context into old messages.
- **User message persists before the stream starts.** If OpenRouter fails, the user's input stays in the transcript so they can retry without re-typing. The assistant message only persists after stream close (we accumulate on the server).
- **Server runtime is `nodejs`** (not edge) for Supabase + robust fetch streaming. The brief's later phases (Phase 4 FFmpeg.wasm sampling, Phase 6 vision critique) will keep this runtime.
- **No vision yet.** The `OpenRouterMessage` union includes the multipart image shape but Phase 3 only sends plain text. Vision wires up in Phase 6 when you tap _Consult the chorus_.
- **react-markdown is an intentional add** instead of hand-rolling markdown. Claude's streaming responses use headings, bold, and lists freely; reimplementing that correctly would cost more than the ~30KB dep.

---

## Phase 4 — Seedance generation

Status: **committed**

- `lib/replicate.ts` — typed REST wrapper for `/v1/predictions`: `createPrediction`, `getPrediction`, `cancelPrediction`, `fetchReplicateOutputAsBlob` for mirroring signed output URLs into our own storage.
- `lib/seedance.ts` — Zod input schema + `buildSeedanceInput` adapter. Default model `bytedance/seedance-1-pro`, overridable via `SEEDANCE_MODEL` env (slug still subject to verification).
- `lib/clips.ts` — `mirrorPredictionToClip` (used by both webhook and cron fallback) downloads the prediction output, uploads to the `clips` bucket at `{project}/{clip}/video.mp4`, updates status → `complete` / `failed`. `refreshClipFromReplicate` is the idempotent "ask Replicate and sync" helper.
- `app/api/generate/route.ts` — POST. Computes next `order_index`, inserts queued clip, creates prediction, stores `replicate_prediction_id`, returns clip id to the client. Webhook URL carries the clip id + CRON_SECRET.
- `app/api/replicate/webhook/route.ts` — authenticated by `?secret=CRON_SECRET`. Mirrors to storage + updates row. Prediction-id mismatch returns 409.
- `app/api/clips/pending/route.ts` — Vercel Cron handler, runs every minute. Polls any queued/processing clip older than 60s and pushes it through the mirror. Auth via `Authorization: Bearer CRON_SECRET` (Vercel sends this automatically) or `?secret=`.
- `app/api/clips/[id]/route.ts` — GET polls the row and proactively refreshes from Replicate when pending. DELETE cancels the prediction, wipes storage, and removes the row.
- `app/api/clips/[id]/regenerate/route.ts` — POST replaces the current clip in-place with a new prediction (same prompt + seed).
- `app/api/clips/[id]/signed-url/route.ts` — GET returns a 1-hour signed URL for `video`, `last_frame`, or `sampled_0..2`.
- `app/projects/[id]/workspace.tsx` — owns clip state for the whole project page. Client polls every 3s for any non-terminal clip; the poll endpoint pushes refreshes into Replicate, so dev without a webhook tunnel still lands on the final state within a poll cycle.
- `app/projects/[id]/timeline/*` — Timeline (horizontal scroll), ClipCard (thumbnail + status badge), ClipDetailSheet (video player + actions: regenerate / change seed / Consult the chorus / delete).
- `vercel.json` — `*/1 * * * *` cron hitting `/api/clips/pending`.

## Phase 5 — Continuity system

Status: **committed**

- `lib/ffmpeg.ts` — lazy FFmpeg.wasm loader (single-threaded build from unpkg, no SharedArrayBuffer requirement), `extractFrames(video, times)`, `concatMp4s(clips)`.
- `app/projects/[id]/timeline/use-frame-extraction.ts` — one-time hook that fires when a completed clip is opened. Extracts ~1s / mid / end frames, POSTs them as multipart to `/api/clips/[id]/frames`, then updates the parent state so the next Generate seeds from the fresh `last_frame_url`.
- `app/api/clips/[id]/frames/route.ts` — accepts the multipart payload, uploads each JPG into the clips bucket, signs short URLs, stores them on the clip row.
- Workspace auto-seed flow: on Generate, the workspace reads the most-recent completed clip's `last_frame_url` and passes it to `/api/generate` with `seed_source: "auto"`. Manual scrubber override is a stub (TODO: Phase 5.5) — "change seed frame" button currently shows a note.

## Phase 6 — On-demand critique ("Consult the chorus")

Status: **committed**

- `app/api/clips/[id]/critique/route.ts` — POST. Gated by `CRITIQUE_MODE=on_demand` (returns 500 otherwise). Signs the 3 stored sample frames, builds a vision request to OpenRouter using the director prompt + project context + `{type: "image_url"}` blocks, buffers the response, persists the critique as an assistant message in the project's chat history so it shows up the next time you open the transcript.
- "Consult the chorus" button in `ClipDetailSheet` calls it, renders the result inline in a `the chorus says` card.
- Frame sampling is silent — it happens via `useFrameExtraction` on clip open and stays local + stored silently. **No Claude call ever happens on clip completion.** If a future contributor wires auto-critique, this is a bug (see `AGENTS.md`).

## Phase 7 — Voice input

Status: **committed** (quick dictation). Long-form "script mode" with voice commands deferred.

- `lib/use-dictation.ts` — `useDictation` hook wrapping `(webkit)SpeechRecognition`. Continuous + interimResults; 2-second silence auto-stops; `onFinal` callback appends the finalized text to the input.
- Chat panel mic button: disabled on unsupported browsers (Firefox, older Safari) with a clear tooltip. Pulses in `wine-dark` while listening. Haptic buzz on tap. Live interim transcript below the input in handwritten type.

## Phase 8 — Stitch / export

Status: **committed**

- `app/projects/[id]/stitch/page.tsx` + `stitch-view.tsx` — lists clips in order with up/down reorder arrows, shows ready vs skipped counts, `Export MP4` button pulls signed URLs, hands blobs to `concatMp4s`, and triggers a download of `<project>-stitched.mp4`.
- All client-side — nothing round-trips through the server during stitching.

## Phase 9 — Polish

Status: **committed**

- `app/error.tsx` — global error boundary with "the reel jammed" copy + Try again / Home.
- `app/not-found.tsx` — "cut" empty state.
- `app/install-prompt.tsx` — `beforeinstallprompt` listener, shows on second visit, dismissal persists in localStorage, wired into root layout.
- Haptic feedback on Send (light tap) and Generate (pattern).
- Typography/empty-state pass consistent across projects list, setup, login, workspace, stitch.
- `next.config.ts` — security headers (CSP-adjacent set: `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options`).
- Project edit page at `/projects/[id]/edit` with title / description / character_sheet JSON / aesthetic_bible JSON — backed by PATCH `/api/projects/[id]`.

Files touched:

- `package.json` — renamed to `nysus`, added `typecheck` script
- `.gitignore` — hardened (`.env.*`, `secrets.txt`, `*.secrets`, editor/OS dirs)
- `.env.example` — canonical env template (new)
- `app/layout.tsx` — Cormorant Garamond + Inter + Caveat + JetBrains Mono, manifest + viewport theme-color
- `app/page.tsx` — Nysus placeholder
- `app/globals.css` — Tailwind v4 `@theme inline` with full Director's Desk palette + typography + motion tokens
- `app/icon.png`, `app/favicon.ico` — placeholder N-mark
- `public/manifest.webmanifest` — PWA manifest
- `public/icons/icon-{192,512,maskable,favicon-32}.png` — placeholder icons (replaced in Phase 2)
- `public/{next,vercel,window,file,globe}.svg` — neutralized (empty SVG; fuse mount wouldn't let me delete in sandbox)

### Deviations from the brief (flagged for user approval)

1. **Next.js 16, not 15.** `create-next-app@latest` pulls Next 16.2.4 with Tailwind v4. App Router is unchanged; this is backward-compatible. Keep, or downgrade?
2. **`next-pwa` deferred to Phase 9.** It has known incompatibilities with Next 16 App Router. Phase 0 ships a static `manifest.webmanifest` + theme-color meta (the 80% of PWA that matters). Full service-worker setup is more appropriate next to the "completed state" polish anyway.
3. **Illustrations skipped in Phase 2** per your instruction. Placeholder "N" icons used for PWA icons + favicon. Real Flux 1.1 Pro batch still documented in the brief; you can trigger it separately.
4. **Critique button label** will be `Consult the chorus` when Phase 6 lands, per your tweak.
5. **Pre-flight model verification skipped** per your instruction. Before Phase 3/4 we'll use these defaults; verify with me before cutover:
   - Replicate Seedance 2.0 slug: `bytedance/seedance-2-0` (assumed — **verify before Phase 4**)
   - OpenRouter Claude model ID: `anthropic/claude-opus-4` (assumed — **verify before Phase 3**)
6. **`npm install` not run in the sandbox.** The virtiofs mount I'm working through has rename/rm permission glitches mid-install that corrupt `node_modules`. You run `npm install` on your Mac where it'll work. Your machine is also where `next dev` actually renders — this sandbox doesn't forward localhost to you anyway.

---

## How to verify Phase 0 + 1 on your machine

### Step 1 — install and boot

```bash
cd /Users/becareful/Movies/Nysus
npm install
npm run typecheck
npm run build
npm run dev          # http://localhost:3000
```

### Step 2 — Phase 0 visual (zero env needed)

Without any env set, the middleware redirects everything to `/setup`. You should see:

- Cream (`#F5EFE0`) page background
- Navy (`#1B2A3A`) Cormorant "NYSUS" wordmark with letter-spacing
- Handwritten tagline in Caveat with a yellow highlighter streak
- "after Dionysus" footer in small caps
- A status table showing which env vars are missing, and a numbered Supabase quickstart

If the design system renders correctly there, Phase 0 is green.

### Step 3 — Phase 1 setup

1. Create a Supabase project (see the quickstart on `/setup`).
2. Copy `.env.example` to `.env.local` and fill in the Supabase + app values. Use the tokens staged in `secrets.txt` for Replicate / OpenRouter / the two Supabase JWTs.
3. In the Supabase SQL editor, paste and run `supabase/migrations/0001_init.sql`.
4. In Supabase → Authentication → URL Configuration, add `http://localhost:3000/auth/callback` (and `https://nysus.media/auth/callback` once you have prod) as an allowed redirect.
5. Restart `npm run dev`.

### Step 4 — Phase 1 visual + flow

- `/` should now 302 to `/login`.
- Sign in with your email; magic link lands in your inbox.
- Clicking the link redirects to `/auth/callback` and then `/`, which now shows the empty-projects state (the "∅" + "the notebook is empty" copy).
- Tap "+ new →", create a project ("I Don't Even Like You Tho" is fine), land on the workspace stub with timeline / chat placeholders + character sheet + aesthetic bible panels.
- Optionally run `supabase/seed/example_project.sql` to get the David/Maya seed project populated.

If all that works, Phase 1 is green.

### Step 5 — Phase 3 chat

1. Add `OPENROUTER_API_KEY` (from `secrets.txt`) to `.env.local` if you haven't.
2. Re-run `npm install` to pick up `react-markdown` + `remark-gfm`.
3. Restart `npm run dev`, open any project.
4. Type something in the chat box — the director should reply in a streaming typewriter.
5. Ask for "a shot that opens the series" and Claude should emit a `json-shot` code block, which the UI renders as an inline card with a (disabled-for-now) Generate button.

If Claude replies and shot cards render, Phase 3 is green. Reply "Phase 3 looks good" and I start Phase 4 (Seedance generation, Replicate webhook, live timeline). Phase 2 illustrations stay deferred unless you want me to turn them on.

---

## Environment checklist

Stashed secrets live in `secrets.txt` (gitignored, never commit). Copy them into `.env.local` before Phase 1 in the shape of `.env.example`.

| Variable | Staged in secrets.txt? | Required before | Notes |
| :--- | :---: | :--- | :--- |
| `REPLICATE_API_TOKEN` | ✓ | Phase 4 | Scope to this app. |
| `OPENROUTER_API_KEY` | ✓ | Phase 3 | Set a monthly cap in the dashboard. |
| `SUPABASE_SERVICE_ROLE_KEY` | ✓ (unlabeled) | Phase 1 | In secrets.txt under the plain `Supabase:` label — move to this var name when you create `.env.local`. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ (unlabeled) | Phase 1 | In secrets.txt under `Supabase anonpublic:` — same note. |
| `NEXT_PUBLIC_SUPABASE_URL` | ✗ | Phase 1 | `https://<project-ref>.supabase.co`. Get it from the Supabase project settings. |
| `NEXT_PUBLIC_APP_URL` | ✗ | Phase 1 (magic-link redirect) | `http://localhost:3000` in dev; `https://nysus.media` in prod. |
| `CRON_SECRET` | ✗ | Phase 4 (webhook + cron) | Generate with `openssl rand -hex 32`. |
| `ALLOWED_EMAIL` | ✗ | Phase 1 (magic-link gate) | Your email. |
| `CRITIQUE_MODE` | ✓ | Phase 6 | Must equal `on_demand`. |

**Reminder**: never paste a secret value into source, comments, commit messages, or chat. Before every commit, run `git diff --staged` and visually confirm no tokens leaked.

---

## Session resume protocol

If a session dies mid-phase, the next agent:

1. Reads this file first.
2. Runs `git log --oneline -20` to see what was actually committed.
3. Runs `npm run dev` (after `npm install` if needed) to confirm the current tree boots.
4. Reports the phase it's resuming from before doing any new work. Never restart a completed phase.

---

## Commit log (tracked manually as a fallback)

- Phase 0: scaffold Nysus — Next 16 + TS + Tailwind v4 + Director's Desk tokens + PWA manifest + placeholder icons
- Phase 1: Supabase schema + RLS + magic-link auth (ALLOWED_EMAIL gate at 3 layers) + projects CRUD + /setup fallback
- Phase 3: director system prompt + OpenRouter streaming + /api/chat + live chat panel with json-shot card parser
- Phases 4–9: Seedance generation + webhook + cron, FFmpeg.wasm continuity, on-demand critique, voice dictation, stitch/export, polish. See `git log`.
