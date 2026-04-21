<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

---

# Nysus — agent notes

**Read `PROGRESS.md` before doing anything else.** It holds the current phase, deviations from the original brief, and session-resume protocol.

## Non-negotiables

1. **Never commit secrets.** `.env.local`, `secrets.txt`, and `*.secrets` are gitignored. Refer to secret values only by env var name. Run `git diff --staged` before every commit.
2. **Critique is on-demand only.** When clips complete, the app silently samples frames but **never** sends them to Claude. A Claude call only fires when the user taps the _"Consult the chorus"_ button. Gate: `CRITIQUE_MODE=on_demand`. Auto-critique is a bug.
3. **Single-user.** Magic-link auth is gated to `ALLOWED_EMAIL`.
4. **Mobile-first.** Portrait primary, 44px tap targets, bottom-sheet modals, safe-area padding.

## Design system quick reference

- Palette tokens live in `app/globals.css` under `@theme inline`. Access via Tailwind: `bg-paper`, `text-ink`, `bg-paper-deep`, `text-ink-soft`, `bg-sepia`, `text-sepia-deep`, `bg-highlight`, `text-wine-dark`, `text-red-grease`.
- Fonts: `font-display` (Cormorant), `font-body` (Inter), `font-hand` (Caveat), `font-mono` (JetBrains Mono).
- `wine-dark` is brand-moment only (logo/splash/hero). `red-grease` is errors + critique only.
- One highlighted keyword per screen title, using `.highlight` class (a hand-drawn yellow streak under the word, not a full background).

## Editing the brief

User preferences that override the original Cowork brief:

- Critique button reads **"Consult the chorus"** (Dionysian framing, per user).
- Pre-flight Chrome verification of Replicate/OpenRouter model IDs: **skipped**. Defaults assumed in PROGRESS.md; verify with the user before Phase 3 / Phase 4.
- Illustration batch via Flux 1.1 Pro in Phase 2: **deferred** to user. Placeholder N-mark icons ship in Phase 0.
- `next-pwa` itself: **deferred** to Phase 9. Phase 0 ships static `manifest.webmanifest` + theme-color only.
- Framework: **Next.js 16** (not 15 as the brief said). Backward-compatible; keep unless user asks to downgrade.
- Voice input Phase 7: only "quick dictation" shipped. The brief's long-form "script mode" with voice commands (`new shot`, `scratch that`, `send to Claude`, `character note:`) is not wired up. Add here if you implement it.
- Seed-frame scrubber (Phase 5.5) IS shipped: `app/projects/[id]/timeline/seed-picker.tsx` — scrub a prior clip, upload a file, or paste from clipboard. Backed by `/api/clips/[id]/seed` (POST + DELETE).
- `/public/{next,vercel,window,file,globe}.svg` are neutralized placeholders (fuse-mount in the setup sandbox wouldn't let me delete them). Feel free to delete them locally.
