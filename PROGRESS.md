# Nysus — Build Progress

> Persistent memory across sessions. Any agent resuming work reads this file **first**, then `git log --oneline -20`, then tries `npm run dev`. Do **not** restart from Phase 0 if this file says Phase 0 is complete.

---

## Current state

| Phase | Name | Status |
| :---- | :--- | :----- |
| 0     | Scaffold | **in progress — awaiting user verification** |
| 1     | Auth + Supabase | pending |
| 2     | Design system + illustrations | pending |
| 3     | Chat with Claude | pending |
| 4     | Seedance generation | pending |
| 5     | Continuity system | pending |
| 6     | On-demand critique (_"Consult the chorus"_) | pending |
| 7     | Voice input | pending |
| 8     | Stitch / export | pending |
| 9     | Polish | pending |

---

## Phase 0 — Scaffold

Status: **committed — awaiting user verification**
Last action: Committed Phase 0 on branch `main` (see `git log`). Working tree clean, git fsck clean, no secret patterns in the staged diff (checked before commit).
Next action: User runs `npm install && npm run dev` locally, confirms localhost renders the cream/navy placeholder page. Once confirmed, Phase 0 is green and we begin Phase 1.
Blockers: None on my side. **User verification required** (see _How to verify Phase 0_ below).

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

## How to verify Phase 0 on your machine

```bash
cd /Users/becareful/Movies/Nysus

# 1. Install dependencies
npm install

# 2. Quick sanity checks
npm run typecheck
npm run build

# 3. Boot dev server
npm run dev
# open http://localhost:3000
```

You should see:

- Cream (`#F5EFE0`) page background
- Navy (`#1B2A3A`) serif "NYSUS" wordmark in Cormorant Garamond with letter-spacing
- Handwritten "a filmmaker's *notebook*" tagline in Caveat, with `notebook` highlighted in the dusty yellow
- Thin ink rule
- "after Dionysus" footer in small caps

If that renders, Phase 0 is green. Reply with "Phase 0 looks good" (or flag what's off) and I start Phase 1.

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

- Phase 0: scaffold Nysus — Next 16 + TS + Tailwind v4 + Director's Desk tokens + PWA manifest + placeholder icons. See `git log -1`.
