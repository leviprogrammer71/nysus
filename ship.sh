#!/usr/bin/env bash
# =====================================================================
# Nysus ship script
# =====================================================================
set -euo pipefail
cd "$(dirname "$0")"

echo "→ Releasing any stale git lock…"
rm -f .git/index.lock 2>/dev/null || true

echo "→ Staging tracked changes…"
git add -A

echo "→ Sanity check: no secret-looking file in the staged diff."
if git diff --cached --name-only | grep -E '(^keys\.txt$|vercel-env\.txt|\.bak$|\.env$|secrets\.txt)' >/dev/null; then
  echo "✗ ABORT: a secret-shaped file ended up staged. Inspect:"
  git diff --cached --name-only | grep -E '(^keys\.txt$|vercel-env\.txt|\.bak$|\.env$|secrets\.txt)'
  exit 1
fi
echo "  ✓ clean"

echo "→ Files about to ship:"
git diff --cached --name-status

echo ""
echo "→ Committing…"
git commit -m "Director's Desk — full UI overhaul from design mockups

Every authenticated surface now speaks the same notebook language.

* globals.css — palette locked to design spec (paper #F7F1E5, ink
  #1B2A3A, sepia, sepia-deep, highlight #E8B23A, wine-dark, etc.),
  with new utilities: paper-grain, paper-deep-grain, ink-grain,
  vignette, highlight / highlight-thin brush, still-placeholder,
  leaf / leaf-flat cards, sepia-rule / sepia-rule-tight, flicker +
  oracle-pulse animations, leaf-in entrances, gutter-vine motif,
  rosette divider, chapter-link CTA, proc-dot, stage-pill,
  eyebrow, field / field-line, btn-ink / btn-paper / btn-wine,
  nav-row, section-tab, msg-*, tag.

* MaskGlyph component — the half-shadowed Dionysian theater mask
  with a sepia vine across the brow. Used wherever the wordmark
  appears (sidebar, mobile bar, login).

* WorkspaceShell — rebuilt to spec. 232px sidebar with mask +
  'Nysus' + 'a director's notebook'; sepia-rule dividers;
  'Begin a film' bordered CTA that fills on hover; The desk nav
  (Dashboard / The threshold / Gallery / My photos); Productions
  list with colored dots (active/ready/live/draft); monthly forge
  bar (live via /api/usage/summary); 'after Dionysus.' sign-off.
  Mobile gets a slim top bar + drawer.

* /api/usage/summary — new endpoint that returns the user's
  month-to-date spend as a percentage of MAX_MONTHLY_USD.
* /api/projects/recent — already in; now decorated with status hints.

* Dashboard — rebuilt as the first leaf of the notebook. Epigraph
  aphorism · run-on greeting headline ('Good evening, Theo. Three
  films in motion, one awaiting the cut.') · last-touched hand line ·
  three Chapter-style CTAs (Begin / Threshold / Return) · rosette
  divider · Productions grid styled as poster-fragments with six
  Procession dots + sepia hairline rule per card · 'Recent from the
  forges' strip + monthly forge gauge with poetic copy.

* SectionNav — restyled to Cormorant italic tabs with mono
  superscript counts ('Chat with Ari', 'Scenes 14', 'Stitch 3 ready',
  'Bible cast · style'). Underline rule on active.

* Threshold / Playground — full redesign. Doorway-glow header with
  an arch SVG (vine + keystone mask + flicker flame inside). Two
  big forge picker cards (Still/Motion) that flip ink on selected.
  Model chips below each forge expose every wired model: gpt-image-2,
  gpt-image-1, Nano Banana 2, Flux Kontext Pro for stills; Seedance
  2.0, Kling 3 Omni, Kling Motion Control 2.6, Veo 3, Happy Horse
  1.0, plus the Kling 2.5 lineup for motion. Serif italic prompt
  textarea. Seed dropzone (paste/drag/pick). Ratio + quality +
  duration chips. 'Call the forge ⟶' CTA. Side altar with note,
  recent forges (live), and the archive grid below as a contact
  sheet with stills/motions/all filters.

* Sign-in — mask glyph + 'open the notebook' hand subtitle, field-
  style inputs, btn-ink submit. 'after Dionysus' footer.

* Workspace title row — replaced the old breadcrumb/title with an
  eyebrow + hand subtitle.

* Bible / Stitch / Profile — new chrome: eyebrow + display headline
  with italic + highlight + hand subtitle + sepia-rule. Forms
  underneath unchanged so all the model dropdowns and bible config
  knobs keep working.

* Inline Character Sheet + Aesthetic Bible panels on the workspace
  now use leaf-flat cards + 'The cast' / 'The aesthetic bible'
  eyebrows.

All model forges remain accessible. Typecheck clean."

echo ""
echo "→ Pushing to origin/main…"
git push origin main

echo ""
echo "✓ Pushed. Vercel will build in ~5s."
echo "  https://vercel.com/leviprogrammer71s-projects/nysus/deployments"
