#!/usr/bin/env bash
# =====================================================================
# Nysus ship script
# =====================================================================
# Run with:    bash ship.sh
#
# Stages all legitimate changes (gitignore handles the rest), checks
# for secret leaks, commits with a clear message, pushes to origin/main.
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
git commit -m "WorkspaceShell + SectionNav — make workspace navigation a core feature

The auth'd app now has a real shell instead of a one-off breadcrumb
on each page. Wherever you are inside Nysus, the path to every other
surface is one tap away.

* WorkspaceShell (app/components/workspace-shell.tsx)
  - Desktop: persistent left rail with Logo, New film, Dashboard,
    Playground, Gallery, My photos, recent projects switcher, and
    Profile / Sign out at the bottom.
  - Mobile: slim top bar (logo + 'Films' switcher sheet) layered on
    top of the existing BottomNav.
  - Hides itself on landing, /login, /setup, /share, /pricing, /auth
    so those pages keep their narrow framing.
  - Recent projects load via /api/projects/recent (RLS-gated).

* SectionNav (app/projects/[id]/section-nav.tsx)
  - In-project tab strip: Chat · Scenes · Stitch · Bible.
  - Each tab anchors or routes to the matching surface and shows
    counts (e.g. '3/6 rendered') + state pills ('3 rendering').
  - Replaces the scattered breadcrumb + Edit/Storyboard/Stitch
    buttons on the workspace, stitch and edit pages with a single
    consistent rail.

* Layout + chrome
  - Root layout now mounts <WorkspaceShell> around children so the
    rail is always-on for authenticated routes.
  - Workspace.tsx, /projects/[id]/stitch and /projects/[id]/edit all
    use SectionNav; redundant per-page back-buttons are gone.

Typecheck clean."

echo ""
echo "→ Pushing to origin/main…"
git push origin main

echo ""
echo "✓ Pushed. Vercel will build in ~5s."
echo "  https://vercel.com/leviprogrammer71s-projects/nysus/deployments"
