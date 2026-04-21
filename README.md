# Nysus

> A filmmaker's notebook for chained AI video generation. Named after Dionysus — patron of theater, ecstatic vision, and the dissolving of boundaries.

Nysus is a mobile-first PWA for directing philosophical short-form video. You chat with Claude as your creative director and generate 10–15 second Seedance clips that seed into one another — each clip's last frame becomes the opening of the next.

**Status**: Phase 0 (scaffold). See [`PROGRESS.md`](./PROGRESS.md) for current phase, remaining work, and session-resume protocol.

---

## Getting started

```bash
npm install
cp .env.example .env.local     # then fill in real values
npm run dev
# http://localhost:3000
```

### Verifying phase 0

```bash
npm run typecheck
npm run build
```

Both should exit clean. See `PROGRESS.md` § "How to verify Phase 0 on your machine" for the visual acceptance checklist.

---

## Stack

- **Next.js 16** App Router + TypeScript
- **Tailwind v4** with a custom "Director's Desk, after Dionysus" design system (see `app/globals.css`)
- **Supabase** — Postgres, Storage, magic-link auth (added Phase 1)
- **Replicate** — ByteDance Seedance 2.0 for video generation (added Phase 4)
- **OpenRouter** — Claude streaming SSE with vision (added Phase 3)
- **FFmpeg.wasm** — client-side last-frame extraction + final stitch (added Phases 5 + 8)
- **Vercel** — hosting + cron (webhook backup)

---

## Design system

Director's desk meets Dionysian myth. Cream paper, navy ink, serif display type with handwritten accents. Theater-mask motifs and ivy appear in illustrations without being literal.

Palette:

- `paper` `#F5EFE0` (main bg) / `paper-deep` `#EBE3D1` (cards, sheets)
- `ink` `#1B2A3A` (primary) / `ink-soft` `#2C3E50` (secondary)
- `sepia` `#B8956A`, `sepia-deep` `#8B6F47`, `highlight` `#E8D27A` (yellow streak)
- `wine-dark` `#5B1A2B` (brand-moment Dionysian accent, sparingly)
- `red-grease` `#A0392C` (errors + critique only)

Typography:

- Display: Cormorant Garamond (titles, wordmark)
- Body: Inter
- Hand: Caveat (margin notes, live voice transcripts)
- Mono: JetBrains Mono (prompt display)

---

## Security

- `.env.local` is gitignored. `secrets.txt` is gitignored.
- Never paste secret values into source, comments, commits, or logs.
- Before every commit: `git diff --staged` to confirm no values leaked.
- `ALLOWED_EMAIL` gates magic-link auth to a single address.

---

## Deploy

Phase 0 is not deployable. Deployment setup (Vercel + `nysus.media` domain + Replicate webhook URL) is tracked in the later phases of `PROGRESS.md`.
