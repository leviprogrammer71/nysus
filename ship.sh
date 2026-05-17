#!/usr/bin/env bash
# =====================================================================
# Nysus deploy-fix ship script
# =====================================================================
# Run with:    bash ship.sh
#
# What it does:
#   1. Removes the stale .git/index.lock if one's still there.
#   2. Stages every legitimate change (and respects the updated .gitignore
#      so keys.txt, vercel-env.txt, *.bak, etc. NEVER end up in git).
#   3. Verifies no secret-looking file made it into the index.
#   4. Commits with a clear message and pushes to origin/main.
# =====================================================================

set -euo pipefail
cd "$(dirname "$0")"

echo "→ Releasing any stale git lock…"
rm -f .git/index.lock 2>/dev/null || true

echo "→ Staging tracked changes (gitignore handles the rest)…"
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
git commit -m "Forge expansion + migration-drift guard

* Model registry: added kling-v3-omni, kling-motion-control-v26,
  google/veo-3.1, alibaba/happyhorse-1.0. gpt-image-2 stays the default
  still forge; seedance-2-pro stays the default motion forge. Each
  entry carries the right Replicate slug, input_image / start_image
  field, aspect ratios, durations, and approx cost so the Playground
  and scene-card dropdowns pick them up with zero extra wiring.

* Project page hardened against migration drift: if 0010's columns
  (current_stage, bible_overrides) aren't applied yet, the page
  catches the Postgres 42703 (undefined_column) and falls back to a
  minimal select instead of crashing the Server Component. Stops the
  'the reel jammed' error for any deploy that ships ahead of its
  migration."

echo ""
echo "→ Pushing to origin/main…"
git push origin main

echo ""
echo "✓ Pushed. Vercel will start a new build in ~5 seconds."
echo ""
echo "→ NEXT: run the StoryFlow migration on production Supabase."
echo "  Open Supabase → SQL Editor → New query → paste run-migration-0010.sql → Run."
echo "  That makes the new columns + generations table actually exist."
