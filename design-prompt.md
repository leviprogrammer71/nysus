# Nysus — UI Upgrade Brief

You are an art-directing designer hired to elevate Nysus, a chat-driven
AI filmmaking app. Live at https://nysus-livid.vercel.app/dashboard.

Below is everything you need: brand, current palette, surfaces, the
mythological vocabulary the app already speaks in, and the specific
upgrades I want from you. Read it all, then **respond with mockups
in HTML/Tailwind that I can paste straight into the codebase.**

---

## The name + the myth

**Nysus** is the mountain where Dionysus was raised (Nysa, in myth).
The app is named after Dionysus — patron of theater, ecstatic vision,
the dissolving of self/other. Every piece of the product leans on that
without being on-the-nose about it. The two assistants are:

- **Ari** — Ariadne, the thread-holder. Plans the film. She speaks in
  three modes:
  - **the Oracle** (concept) — free-form ideation, finds the shape.
  - **the Liturgy** (script) — drafts scene packets in order.
  - **the Rite** (scene) — scoped to one card; refines that altar.
- **Mae** — the Maenads. Silent execution. The SceneBoard with
  Generate-still + Animate per card.

The user moves through **the Procession** — six stages of a film:

| Stage | Subtitle | Glyph idea |
|---|---|---|
| Concept | the seed | a grain / kernel |
| Script | the thread | a spool, ariadnian |
| Scenes | the line | a row of frames |
| Image | the mask | the half-shadowed Dionysian mask |
| Animate | the rite | a thyrsus (vine-staff) |
| Stitch | the cut | scissors |

Other vocabulary in production already:
- **the bible** — the project's cast + aesthetic sheet
- **the threshold** — the Playground (project-less generation)
- **the forge** — any individual model (gpt-image-2 = "still forge",
  Seedance 2.0 = "motion forge")
- **the procession** — the six-stage rail that sits above every project

The phrase "after Dionysus" appears in the footer.

---

## Current visual identity — "Director's Desk"

A paper-and-ink palette that reads as an old film notebook.

```
--paper       #F7F1E5   warm cream, the page
--paper-deep  #EBE3CE   slightly darker, surface cards
--ink         #1B2A3A   deep navy-near-black, primary text
--ink-soft    #4A586B   secondary text
--sepia       #B79A6A   notebook brown for hand-lettered marks
--sepia-deep  #8C6F3D   stronger sepia for highlights
--highlight   #E8B23A   the chrome-yellow underline on key words
--wine-dark   #7A2F3A   used very sparingly (the Dionysian wine)
--red-grease  #C0392B   destructive / errors
--green-seal  #4A7C59   "ready" dots
```

Type stack:
- **font-display** — Cormorant Garamond (theatrical serif; titles)
- **font-body** — Inter (UI text)
- **font-hand** — Caveat (hand-written labels, subtitles)
- **font-mono** — JetBrains Mono (prompts shown verbatim)

Style markers:
- `tracking-[0.22em]` for short UPPERCASE display lines.
- `highlight` class — chrome-yellow underline behind a word.
- Sepia handwritten subtitles under display labels.
- Generous warm paper backgrounds; navy ink for type.
- Sparing wine accent. Generous whitespace.

---

## Surfaces I want you to upgrade (in order)

1. **Dashboard** (`/dashboard`) — the user's home after sign-in.
   Currently: hero stats + projects grid + gallery strip + usage meter.
   Needs: a proper hero that whispers the mythology; better project
   cards (each is a "production"); a recurring Dionysian aphorism slot
   at the top (text I can swap server-side).

2. **Workspace** (`/projects/[id]`) — the procession + chat panes.
   Currently has a new SectionNav (Chat · Scenes · Stitch · Bible)
   and a StageRail showing the six Procession stages. Both should be
   beautified, not redesigned away — they're the spine.

3. **Playground / the threshold** (`/playground`) — model picker +
   prompt + source image + archive grid below. Needs to feel like
   stepping through a doorway into a forge, not a tool palette.

4. **Persistent shell** — the desktop sidebar / mobile top bar that
   wraps everything. Currently functional, needs theme.

---

## What to elevate

**Mood**: hand-lettered notebook, but a notebook that's been kept by
someone who reads Ovid and watches Tarkovsky. Slightly dim, golden
hour, candlelit at the edges. Not gothic, not occult — **mystic
working**. Theatrical posters from the 1920s. Black-and-cream Cocteau
illustrations. The Director's Desk after midnight.

**Specifically I want you to deliver:**

- A **revised dashboard hero** with a Dionysian aphorism slot, a
  short user-state line ("3 films in motion · 1 awaiting cut"), and
  primary CTAs styled as a chapter heading rather than buttons.
- **Project card** redesign: each card is a poster-fragment. Title
  in display serif, a hand subtitle (the project's first scene's
  motif, if any), a small still thumbnail, a procession progress
  glyph (the six stages as tiny dots), and a "last touched" sepia
  hand-line.
- A **better empty state** for users with no projects yet — a
  small Dionysian woodcut illustration, the line "no procession
  yet — light the first torch," and a single CTA.
- **A small ornamental motif** that recurs throughout the app —
  thinking grape-vine, or a thyrsus rosette, or the half-mask. Light
  enough to be ignored, present enough to feel curated.
- An **upgraded sidebar header** for the WorkspaceShell — replace
  the bare "NYSUS" wordmark with something that says theater without
  being theme-park.
- **Three sample loading-line replacements** for chat:
  - Currently: "loading…"
  - Want: lore-flavored alternatives that aren't twee.

**Don't redesign:**
- The mythological vocabulary (Ari / Mae / Procession / Oracle /
  Liturgy / Rite / threshold / forge / bible). It's load-bearing.
- The Director's Desk paper/ink palette. Adjustments allowed; full
  re-skin not.
- The information architecture: WorkspaceShell sidebar, in-project
  SectionNav, the six-stage Procession rail. Beautify, don't replace.
- The chat-first flow. Ari is the entry to every film.

---

## Deliverables

For each of the four surfaces, give me:

1. A single self-contained HTML+Tailwind file that mocks the new
   look. Tailwind utility classes only, no custom CSS unless
   absolutely required. Use the exact CSS variables above for
   colors (e.g. `bg-[var(--paper)]`).
2. A short prose note (≤ 5 sentences) explaining the mood-move and
   the one or two specific changes that carry the most weight.
3. Anything I should add to `globals.css` to support it (custom
   keyframes for a flame flicker, a paper-grain background, a
   thyrsus SVG component, etc.).

If you have to choose between *prettier* and *more legible at small
sizes on mobile*, choose legible. Phone-first. The user is a director
holding a phone in one hand and a cup of coffee in the other.

Now: start with the **dashboard hero + project card**, since that's
the surface every session opens on. Show me the mockup and I'll tell
you which direction to take next.
