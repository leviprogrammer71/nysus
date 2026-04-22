# Nysus — Comprehensive Image & Illustration Brainstorm

> A screen-by-screen inventory of every place a new illustration, texture, micro-graphic, or decorative element could elevate the app from functional to *premium*. Each idea maintains the established aesthetic: hand-drawn pen sketch in navy/indigo ink on warm cream/parchment, classical cinema + Dionysian mythology motifs.

**Existing assets** (for reference — these are already shipped):
`logo-mark.png`, `empty-notebook.png`, `film-strips.png`, `scattered-strips.png`, `search-reel.png`, `torn-404.png`, `torn-pages.png`, `torn-screenplay.png`

---

## 1. Login & Authentication Flow

### 1A. Login Page — Hero Illustration

| Field | Detail |
|-------|--------|
| **Name** | `login-muse-gateway.png` |
| **Where** | `app/login/page.tsx` — behind or below the login form, above the "after Dionysus" footer |
| **Depicts** | A grand theater curtain, slightly parted, revealing a sliver of golden light. Ivy vines climb the curtain edges. A pair of theatrical masks (comedy/tragedy) rest at the base, with a fountain pen lying across them as if signing an entrance ledger. |
| **UX purpose** | Sets the emotional tone from the very first interaction — you're not "logging in," you're *entering the theater*. Transforms a utilitarian form into a moment of anticipation. |
| **Prompt** | `Hand-drawn pen sketch illustration of grand theater curtains parted slightly to reveal warm golden light behind them. Ivy vines climb the heavy curtain fabric on both sides. At the base, a pair of classical Greek theatrical masks (comedy and tragedy) rest on a small wooden ledge, with a fountain pen lying across them. Navy indigo ink (#1B2A3A) lines on warm cream parchment (#F5EFE0), sepia (#B8956A) accents on the light and pen nib. Vintage notebook illustration style, fine crosshatching for shadows. Vertical composition, 3:4 aspect ratio, 600x800px.` |
| **Priority** | **High** — the login page is every user's first impression |

### 1B. Magic Link Sent — Confirmation Illustration

| Field | Detail |
|-------|--------|
| **Name** | `magic-link-owl.png` |
| **Where** | `app/login/login-form.tsx` — replace or accompany the success text "Check your email" |
| **Depicts** | A small owl (Athena's owl, symbol of wisdom/messages) carrying a sealed letter in its talons, flying across a crescent moon. Film sprocket holes line the letter's edges, making it look like a strip of celluloid doubling as mail. |
| **UX purpose** | Delights the user during the wait. The "check your email" moment is dead time — an illustration makes it feel intentional and magical rather than bureaucratic. |
| **Prompt** | `Hand-drawn pen sketch of a small owl in flight carrying a sealed envelope in its talons. The envelope has film sprocket holes along its edges like a strip of celluloid. A crescent moon behind the owl, with a few stars rendered as tiny film reels. Navy indigo ink (#1B2A3A) on warm cream parchment (#F5EFE0), sepia (#B8956A) highlights on the moon and envelope wax seal. Whimsical vintage illustration style, delicate crosshatching. Square composition, 400x400px.` |
| **Priority** | **Medium** — nice delight moment, not structurally critical |

### 1C. Auth Error State

| Field | Detail |
|-------|--------|
| **Name** | `locked-theater-door.png` |
| **Where** | `app/login/login-form.tsx` — shown when login fails (wrong email, expired link) |
| **Depicts** | A heavy wooden theater door with an ornate lock, a broken key fragment in the keyhole. Ivy grows over the door frame but the door remains shut. A small sign reads nothing (no text in illustration). |
| **UX purpose** | Softens the rejection of a failed login. Instead of just red error text, the illustration communicates "the theater is closed to you" in a way that feels thematic rather than hostile. |
| **Prompt** | `Hand-drawn pen sketch of an ornate wooden theater door, closed and locked. A broken key fragment protrudes from the decorative iron keyhole. Ivy vines grow densely over the stone door frame. Warm light leaks from under the door. Navy indigo ink (#1B2A3A) lines on cream parchment (#F5EFE0), sepia (#B8956A) on the warm light and key fragment. Vintage architectural illustration style, detailed crosshatching on the wood grain. Portrait orientation, 2:3 aspect ratio, 400x600px.` |
| **Priority** | **Low** — edge case, but adds polish |

---

## 2. Onboarding & First-Run Experience

### 2A. First Project — Welcome Carousel (3 illustrations)

| Field | Detail |
|-------|--------|
| **Name** | `onboard-1-notebook.png`, `onboard-2-director.png`, `onboard-3-reel.png` |
| **Where** | New component: a dismissable carousel/coach-marks overlay shown on first login (before any projects exist). Could be triggered from `app/page.tsx` when `projects.length === 0` and a localStorage flag is unset. |
| **Depicts** | **Slide 1:** An open notebook with a quill, pages fluttering — "Every film begins as notes." **Slide 2:** A director's chair with a megaphone and a Greek chorus of masked figures standing behind — "You direct. Claude is your chorus." **Slide 3:** A completed film reel glowing with warm light, ivy wrapped around the spool — "Clip by clip, scene by scene, the reel assembles." |
| **UX purpose** | First-run education disguised as storytelling. Users immediately understand the three-phase workflow (write → direct → assemble) through metaphor rather than feature bullets. |
| **Prompt (Slide 1)** | `Hand-drawn pen sketch of an open notebook seen from above, pages fluttering as if caught by a breeze. A feather quill rests in an ink well beside it. Scattered across the desk: a few loose script pages and a small sprig of dried grape vine. Navy indigo ink (#1B2A3A) on warm cream parchment (#F5EFE0), sepia (#B8956A) accents on the ink well and vine. Vintage journal illustration, fine pen strokes. Landscape, 4:3, 800x600px.` |
| **Prompt (Slide 2)** | `Hand-drawn pen sketch of a wooden director's chair seen from the side, with a megaphone resting on the seat. Behind the chair, five figures wearing classical Greek theatrical masks stand in a loose semicircle, like a chorus. Film strip borders frame the scene on left and right edges. Navy indigo ink (#1B2A3A) on warm cream parchment (#F5EFE0), sepia (#B8956A) on the megaphone and mask details. Theatrical vintage illustration style. Landscape, 4:3, 800x600px.` |
| **Prompt (Slide 3)** | `Hand-drawn pen sketch of a completed film reel on a vintage projector, glowing with warm radiant light from behind. Ivy vines wrap elegantly around the reel spool. Small moths are drawn to the projector light. A trail of connected film frames leads into the reel, each frame containing a tiny abstract scene. Navy indigo ink (#1B2A3A) on warm cream parchment (#F5EFE0), sepia (#B8956A) and light gold (#E8D27A) on the glow. Landscape, 4:3, 800x600px.` |
| **Priority** | **High** — dramatically improves new-user comprehension |

### 2B. Feature Discovery Tooltips — Spot Illustrations (4 micro-illustrations)

| Field | Detail |
|-------|--------|
| **Name** | `tooltip-voice.png`, `tooltip-seed.png`, `tooltip-chorus.png`, `tooltip-stitch.png` |
| **Where** | Small pulsing dot indicators on first use of: mic button, seed picker, "consult the chorus" button, stitch page. Tapping reveals a tooltip with a 64x64 illustration + short text. |
| **Depicts** | **Voice:** A tiny phonograph horn with sound waves rendered as vine tendrils. **Seed:** A small seed/acorn cracking open with a film frame emerging. **Chorus:** Three small Greek masks in a row. **Stitch:** A needle trailing thread through film frames. |
| **UX purpose** | Non-intrusive progressive disclosure. Each feature gets a moment of explanation the first time the user encounters it, with an illustration that makes the metaphor click. |
| **Prompt (Voice)** | `Tiny hand-drawn pen sketch of a vintage phonograph horn, with sound waves emanating from it rendered as curling ivy vine tendrils. Minimal, icon-like. Navy indigo ink (#1B2A3A) on transparent/cream background. Fine linework, no shading. Square, 128x128px.` |
| **Prompt (Seed)** | `Tiny hand-drawn pen sketch of an acorn cracking open, with a single film frame emerging from within like a seedling. Minimal, icon-like. Navy indigo ink (#1B2A3A) on transparent/cream background. Fine linework. Square, 128x128px.` |
| **Prompt (Chorus)** | `Tiny hand-drawn pen sketch of three classical Greek theatrical masks in a row — tragedy, comedy, and a neutral contemplative face. Minimal, icon-like. Navy indigo ink (#1B2A3A) on transparent/cream background. Square, 128x128px.` |
| **Prompt (Stitch)** | `Tiny hand-drawn pen sketch of a sewing needle trailing dark thread through three connected film frames. Minimal, icon-like. Navy indigo ink (#1B2A3A) on transparent/cream background. Square, 128x128px.` |
| **Priority** | **Medium** — polished UX enhancement |

---

## 3. Project List (Home Page)

### 3A. Project Card Decorative Corner Ornament

| Field | Detail |
|-------|--------|
| **Name** | `corner-flourish.png` |
| **Where** | `app/page.tsx` — subtle overlay on each project card's top-right or bottom-left corner |
| **Depicts** | A small decorative corner bracket made of intertwined ivy and film strip, like the ornamental corners in old manuscripts. |
| **UX purpose** | Transforms plain rectangular project cards into something that feels like pages in a notebook. Subtle enough not to compete with content, distinctive enough to feel crafted. |
| **Prompt** | `Hand-drawn pen sketch of a decorative corner ornament combining intertwined ivy vine leaves with a curling film strip. Like an illuminated manuscript corner bracket. Navy indigo ink (#1B2A3A) with sepia (#B8956A) accents on the leaf veins. Minimal, delicate linework on transparent background. Square, 96x96px, content fills only one corner triangle.` |
| **Priority** | **Low** — pure visual polish |

### 3B. Background Paper Texture

| Field | Detail |
|-------|--------|
| **Name** | `paper-grain-texture.png` |
| **Where** | `app/globals.css` — replace the current radial-gradient body background with a tileable paper texture |
| **Depicts** | Subtle aged cream paper with visible fiber texture, faint coffee-stain rings, and barely-perceptible ruled lines. Not a photograph — a hand-drawn/synthesized texture. |
| **UX purpose** | The current CSS radial gradients create a slight depth but feel digital. A real paper texture makes every screen feel like you're looking at an actual notebook. This is the single highest-impact background change. |
| **Prompt** | `Seamless tileable texture of aged cream parchment paper (#F5EFE0). Visible paper fiber grain, very subtle coffee-ring stain in one area, faint barely-visible ruled lines like a notebook. Hand-drawn pen marks visible at edges as if the paper was torn from a larger sheet. Warm cream and light sepia (#B8956A) tones only, no text, no illustrations. Must tile seamlessly. Square, 512x512px.` |
| **Priority** | **High** — foundational texture that elevates every screen |

### 3C. Delete Confirmation Illustration

| Field | Detail |
|-------|--------|
| **Name** | `burning-script.png` |
| **Where** | Future enhancement: replace the browser `confirm()` dialog for project deletion with a custom modal |
| **Depicts** | A script page curling at the edges as if being burned, with a small flame at the corner. Ivy withering around the edges. Dramatic but small. |
| **UX purpose** | Deletion is a destructive action. A custom modal with this illustration makes the gravity of it feel appropriate to the app's world, rather than breaking immersion with a browser dialog. |
| **Prompt** | `Hand-drawn pen sketch of a screenplay page curling at the edges as if slowly burning. A small elegant flame at the bottom corner. Ivy vines around the page edges are withering. The page is otherwise blank. Navy indigo ink (#1B2A3A) lines on warm cream parchment (#F5EFE0), red-grease (#A0392C) pencil accents on the flame, sepia (#B8956A) on the curling edges. Dramatic but restrained. Portrait, 3:4, 300x400px.` |
| **Priority** | **Low** — requires a new modal component |

---

## 4. New Project Creation

### 4A. New Project Page — Inspiration Illustration

| Field | Detail |
|-------|--------|
| **Name** | `blank-clapperboard.png` |
| **Where** | `app/projects/new/page.tsx` — beside or above the form, next to "a world of shots, a chain of clips" |
| **Depicts** | A film clapperboard lying open on a desk, completely blank — no scene/take numbers filled in. A fountain pen hovers above it, poised to write. Behind it, a faint sketch of the Greek muse Thalia (comedy) looking on encouragingly. |
| **UX purpose** | The new-project page currently feels sparse. This illustration grounds the "blank slate" energy — you're about to label the slate for a new production. |
| **Prompt** | `Hand-drawn pen sketch of an open film clapperboard lying on a wooden desk surface, completely blank with no writing. A fountain pen hovers above it, poised to write. In the background, a faint ghostly sketch of a Greek muse figure looking on with gentle encouragement. Navy indigo ink (#1B2A3A) on warm cream parchment (#F5EFE0), sepia (#B8956A) accents on the desk wood and pen nib. Vintage production still illustration style. Landscape, 16:9, 640x360px.` |
| **Priority** | **Medium** — improves an important but brief interaction |

---

## 5. Project Workspace (Main Screen)

### 5A. Workspace Header — Decorative Divider

| Field | Detail |
|-------|--------|
| **Name** | `divider-filmstrip-ivy.png` |
| **Where** | `app/projects/[id]/workspace.tsx` — replace the plain `<div className="rule-ink">` with an illustrated horizontal divider |
| **Depicts** | A horizontal film strip with ivy threading through the sprocket holes, transforming from left to right — bare film on the left, lush ivy on the right. |
| **UX purpose** | The workspace has multiple sections (timeline, chat, character sheet, aesthetic bible) separated by thin lines. An illustrated divider between the title area and the content below creates a sense of *entering the workspace* rather than scrolling past a line. |
| **Prompt** | `Hand-drawn pen sketch of a horizontal film strip with ivy vines threading through the sprocket holes. The strip transitions from bare celluloid on the left to lush ivy growth on the right. Horizontal composition filling the full width. Navy indigo ink (#1B2A3A) on warm cream (#F5EFE0), sepia (#B8956A) accents on the vine leaves. Delicate linework, meant as a decorative divider. Very wide and thin, 1200x60px.` |
| **Priority** | **Medium** — subtle but affects the most-used screen |

### 5B. Character Sheet Empty State

| Field | Detail |
|-------|--------|
| **Name** | `empty-character-sheet.png` |
| **Where** | `app/projects/[id]/workspace.tsx` — the "Not yet populated" state of the character sheet section |
| **Depicts** | A casting board (corkboard with headshots pinned to it) but all the photos are blank silhouettes. Small handwritten labels below each are illegible scribbles. Pins and string connect them. |
| **UX purpose** | Currently this section just shows muted text. An illustration suggests what a character sheet *could* become and invites the user to populate it through conversation with the director. |
| **Prompt** | `Hand-drawn pen sketch of a small corkboard section with three blank portrait silhouettes pinned to it with drawing pins. Thin strings connect the portraits. Below each silhouette, illegible handwritten scribbles suggest names. Small film frame icons are pinned alongside. Navy indigo ink (#1B2A3A) on warm cream parchment (#F5EFE0), sepia (#B8956A) accents on the pins and string. Vintage production board feel. Landscape, 3:2, 360x240px.` |
| **Priority** | **Medium** — fills a notable visual gap |

### 5C. Aesthetic Bible Empty State

| Field | Detail |
|-------|--------|
| **Name** | `empty-mood-board.png` |
| **Where** | `app/projects/[id]/workspace.tsx` — the "Not yet populated" state of the aesthetic bible section |
| **Depicts** | A painter's palette with dried paint, a few color swatches pinned to a board, and a magnifying glass examining one swatch. Everything is sketched but the swatches themselves are blank/empty. |
| **UX purpose** | Mirrors the character sheet empty state but for visual style. Communicates "this is where your visual language lives" without words. |
| **Prompt** | `Hand-drawn pen sketch of a painter's palette with dried ink spots, beside a small board with three blank color swatch cards pinned to it. A magnifying glass examines one swatch. A small brush and ink well sit nearby. Navy indigo ink (#1B2A3A) on warm cream parchment (#F5EFE0), sepia (#B8956A) accents on the palette and magnifying glass handle. Vintage art studio illustration. Landscape, 3:2, 360x240px.` |
| **Priority** | **Medium** — fills a notable visual gap |

---

## 6. Chat / Director Conversation

### 6A. Director "Thinking" Indicator

| Field | Detail |
|-------|--------|
| **Name** | `director-thinking.png` |
| **Where** | `app/projects/[id]/chat/message.tsx` — replace the simple pulsing cursor block with an animated illustration while the assistant is streaming |
| **Depicts** | A small animated vignette: a figure in a director's chair, leaning forward with chin on hand in contemplation. A thought bubble contains swirling film frames. Could be a static image with CSS animation (paper-breath). |
| **UX purpose** | The current thinking indicator is a tiny pulsing rectangle. A small illustration of the director contemplating makes the wait feel like the director is *actually thinking about your scene*, not just processing. |
| **Prompt** | `Tiny hand-drawn pen sketch of a figure sitting in a director's chair, leaning forward with chin resting on hand in deep thought. A thought bubble above contains swirling miniature film frames and script lines. Minimal, vignette-style, compact composition. Navy indigo ink (#1B2A3A) on warm cream (#F5EFE0), sepia (#B8956A) in the thought bubble. Fine delicate linework. Square, 80x80px.` |
| **Priority** | **High** — improves the most frequent interaction in the app |

### 6B. Chat Empty State — "The Notebook Is Open"

| Field | Detail |
|-------|--------|
| **Name** | `open-directors-notebook.png` |
| **Where** | `app/projects/[id]/chat/chat-panel.tsx` — the empty chat area ("the notebook is open") |
| **Depicts** | A notebook lying open on a director's desk, with a vintage desk lamp casting warm light across blank pages. A megaphone, a small stack of script pages, and a grape vine sprig sit nearby. The scene invites you to start writing. |
| **UX purpose** | The empty chat currently has just text. An illustration makes the blank state feel like an *invitation* rather than emptiness — you're sitting at the director's desk and the notebook is waiting. |
| **Prompt** | `Hand-drawn pen sketch of an open notebook on a wooden desk, illuminated by a vintage articulated desk lamp casting warm light. A small megaphone leans against the desk edge. A stack of blank script pages, a fountain pen, and a small grape vine sprig are arranged nearby. Seen from slightly above, warm and inviting. Navy indigo ink (#1B2A3A) on warm cream parchment (#F5EFE0), sepia (#B8956A) accents on the lamp light and desk surface, faint gold (#E8D27A) in the lamp glow. Landscape, 4:3, 480x360px.` |
| **Priority** | **High** — the chat is the app's core and this is its first impression |

### 6C. Shot Card — Decorative Border Elements

| Field | Detail |
|-------|--------|
| **Name** | `shot-card-border-top.png`, `shot-card-border-bottom.png` |
| **Where** | `app/projects/[id]/chat/shot-card.tsx` — decorative borders for the shot prompt cards that appear inline in chat |
| **Depicts** | **Top:** A thin ornamental strip mimicking a film countdown leader (the numbers 8-7-6-5 counting down, but rendered as hand-drawn sketches inside sprocket-holed filmstrip). **Bottom:** A matching strip with a small clapperboard icon and "ACTION" in sketched handwriting. |
| **UX purpose** | Shot cards are the most important interactive element in the chat. Decorative borders make them feel like *actual production documents* — call sheets or shot lists — rather than styled divs. |
| **Prompt (Top)** | `Hand-drawn pen sketch of a thin horizontal film leader countdown strip showing numbers 5, 4, 3 inside circular frames with crosshairs, connected by sprocket-holed filmstrip. Decorative border element. Navy indigo ink (#1B2A3A) on cream (#F5EFE0). Very thin and wide, meant as a header decoration. 800x32px.` |
| **Prompt (Bottom)** | `Hand-drawn pen sketch of a thin horizontal decorative border with a small film clapperboard icon on the left and hand-drawn cursive text reading "action" trailing to the right with a decorative flourish. Navy indigo ink (#1B2A3A) on cream (#F5EFE0), sepia (#B8956A) on the text. Very thin and wide, footer decoration. 800x32px.` |
| **Priority** | **Medium** — visual polish for key UI element |

### 6D. Script Mode Overlay — Background Illustration

| Field | Detail |
|-------|--------|
| **Name** | `script-mode-stage.png` |
| **Where** | `app/projects/[id]/chat/script-mode-overlay.tsx` — subtle background behind the transcript area |
| **Depicts** | A faint, ghostly illustration of a theater stage seen from the wings — curtains on either side, footlights along the base, a single spotlight cone from above. Very low opacity, purely atmospheric. |
| **UX purpose** | Script mode currently opens to a white page with a waveform. The theatrical stage background creates the feeling that you're *speaking from the wings of a theater*, dictating direction. It transforms a utilitarian voice-input screen into a theatrical moment. |
| **Prompt** | `Very faint, ghostly hand-drawn pen sketch of a theater stage viewed from the wings. Heavy curtains frame left and right edges. Footlights glow along the stage front. A single spotlight cone descends from above, illuminating an empty center stage. The entire illustration should be extremely subtle, like a watermark — meant to be displayed at 5-8% opacity as a background. Navy indigo ink (#1B2A3A) lines only, on transparent background. Portrait, 9:16, 540x960px.` |
| **Priority** | **Medium** — elevates an already atmospheric feature |

---

## 7. Timeline

### 7A. Clip Card — Queued/Processing State Illustration

| Field | Detail |
|-------|--------|
| **Name** | `clip-developing.png` |
| **Where** | `app/projects/[id]/timeline/clip-card.tsx` — replace the generic spinner for queued/processing clips |
| **Depicts** | A small film negative hanging from a clothesline/developing wire, with liquid dripping from its bottom edge — as if the image is developing in a darkroom. |
| **UX purpose** | The current loading spinner is the weakest visual in the app — it's a generic CSS spinner that breaks the illusion. This illustration keeps the "film is developing" metaphor alive during the wait. Apply `animate-paper-breath` for subtle pulsing. |
| **Prompt** | `Hand-drawn pen sketch of a small film negative frame hanging from a thin wire by a clip, with drops of liquid falling from its bottom edge as if developing in a darkroom. The frame interior is empty/fogged. Minimal, compact, icon-like. Navy indigo ink (#1B2A3A) on transparent/cream background, sepia (#B8956A) on the drops. Vertical orientation, 2:3, 96x144px.` |
| **Priority** | **High** — replaces the most visually jarring element in the current UI |

### 7B. Clip Card — Failed State Icon

| Field | Detail |
|-------|--------|
| **Name** | `clip-failed-x.png` |
| **Where** | `app/projects/[id]/timeline/clip-card.tsx` — replace the red `✕` character for failed clips |
| **Depicts** | A film frame with a diagonal crack/shatter across it, like broken glass. A red grease-pencil "X" is drawn over the broken frame. |
| **UX purpose** | The current red `✕` character looks out of place. A broken film frame with a grease-pencil rejection mark is how actual film editors would mark a bad take. |
| **Prompt** | `Hand-drawn pen sketch of a single film frame with a diagonal crack shattering across it like broken glass. A bold "X" is drawn over the frame in red grease pencil. Film sprocket holes visible on the edges. Navy indigo ink (#1B2A3A) for the frame and crack, red-grease (#A0392C) for the X mark. On transparent/cream background. Square, 128x128px.` |
| **Priority** | **Medium** — small but visible improvement |

### 7C. Timeline Section Divider — Between Clips

| Field | Detail |
|-------|--------|
| **Name** | `clip-connector-arrow.png` |
| **Where** | `app/projects/[id]/timeline/timeline.tsx` — between clip cards in the horizontal scroll |
| **Depicts** | A small hand-drawn arrow connecting two sprocket holes, with a tiny vine tendril wrapping around the arrow shaft. Like a "then" connector in a storyboard. |
| **UX purpose** | The timeline currently has cards with `gap-3` between them. A small connecting arrow between clips reinforces the *chain* metaphor — each clip seeds the next. |
| **Prompt** | `Tiny hand-drawn pen sketch of a rightward-pointing arrow connecting two film sprocket holes. A small ivy vine tendril wraps around the arrow shaft. Minimal connector element, like a storyboard transition mark. Navy indigo ink (#1B2A3A) on transparent background. Wide and short, 48x24px.` |
| **Priority** | **Low** — subtle enhancement |

---

## 8. Clip Detail Sheet

### 8A. Video Processing — "Examining the Reel" Enhanced

| Field | Detail |
|-------|--------|
| **Name** | `projector-warming-up.png` |
| **Where** | `app/projects/[id]/timeline/clip-detail-sheet.tsx` — the queued/processing placeholder (currently uses `search-reel.png`) |
| **Depicts** | A vintage film projector with its light warming up — a cone of light emanating from the lens, with dust motes visible in the beam. The take-up reel is empty, waiting. Film leader (countdown) threads through the gate. |
| **UX purpose** | The existing `search-reel.png` works but this would be more specifically evocative of "your clip is being prepared for projection." The projector warming up is the perfect metaphor for video generation in progress. |
| **Prompt** | `Hand-drawn pen sketch of a vintage film projector with its lamp warming up. A cone of light emanates from the lens, with tiny dust motes visible in the beam. The take-up reel is empty, waiting to receive film. Film leader with countdown numbers threads through the projector gate. Navy indigo ink (#1B2A3A) on warm cream parchment (#F5EFE0), sepia (#B8956A) on the light cone, faint gold (#E8D27A) on the lamp glow. Vintage technical illustration style. Portrait, 3:4, 360x480px.` |
| **Priority** | **Medium** — the current illustration works, this would be an upgrade |

### 8B. Critique Display — "The Chorus Says" Header

| Field | Detail |
|-------|--------|
| **Name** | `chorus-speaking.png` |
| **Where** | `app/projects/[id]/timeline/clip-detail-sheet.tsx` — header decoration for the critique panel |
| **Depicts** | Three Greek chorus figures with masks, speaking in unison. Speech emanates from their mouths as intertwined lines that become film strips. Small and decorative, like a section header illumination. |
| **UX purpose** | The critique feature is one of Nysus's most distinctive interactions (the "Consult the chorus" button is Dionysian framing per user preference). An illustration of the chorus literally speaking reinforces this mythology beautifully. |
| **Prompt** | `Hand-drawn pen sketch of three Greek chorus figures wearing theatrical masks, standing in a row and speaking in unison. The lines of speech from their mouths intertwine and transform into film strips flowing to the right. Small and decorative, meant as a section header ornament. Navy indigo ink (#1B2A3A) on warm cream (#F5EFE0), sepia (#B8956A) accents on the masks. Wide and short, 400x80px.` |
| **Priority** | **High** — reinforces the app's unique Dionysian identity |

### 8C. Critique Loading State

| Field | Detail |
|-------|--------|
| **Name** | `chorus-deliberating.png` |
| **Where** | `app/projects/[id]/timeline/clip-detail-sheet.tsx` — shown while critique is loading ("consulting…") |
| **Depicts** | The three chorus figures huddled together in private deliberation, masks turned toward each other, with a hand-drawn ellipsis (...) floating above them in a thought bubble. |
| **UX purpose** | The "consulting..." text is functional but missed opportunity. Showing the chorus *deliberating in private* adds humor and character — they're conferring before delivering their verdict. |
| **Prompt** | `Hand-drawn pen sketch of three Greek chorus figures huddled together in a tight circle, masks turned inward toward each other as if conferring in private. A thought bubble above the group contains a hand-drawn ellipsis "...". Small and compact. Navy indigo ink (#1B2A3A) on warm cream (#F5EFE0), sepia (#B8956A) accents. Square, 120x120px.` |
| **Priority** | **Medium** — delightful detail |

---

## 9. Seed Picker

### 9A. "No Prior Clips" Empty State

| Field | Detail |
|-------|--------|
| **Name** | `empty-seed-jar.png` |
| **Where** | `app/projects/[id]/timeline/seed-picker.tsx` — the "no prior completed clips to scrub" state |
| **Depicts** | An empty glass jar labeled (with illegible handwritten scribble, no actual text), meant for preserving seeds, sitting on a shelf. A single dried vine leaf rests beside it. The jar catches light but contains nothing. |
| **UX purpose** | The seed metaphor (each clip's last frame "seeds" the next) is central to Nysus. An empty seed jar makes this concept visceral and gives the user a visual vocabulary for what "seed frame" means. |
| **Prompt** | `Hand-drawn pen sketch of an empty glass mason jar sitting on a wooden shelf. The jar has a handwritten label (illegible scribbles, no readable text). A single dried grape vine leaf rests beside the jar. Light catches the glass surface. Navy indigo ink (#1B2A3A) on warm cream parchment (#F5EFE0), sepia (#B8956A) accents on the wood shelf and dried leaf. Vintage botanical illustration style. Square, 200x200px.` |
| **Priority** | **Low** — niche state, but the illustration is conceptually perfect |

### 9B. Seed Applied Successfully

| Field | Detail |
|-------|--------|
| **Name** | `seed-planted.png` |
| **Where** | `app/projects/[id]/timeline/seed-picker.tsx` — brief flash/confirmation when a seed is successfully applied |
| **Depicts** | A small seed/acorn planted in soil with a tiny film-frame sprout emerging. Simple, celebratory, momentary. |
| **UX purpose** | The seed picker currently just closes on success. A brief success illustration (displayed for 1-2 seconds) confirms the action and reinforces the planting metaphor. |
| **Prompt** | `Hand-drawn pen sketch of a small acorn or seed planted in a patch of earth, with a tiny sprout emerging that has a film frame as its first leaf. Radiating lines suggest growth energy. Minimal, celebratory, icon-like. Navy indigo ink (#1B2A3A) on transparent/cream background, sepia (#B8956A) on the earth, gold (#E8D27A) highlight on the sprout. Square, 120x120px.` |
| **Priority** | **Low** — micro-delight, requires new success state logic |

---

## 10. Stitch / Export Flow

### 10A. Stitching In Progress

| Field | Detail |
|-------|--------|
| **Name** | `stitching-needle.png` |
| **Where** | `app/projects/[id]/stitch/stitch-view.tsx` — shown during the concatenation process while `progress` is active |
| **Depicts** | A large sewing needle pulling dark thread through a series of connected film frames. The thread creates a continuous line linking each frame to the next. The frames at the start are tightly stitched; the ones at the end are still loose. |
| **UX purpose** | The stitch page shows text progress messages ("loading ffmpeg...", "downloading clip 2 / 5..."). An animated illustration of the stitching *in progress* makes this wait feel purposeful and thematic. Apply `animate-paper-float` for movement. |
| **Prompt** | `Hand-drawn pen sketch of a large sewing needle pulling dark thread through a series of film frames arranged in a horizontal line. The leftmost frames are tightly stitched together by the thread. The rightmost frames are still separated, waiting to be connected. The needle is mid-stitch between two frames. Navy indigo ink (#1B2A3A) on warm cream parchment (#F5EFE0), sepia (#B8956A) accents on the thread and needle eye. Landscape, 5:2, 600x240px.` |
| **Priority** | **Medium** — improves a key workflow moment |

### 10B. Export Complete — Celebration

| Field | Detail |
|-------|--------|
| **Name** | `reel-complete.png` |
| **Where** | `app/projects/[id]/stitch/stitch-view.tsx` — shown when `progress === "done"` |
| **Depicts** | A completed film reel on a pedestal or laurel wreath, with ivy wrapping the spool. Small grape clusters hang from the ivy. Warm radiant light behind. A tiny figure (the director) takes a bow beside the reel. |
| **UX purpose** | Completing a video is the culmination of the entire Nysus workflow. This deserves a *moment* — a victory illustration that makes the user feel like they've completed a real production. Currently it just says "done" and the text disappears after 3 seconds. |
| **Prompt** | `Hand-drawn pen sketch of a completed film reel resting on a classical Greek laurel wreath pedestal. Ivy vines wrap the reel spool with small grape clusters hanging from them. Warm radiant light emanates from behind the reel. A tiny figure in a director's beret takes a bow beside the pedestal. Navy indigo ink (#1B2A3A) on warm cream parchment (#F5EFE0), sepia (#B8956A) accents, warm gold (#E8D27A) in the radiant light. Celebratory, triumphant. Square, 400x400px.` |
| **Priority** | **High** — the payoff moment of the entire app deserves celebration |

---

## 11. Edit Project Page

### 11A. JSON Editor — Decorative Margin Notes

| Field | Detail |
|-------|--------|
| **Name** | `margin-note-character.png`, `margin-note-aesthetic.png` |
| **Where** | `app/projects/[id]/edit/edit-form.tsx` — beside the character sheet and aesthetic bible JSON editors |
| **Depicts** | **Character:** A tiny hand-drawn margin sketch of a quill writing a character description, with small portrait silhouettes sketched in the margin. **Aesthetic:** A tiny margin sketch of a painter's palette with color dots and a small framed landscape. |
| **UX purpose** | The edit page is pure JSON textareas — functional but cold. Small margin illustrations beside each section make it feel like a real notebook where someone has doodled while taking notes. |
| **Prompt (Character)** | `Tiny hand-drawn pen sketch margin illustration: a quill pen writing on a small page, with two miniature portrait silhouettes sketched beside it in the margin. Like a doodle in the margin of a notebook. Navy indigo ink (#1B2A3A) on transparent background. Vertical, thin margin strip, 48x120px.` |
| **Prompt (Aesthetic)** | `Tiny hand-drawn pen sketch margin illustration: a small painter's palette with three ink dots for colors, beside a miniature framed landscape sketch. Like a doodle in the margin of a notebook. Navy indigo ink (#1B2A3A) on transparent background. Vertical, thin margin strip, 48x120px.` |
| **Priority** | **Low** — nice touch for a less-visited page |

---

## 12. PWA Install Prompt

### 12A. Install Nudge Illustration

| Field | Detail |
|-------|--------|
| **Name** | `pwa-install-theater.png` |
| **Where** | `app/install-prompt.tsx` — beside the "install nysus" text |
| **Depicts** | A tiny theater marquee sign with lights around its border, suggesting "now showing" — but the marquee text area is blank. The idea is that installing the app is like getting your own permanent theater. |
| **UX purpose** | The PWA install prompt is a small toast. A tiny marquee illustration makes it feel like an invitation to a premiere rather than a technical nudge. |
| **Prompt** | `Tiny hand-drawn pen sketch of a vintage theater marquee sign with decorative light bulbs around its border. The sign face is blank/empty. Small ornamental scrollwork at the top. Navy indigo ink (#1B2A3A) on transparent/cream background, sepia (#B8956A) on the light bulbs. Compact, icon-like. Square, 64x64px.` |
| **Priority** | **Low** — the prompt is already effective |

---

## 13. Loading & Splash Screen

### 13A. Enhanced Splash — Animated Sequence

| Field | Detail |
|-------|--------|
| **Name** | `splash-projector-sequence.png` (or animated SVG/Lottie) |
| **Where** | `app/components/splash.tsx` — replace or augment the current logo-mark with a richer loading experience |
| **Depicts** | A sequence: a projector light flickers on, illuminating the Nysus logomark on a screen. Film leader countdown numbers (5, 4, 3, 2...) flash briefly before the logo appears. Could be implemented as a CSS animation over multiple layered PNGs or as an SVG animation. |
| **UX purpose** | The splash currently shows a breathing logo. A projector-startup sequence adds *narrative* to the loading moment — you're watching the projector warm up before the show begins. This is especially impactful for PWA cold starts on mobile. |
| **Prompt** | `Hand-drawn pen sketch of a vintage film projector casting a cone of light onto a screen. On the screen, the Nysus logomark (a Greek muse face framed by a film reel with ivy) is illuminated. Film countdown numbers 3, 2, 1 are faintly visible in the light cone. Dust motes float in the light beam. Navy indigo ink (#1B2A3A) on warm cream parchment (#F5EFE0), warm gold (#E8D27A) in the projector light, sepia (#B8956A) accents. Square, 480x480px.` |
| **Priority** | **Medium** — splash is already functional, this is an upgrade |

---

## 14. Global Decorative & Texture Assets

### 14A. Film Grain Overlay

| Field | Detail |
|-------|--------|
| **Name** | `film-grain-overlay.png` |
| **Where** | `app/globals.css` — applied as a subtle fixed overlay on `body::after` at very low opacity (2-4%) |
| **Depicts** | Film grain / noise pattern typical of 35mm analog film. Not a clean digital noise — slightly irregular, with occasional hair/scratch marks like real celluloid. |
| **UX purpose** | Adds an almost subliminal analog film quality to every screen. Users won't consciously notice it but will feel the app is "warmer" and more cinematic. Combined with the paper texture (#3B), it creates a deeply immersive tactile quality. |
| **Prompt** | `Seamless tileable analog film grain texture. Visible but subtle grain particles of varying size, with occasional thin scratch lines and a single hair-like fiber — authentic 35mm film artifacts. Monochrome, dark gray particles on transparent background. Must tile seamlessly in both directions. Square, 512x512px.` |
| **Priority** | **High** — low-effort, high-impact atmospheric enhancement |

### 14B. Decorative Page Border — Notebook Edge

| Field | Detail |
|-------|--------|
| **Name** | `notebook-edge-left.png` |
| **Where** | Applied via CSS to the left edge of the main content area on desktop viewports, creating the illusion that the app lives inside a physical notebook |
| **Depicts** | A vertical strip showing the left edge of a leather-bound notebook — the spine, ring holes or stitching, and the slight shadow where pages meet the binding. |
| **UX purpose** | On wider screens (>768px), the app has a lot of empty space on the sides. A notebook-edge border on the left side of the content column makes the `max-w-2xl`/`max-w-3xl` constraint feel intentional — this is a *notebook*, not a responsive web app. |
| **Prompt** | `Hand-drawn pen sketch of the left edge/spine of a leather-bound notebook seen from the front. Visible stitching or ring binding holes along the spine. The paper edges are slightly rough/deckled. A thin shadow where the page meets the binding. Vertical strip, very narrow. Navy indigo ink (#1B2A3A) on warm cream (#F5EFE0), sepia (#B8956A) on the leather and stitching. Tall and very narrow, 40x800px, tileable vertically.` |
| **Priority** | **Medium** — significant desktop experience improvement |

### 14C. Sprocket Hole Border Pattern

| Field | Detail |
|-------|--------|
| **Name** | `sprocket-border-vertical.png` |
| **Where** | Applied as a subtle repeating border on the right edge of the chat panel, or on modal edges |
| **Depicts** | A vertical strip of film sprocket holes — the rectangular perforations along the edge of 35mm film. Hand-drawn, slightly irregular. |
| **UX purpose** | A repeating sprocket-hole strip along panel edges reinforces the film metaphor without requiring full illustrations. Subtle, structural, and endlessly tileable. |
| **Prompt** | `Hand-drawn pen sketch of a vertical strip of 35mm film sprocket holes. Rectangular perforations evenly spaced, slightly irregular as if drawn by hand rather than machine-cut. The film edge has fine grain texture. Navy indigo ink (#1B2A3A) on transparent background. Tall and very narrow, 24x256px, must tile seamlessly vertically.` |
| **Priority** | **Medium** — versatile structural element |

---

## 15. Micro-Illustrations & Icons

### 15A. Custom Button Icons (Set of 6)

| Field | Detail |
|-------|--------|
| **Name** | `icon-generate.png`, `icon-regenerate.png`, `icon-delete.png`, `icon-stitch.png`, `icon-chorus.png`, `icon-seed.png` |
| **Where** | Various buttons throughout: Generate (shot card), Regenerate (clip detail), Delete (clip detail), Stitch (workspace header), Consult the chorus (clip detail), Change seed (clip detail) |
| **Depicts** | **Generate:** A clapperboard snapping shut. **Regenerate:** A circular arrow made of film strip. **Delete:** Scissors cutting film. **Stitch:** Needle and thread. **Chorus:** Three masks. **Seed:** An acorn sprouting. |
| **UX purpose** | All action buttons currently use text only. Small inline icons beside the text labels would make buttons scannable at a glance and reinforce the film/mythology metaphor in every interaction. |
| **Prompt (Generate)** | `Tiny hand-drawn pen icon of a film clapperboard snapping shut, motion lines suggest the clap. Minimal line art, 2px stroke weight. Navy indigo ink (#1B2A3A) on transparent background. Square, 24x24px.` |
| **Prompt (Regenerate)** | `Tiny hand-drawn pen icon of a circular arrow made of film strip with sprocket holes. The arrow curves back on itself suggesting retry/redo. Minimal line art. Navy indigo ink (#1B2A3A) on transparent background. Square, 24x24px.` |
| **Prompt (Delete)** | `Tiny hand-drawn pen icon of scissors cutting through a strip of film. Minimal line art. Navy indigo ink (#1B2A3A) with red-grease (#A0392C) accent on the cut line. Square, 24x24px.` |
| **Prompt (Stitch)** | `Tiny hand-drawn pen icon of a sewing needle trailing thread through connected film frames. Minimal line art. Navy indigo ink (#1B2A3A) on transparent background. Square, 24x24px.` |
| **Prompt (Chorus)** | `Tiny hand-drawn pen icon of three classical Greek theatrical masks in a row — tragedy, comedy, neutral. Minimal line art. Navy indigo ink (#1B2A3A) on transparent background. Square, 24x24px.` |
| **Prompt (Seed)** | `Tiny hand-drawn pen icon of an acorn with a small sprout emerging from the top that looks like a film frame. Minimal line art. Navy indigo ink (#1B2A3A) on transparent background. Square, 24x24px.` |
| **Priority** | **Medium** — systematic improvement across all actions |

### 15B. Status Badge Icons

| Field | Detail |
|-------|--------|
| **Name** | `badge-queued.png`, `badge-processing.png`, `badge-complete.png`, `badge-failed.png` |
| **Where** | `app/projects/[id]/timeline/clip-card.tsx` — beside the text status labels |
| **Depicts** | **Queued:** An hourglass with film frames instead of sand. **Processing:** A spinning film reel (static, suggest motion). **Complete:** A laurel wreath. **Failed:** A cracked lens. |
| **UX purpose** | Status communication currently relies on text and color alone. Iconic representations make status immediately readable even at small sizes in the horizontal scroll timeline. |
| **Prompt (Queued)** | `Tiny hand-drawn pen icon of an hourglass where the falling grains are tiny film frames. Minimal line art. Navy indigo ink (#1B2A3A) on transparent background. Square, 20x20px.` |
| **Prompt (Processing)** | `Tiny hand-drawn pen icon of a film reel in motion, with motion blur lines suggesting spinning. Minimal line art. Navy indigo ink (#1B2A3A) and sepia (#B8956A). Square, 20x20px.` |
| **Prompt (Complete)** | `Tiny hand-drawn pen icon of a small classical laurel wreath. Minimal line art. Navy indigo ink (#1B2A3A) on transparent background. Square, 20x20px.` |
| **Prompt (Failed)** | `Tiny hand-drawn pen icon of a cracked camera lens or monocle. Minimal line art. Red-grease (#A0392C) on transparent background. Square, 20x20px.` |
| **Priority** | **Low** — nice-to-have refinement |

---

## 16. Share & Social

### 16A. Video Share Card Template

| Field | Detail |
|-------|--------|
| **Name** | `share-card-frame.png` |
| **Where** | Future feature: when sharing a completed video, overlay this frame on the thumbnail |
| **Depicts** | An ornate picture frame combining classical Greek column elements with film strip borders. The interior is empty/transparent (the video thumbnail goes there). "NYSUS" is subtly worked into the bottom border as part of the ornamental design. The frame has the feel of a vintage film premiere lobby card. |
| **UX purpose** | When users share their generated videos (future feature), a branded frame turns every share into an advertisement for Nysus. The classical/film aesthetic makes it distinctive and desirable rather than corporate. |
| **Prompt** | `Hand-drawn pen sketch of an ornate rectangular picture frame. The frame combines classical Greek ionic column elements on the sides with film strip borders along top and bottom. The interior is empty/transparent. Small ivy vine details at the corners. The word "NYSUS" is subtly integrated into the bottom border as decorative text, part of the frame design. Navy indigo ink (#1B2A3A) on transparent background, sepia (#B8956A) accents on the column capitals and ivy. Portrait, 9:16, 540x960px.` |
| **Priority** | **Medium** — depends on share feature, but the asset can be prepared now |

### 16B. OG Image — Enhanced

| Field | Detail |
|-------|--------|
| **Name** | `og-image-v2.png` |
| **Where** | `app/layout.tsx` metadata — the social sharing preview image (already referenced but could be improved) |
| **Depicts** | A filmmaker's desk from above: the Nysus logomark on an open leather notebook, a vintage film reel, scattered script pages with handwritten notes, a fountain pen, dried grape vines, and a small Greek theatrical mask. Warm golden-hour lighting. Rich and detailed — this is the app's public face. |
| **UX purpose** | The OG image is what appears when anyone shares a Nysus link on Twitter, Discord, Slack, etc. It needs to be immediately compelling and communicate "vintage filmmaker's creative tool" at a glance. |
| **Prompt** | `Detailed hand-drawn pen illustration of a filmmaker's desk seen from directly above. Center: an open leather-bound notebook with the Nysus logomark (Greek muse face in a film reel with ivy) on the left page. Surrounding the notebook: a vintage film reel with ivy wrapping the spool, scattered handwritten script pages, a fountain pen with navy ink, a small bunch of grapes, a classical Greek comedy mask, and a strip of developed film showing tiny frames. Warm golden-hour lighting from the upper right. Navy indigo ink (#1B2A3A) on warm cream parchment (#F5EFE0), sepia (#B8956A) accents throughout, warm gold (#E8D27A) in the light. Rich, detailed, cinematic. Landscape, 1200x630px (OG image standard).` |
| **Priority** | **High** — the app's public face on social media |

---

## 17. Seasonal & Mood Variations

### 17A. Time-of-Day Greeting Illustrations (4 variants)

| Field | Detail |
|-------|--------|
| **Name** | `greeting-dawn.png`, `greeting-day.png`, `greeting-dusk.png`, `greeting-night.png` |
| **Where** | `app/page.tsx` or `app/projects/[id]/workspace.tsx` — small illustration beside a time-aware greeting ("good morning" / "good evening") |
| **Depicts** | **Dawn:** A theater with its doors just opening, first light streaming in, an early bird (owl returning to roost) on the marquee. **Day:** A bright amphitheater with the sun overhead, laurel wreaths on the seats. **Dusk:** A theater at golden hour, marquee lights just flickering on, long shadows. **Night:** A theater lit entirely by footlights and starlight, the moon replacing the spotlight. |
| **UX purpose** | Time-aware greetings with matching illustrations create emotional resonance — the app acknowledges when you're working. "Good evening" with a moonlit theater feels like the app *knows you're doing a late-night creative session*. |
| **Prompt (Dawn)** | `Hand-drawn pen sketch of a small Greek amphitheater at dawn. The entrance doors are just opening, with first light streaming through. A small owl perches on the top, returning from the night. Soft and quiet mood. Navy indigo ink (#1B2A3A) on warm cream (#F5EFE0), pale gold (#E8D27A) in the dawn light, sepia (#B8956A) on the stone. Landscape, 3:2, 240x160px.` |
| **Prompt (Day)** | `Hand-drawn pen sketch of a bright Greek amphitheater in full daylight. The sun is high overhead. Laurel wreaths decorate the stone seats. Ivy grows on the columns. Energetic and open mood. Navy indigo ink (#1B2A3A) on warm cream (#F5EFE0), sepia (#B8956A) on the stone and wreaths. Landscape, 3:2, 240x160px.` |
| **Prompt (Dusk)** | `Hand-drawn pen sketch of a theater facade at golden hour. Vintage marquee lights are just flickering on. Long dramatic shadows stretch across the entrance steps. Warm and nostalgic mood. Navy indigo ink (#1B2A3A) on warm cream (#F5EFE0), rich sepia (#B8956A) and gold (#E8D27A) in the dusk light. Landscape, 3:2, 240x160px.` |
| **Prompt (Night)** | `Hand-drawn pen sketch of a Greek amphitheater at night, lit by footlights from the stage and starlight above. The moon replaces the spotlight, casting a silver beam onto center stage. A few moths orbit the footlights. Mysterious and intimate mood. Navy indigo ink (#1B2A3A) on warm cream (#F5EFE0), cool blue-gray tints, sepia (#B8956A) on the footlight glow. Landscape, 3:2, 240x160px.` |
| **Priority** | **Low** — delightful but requires new logic + 4 assets |

---

## 18. Video Player Enhancements

### 18A. Video Thumbnail Placeholder

| Field | Detail |
|-------|--------|
| **Name** | `video-placeholder-curtain.png` |
| **Where** | `app/projects/[id]/timeline/clip-detail-sheet.tsx` — before the signed video URL loads |
| **Depicts** | A theater curtain (red/wine-dark tones rendered in pen ink) drawn closed over a 9:16 frame. A small "loading" hourglass-with-film-frames icon in the center. The implication: the curtain is about to open and reveal your clip. |
| **UX purpose** | Before the video URL is signed and loaded, there's a brief moment of nothing. A curtain placeholder makes this feel theatrical — the show is about to start. |
| **Prompt** | `Hand-drawn pen sketch of heavy theater curtains drawn closed, filling a portrait 9:16 frame. The curtains have rich fabric folds and tasseled edges. A small hourglass icon sits centered where the curtains meet. Dark wine (#5B1A2B) tinted ink rendering of the curtain fabric using dense crosshatching, on warm cream parchment (#F5EFE0), sepia (#B8956A) on the tassels. Portrait, 9:16, 360x640px.` |
| **Priority** | **Low** — very brief display time |

### 18B. Custom Play Button Overlay

| Field | Detail |
|-------|--------|
| **Name** | `play-button-clapperboard.png` |
| **Where** | Could overlay on video elements or thumbnail previews in the timeline |
| **Depicts** | A play triangle (▶) formed by the negative space inside a hand-drawn film clapperboard. The clapperboard's top stick is "open" (raised), and the triangular gap between the sticks forms the play symbol. |
| **UX purpose** | A custom play button that's thematically integrated with the film metaphor. More distinctive than a generic triangle. |
| **Prompt** | `Hand-drawn pen sketch of a film clapperboard with its top stick raised open. The triangular gap between the raised stick and the base naturally forms a play button (▶) shape. The clapperboard has visible wood grain and chalk marks. Navy indigo ink (#1B2A3A) on transparent background. Square, 96x96px.` |
| **Priority** | **Low** — pure visual polish |

---

## 19. Nysus Watermark

### 19A. Export Watermark

| Field | Detail |
|-------|--------|
| **Name** | `watermark-nysus.png` |
| **Where** | `app/projects/[id]/stitch/stitch-view.tsx` — optional watermark burned into exported MP4 (user toggle) |
| **Depicts** | A very subtle, semi-transparent version of the Nysus logomark (muse face in film reel) with "NYSUS" in small tracking below. Designed to be overlaid at ~15% opacity in a video corner. |
| **UX purpose** | Branded watermark for exported videos, turned on by default but togglable. Every exported video becomes a subtle ambassador for the app. Must be unobtrusive enough not to ruin the content. |
| **Prompt** | `Minimal version of the Nysus logomark: a Greek muse face framed by a film reel with small ivy accents. Below, "NYSUS" in elegant small-caps serif lettering with wide tracking. Designed as a watermark — clean line art meant to be displayed at low opacity. White lines on transparent background (will be overlaid on video). Square, 200x200px.` |
| **Priority** | **Medium** — requires export feature enhancement but asset can be pre-made |

---

## Priority Summary

### High Priority (ship these first)
1. **Paper grain texture** (14A) — foundational, elevates every screen
2. **Film grain overlay** (14A) — atmospheric, easy to implement
3. **Director thinking illustration** (6A) — most frequent interaction
4. **Chat empty state illustration** (6B) — core screen first impression
5. **Export complete celebration** (10B) — the payoff moment
6. **Chorus speaking header** (8B) — Dionysian identity
7. **Onboarding carousel** (2A) — new user experience
8. **Login hero illustration** (1A) — first impression
9. **OG image v2** (16B) — public-facing
10. **Clip developing illustration** (7A) — replaces jarring spinner

### Medium Priority (second wave)
11. Magic link sent owl (1B)
12. Feature discovery tooltips (2B)
13. Workspace divider (5A)
14. Character sheet empty state (5B)
15. Aesthetic bible empty state (5C)
16. Shot card borders (6C)
17. Script mode background (6D)
18. Clip failed icon (7B)
19. Projector warming up (8A)
20. Chorus deliberating (8C)
21. Stitching in progress (10A)
22. New project clapperboard (4A)
23. Notebook edge border (14B)
24. Sprocket hole border (14C)
25. Custom button icons (15A)
26. Share card frame (16A)
27. Export watermark (19A)

### Low Priority (polish layer)
28. Auth error illustration (1C)
29. Project card corner flourish (3A)
30. Delete confirmation (3C)
31. Timeline connector arrows (7C)
32. Empty seed jar (9A)
33. Seed planted (9B)
34. Edit page margin notes (11A)
35. PWA install marquee (12A)
36. Splash projector sequence (13A)
37. Status badge icons (15B)
38. Time-of-day greetings (17A)
39. Video placeholder curtain (18A)
40. Custom play button (18B)

---

## Style Reference — for all prompts

Append these keywords to any Flux 1.1 Pro generation for consistency:

```
Style keywords: hand-drawn pen and ink illustration, vintage notebook sketch, 
fountain pen crosshatching, warm cream parchment paper, classical cinema meets 
Greek mythology aesthetic, Dionysian motifs, film reel and ivy vine decorative 
elements, analog not digital, imperfect human linework

Color palette: cream paper (#F5EFE0), navy-black ink (#1B2A3A), sepia accent 
(#B8956A), highlight gold (#E8D27A), wine-dark (#5B1A2B) sparingly, 
red-grease (#A0392C) for errors only

Negative prompt: no glossy surfaces, no gradients, no digital effects, no 
photorealistic rendering, no bright colors, no modern UI elements, no emoji, 
no comic style, no watercolor washes unless specified
```
