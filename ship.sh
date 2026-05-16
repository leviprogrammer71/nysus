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
#   5. Vercel will auto-build the new commit. Watch:
#        https://vercel.com/leviprogrammer71s-projects/nysus
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
git commit -m "Clean Nysus pivot + restore next.config + harden landing prerender

Removes the leftover Listing Bundle / Vantage Media plumbing so Nysus
reads as the chat-driven filmmaker app it wants to be, restores the
next.config that was accidentally stripped (gallery + project images
broke without images.remotePatterns), and protects the landing page
build against missing env vars.

Highlights:
  * /video → redirects to /projects/new (was a Listing Bundle picker)
  * /pricing → Listing Bundle tier dropped
  * Login + CTA hook → land on /dashboard, not /video?mode=listing
  * Stitch overlays generic: title / subtitle / credits
    (was: location / price / realtor / brokerage)
  * BottomNav Home → /dashboard
  * Landing page: try/catch around loadGallery + force-dynamic so a
    missing env var degrades to an empty gallery instead of a hard
    prerender error (this was the actual build-blocking bug — the cron
    removal was unrelated)
  * next.config.ts restored: images.remotePatterns for **.supabase.co
    + **.supabase.in + replicate.delivery + pbxt.replicate.delivery,
    and the security header set (X-Content-Type-Options, Referrer-
    Policy, X-Frame-Options)
  * .gitignore widened: keys.txt, *.bak, vercel-env.txt,
    grant-credits.sql, my-replicate-app/

This unblocks the Vercel deploy once env vars are set on the project."

echo ""
echo "→ Pushing to origin/main…"
git push origin main

echo ""
echo "✓ Pushed. Vercel will start a new build in ~5 seconds."
echo "  Build status: https://vercel.com/leviprogrammer71s-projects/nysus/deployments"
echo ""
echo "→ NEXT: add env vars to the nysus project on Vercel."
echo "  Settings → Environment Variables → Import .env"
echo "  Paste the contents of vercel-env.txt (placeholders filled in)."
