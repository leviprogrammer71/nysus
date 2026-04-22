# Nysus Visual Asset Audit & Audio Transcription Review

## Part 1: Image / Illustration Audit

### Design Language Reference

Every prompt below targets the **Nysus aesthetic**: warm cream paper (#F5EFE0), navy-black ink (#1B2A3A), sepia accents (#B8956A), Dionysian/theatrical motifs, hand-drawn notebook feel. Think vintage filmmaker's desk — ink sketches on aged paper, not glossy tech.

---

### A. PWA Icons & Favicon (4 assets)

#### 1. App Icon — Standard (192×192)

| Field | Value |
|-------|-------|
| **Current** | Placeholder "N" on cream circle |
| **File** | `/public/icons/icon-192.png` |
| **Referenced in** | `manifest.webmanifest` (line 14), `layout.tsx` metadata icons + apple icon |
| **Should depict** | The Nysus brand mark — a stylized theatrical mask or vine-wrapped "N" that reads clearly at small sizes |
| **AI prompt** | `A minimal app icon on a warm cream (#F5EFE0) background. A single elegant letter "N" drawn in navy ink (#1B2A3A) with subtle vine tendrils curling from the serifs, evoking Dionysus and theater. Thin sepia (#B8956A) line-art grape leaves accent the upper-right. Style: hand-drawn ink illustration on aged paper, clean and legible at small sizes. No text other than the letter. Square composition, 192×192px, flat with no drop shadow.` |
| **Dimensions** | 192×192 PNG, transparent or cream background |
| **Filename** | `/public/icons/icon-192.png` |

#### 2. App Icon — High-Res (512×512)

| Field | Value |
|-------|-------|
| **Current** | Placeholder "N" on cream circle |
| **File** | `/public/icons/icon-512.png` |
| **Referenced in** | `manifest.webmanifest` (line 20) |
| **Should depict** | Same concept as 192px icon, higher detail — vine tendrils more intricate, subtle paper texture visible |
| **AI prompt** | `A detailed app icon on warm cream (#F5EFE0) parchment background. An elegant serif letter "N" rendered in navy ink (#1B2A3A) with hand-drawn vine tendrils curling gracefully from the letter's strokes, small grape clusters in sepia (#B8956A). Faint ruled notebook lines behind. Style: vintage ink illustration, fountain pen on aged paper, detailed enough for 512px rendering. Square composition, 512×512px.` |
| **Dimensions** | 512×512 PNG |
| **Filename** | `/public/icons/icon-512.png` |

#### 3. Maskable Icon (512×512, safe zone)

| Field | Value |
|-------|-------|
| **Current** | Placeholder "N" on cream circle |
| **File** | `/public/icons/icon-maskable.png` |
| **Referenced in** | `manifest.webmanifest` (line 26) |
| **Should depict** | Same "N" mark but centered in safe zone (inner 80%) with cream (#F5EFE0) filling the full square — no transparency |
| **AI prompt** | `App icon for Android adaptive/maskable format. Solid warm cream (#F5EFE0) background filling entire square. Centered in the inner 80%: an elegant serif letter "N" in navy ink (#1B2A3A) with minimal vine accent in sepia (#B8956A). Keep the design compact and centered — edges will be cropped to circles/squircles by the OS. Style: clean ink on paper. 512×512px.` |
| **Dimensions** | 512×512 PNG, NO transparency, full bleed cream background |
| **Filename** | `/public/icons/icon-maskable.png` |

#### 4. Favicon (32×32)

| Field | Value |
|-------|-------|
| **Current** | Placeholder "N" (404 bytes) |
| **File** | `/public/icons/favicon-32.png` |
| **Referenced in** | **NOT referenced in metadata** — needs to be added to `layout.tsx` |
| **Should depict** | Extremely simplified "N" mark — just the letter, no vine detail at this size |
| **AI prompt** | `Tiny favicon, 32×32 pixels. A bold serif letter "N" in navy (#1B2A3A) centered on cream (#F5EFE0) background. No decoration — must be legible in a browser tab. Pixel-crisp, no anti-aliasing blur. Square, 32×32px.` |
| **Dimensions** | 32×32 PNG |
| **Filename** | `/public/icons/favicon-32.png` |
| **Action needed** | Add to `layout.tsx` metadata: `icon: [{ url: "/icons/favicon-32.png", sizes: "32x32" }, { url: "/icons/icon-192.png", sizes: "192x192" }]` |

---

### B. In-App Logo / Branding (3 locations)

#### 5. Home Page Header Logo

| Field | Value |
|-------|-------|
| **Current** | `<span>N</span>` in a 36×36 circle with ink border (`page.tsx` line 37–46) |
| **Component** | `app/page.tsx` — top of project list |
| **Should depict** | Small inline Nysus logomark (vine "N") next to the "NYSUS" wordmark |
| **AI prompt** | `A tiny circular emblem, 36×36px. Hand-drawn serif "N" in navy ink (#1B2A3A) with a single vine curl, on cream (#F5EFE0) paper. Thin circular border in navy. Style: ink stamp on a notebook page. Transparent background outside the circle.` |
| **Dimensions** | 36×36 or 48×48 PNG/SVG (will be displayed at 36px via CSS) |
| **Recommendation** | Replace the text `<span>` with an `<img>` or inline SVG. An SVG logomark would be ideal for crisp rendering at any size. |
| **Filename** | `/public/icons/logo-mark.svg` (new file) |

#### 6. Login Page Logo

| Field | Value |
|-------|-------|
| **Current** | `<div>N</div>` in a 48×48 circle with ink border (`login/page.tsx` line 12–17) |
| **Component** | `app/login/page.tsx` — sign-in screen header |
| **Should depict** | Same logomark as #5 but rendered at 48px — the first thing users see |
| **AI prompt** | Same SVG as #5, displayed at 48px. No separate asset needed if using SVG. |
| **Recommendation** | Reuse the same `logo-mark.svg` with `className="w-12 h-12"` |

#### 7. Setup Page Logo

| Field | Value |
|-------|-------|
| **Current** | `<div>N</div>` in a 48×48 circle with ink border (`setup/page.tsx` line 28–33) |
| **Component** | `app/setup/page.tsx` — environment configuration |
| **Should depict** | Same logomark, same treatment as login page |
| **Recommendation** | Reuse `logo-mark.svg` |

---

### C. Empty States & Error Illustrations (4 assets)

#### 8. Empty Project List ("The notebook is empty")

| Field | Value |
|-------|-------|
| **Current** | `∅` symbol in a 96×96 circle (`page.tsx` line 107–112) |
| **Component** | `app/page.tsx` — shown when user has no projects |
| **Should depict** | An open blank notebook with a fountain pen resting on it, inviting the user to start their first project |
| **AI prompt** | `An illustration of an open blank notebook on a wooden desk, seen from above. A fountain pen with navy ink rests diagonally across the empty pages. Faint ruled lines on the cream paper. A single dried grape vine tendril curls in from the edge. Warm ambient lighting. Style: vintage hand-drawn ink and watercolor sketch on aged cream paper (#F5EFE0), navy (#1B2A3A) and sepia (#B8956A) tones only. No text. Aspect ratio 1:1, 200×200px.` |
| **Dimensions** | 200×200 PNG or SVG |
| **Filename** | `/public/illustrations/empty-notebook.svg` |

#### 9. 404 Not Found Page

| Field | Value |
|-------|-------|
| **Current** | `∅` symbol in a 56×56 circle (`not-found.tsx` line 7–12) |
| **Component** | `app/not-found.tsx` — "Scene not found" |
| **Should depict** | A broken film reel or torn script page — theatrical "this scene doesn't exist" |
| **AI prompt** | `An illustration of a torn film script page floating in empty space, with a broken film reel beside it. A few frames of blank celluloid curl away. Small theatrical mask (tragedy) faintly visible in the background. Style: hand-drawn ink sketch on cream paper (#F5EFE0), navy ink (#1B2A3A) lines with sepia (#B8956A) accents. Melancholy but elegant. No text. 1:1 aspect ratio, 160×160px.` |
| **Dimensions** | 160×160 PNG or SVG |
| **Filename** | `/public/illustrations/scene-not-found.svg` |

#### 10. Error Boundary Page ("Reel jammed")

| Field | Value |
|-------|-------|
| **Current** | Red `✕` symbol in a 56×56 circle (`error.tsx` line 29–34) |
| **Component** | `app/error.tsx` — global error boundary |
| **Should depict** | A jammed film projector with tangled celluloid — something went wrong mechanically |
| **AI prompt** | `An illustration of a vintage film projector with its film reel tangled and jammed. Celluloid strip spills out in messy loops. Small wisps of smoke rise from the mechanism. Style: hand-drawn ink sketch with red pencil (#A0392C) accents for the tangle/smoke, navy (#1B2A3A) for the projector, on cream paper (#F5EFE0). Dramatic but not alarming. No text. 1:1, 160×160px.` |
| **Dimensions** | 160×160 PNG or SVG |
| **Filename** | `/public/illustrations/reel-jammed.svg` |

#### 11. Clip Generation Failed

| Field | Value |
|-------|-------|
| **Current** | Red `✕` character, 48px (`timeline/clip-card.tsx` line 83–87) |
| **Component** | `app/projects/[id]/timeline/clip-card.tsx` — failed clip overlay |
| **Should depict** | Keep as a simple icon (this appears on small clip cards). Consider a small "crossed-out clapperboard" SVG icon |
| **AI prompt** | `A tiny icon of a film clapperboard with a diagonal red (#A0392C) pencil line struck through it. Navy (#1B2A3A) outlines on transparent background. Minimalist line-art style, 2px stroke. 32×32px.` |
| **Dimensions** | 32×32 SVG |
| **Filename** | `/public/icons/clip-failed.svg` |

---

### D. Contextual Empty States (2 text-only spots needing illustrations)

#### 12. Timeline Empty State ("clips will appear here")

| Field | Value |
|-------|-------|
| **Current** | Text only: "clips will appear here as you generate them" (`timeline/timeline.tsx` line 14–20) |
| **Component** | `app/projects/[id]/timeline/timeline.tsx` |
| **Should depict** | A film strip with empty frames, suggesting clips will fill in |
| **AI prompt** | `A horizontal film strip with 4-5 empty frames, slightly curling at the edges like real celluloid. Faint dotted outlines suggest where images will appear. A small pencil hovers near the first frame as if about to sketch. Style: hand-drawn ink illustration, navy (#1B2A3A) lines on cream (#F5EFE0), sepia (#B8956A) dotted frame borders. Horizontal composition, 280×80px.` |
| **Dimensions** | 280×80 PNG or SVG |
| **Filename** | `/public/illustrations/empty-timeline.svg` |

#### 13. Stitch View Empty State ("nothing to stitch")

| Field | Value |
|-------|-------|
| **Current** | Text only: "nothing to stitch" + subtitle (`stitch/stitch-view.tsx` line 88–94) |
| **Component** | `app/projects/[id]/stitch/stitch-view.tsx` |
| **Should depict** | Loose film strips not yet connected — a needle and thread nearby suggesting they need stitching |
| **AI prompt** | `Three short disconnected film strip segments scattered loosely on a cream surface, with a vintage needle and dark thread lying beside them — suggesting they need to be stitched together. Style: hand-drawn ink and watercolor sketch, navy (#1B2A3A) and sepia (#B8956A) on cream (#F5EFE0) paper. Warm, inviting. No text. 200×120px.` |
| **Dimensions** | 200×120 PNG or SVG |
| **Filename** | `/public/illustrations/nothing-to-stitch.svg` |

---

### E. Open Graph / Social Sharing Image (1 asset — currently missing)

#### 14. OG Image

| Field | Value |
|-------|-------|
| **Current** | **Missing entirely** — no `openGraph.images` in `layout.tsx` metadata |
| **Component** | `app/layout.tsx` metadata |
| **Should depict** | A rich social preview card showing the Nysus brand — notebook on a director's desk with film elements |
| **AI prompt** | `A wide banner image for social media sharing. A filmmaker's desk seen from above: an open leather-bound notebook with "NYSUS" written in elegant serif on the cover, a vintage film reel, scattered script pages with handwritten notes, a fountain pen, and a small bunch of grapes. Warm golden-hour lighting on cream paper. Style: cinematic still life photograph with hand-drawn ink overlay elements. Color palette: cream (#F5EFE0), navy (#1B2A3A), sepia (#B8956A), deep wine (#5B1A2B). 1200×630px (OG image standard).` |
| **Dimensions** | 1200×630 PNG |
| **Filename** | `/public/og-image.png` |
| **Action needed** | Add to `layout.tsx`: `openGraph: { images: [{ url: "/og-image.png", width: 1200, height: 630 }] }` |

---

### F. Apple Splash Screens (currently missing)

#### 15. Apple Touch Startup Image

| Field | Value |
|-------|-------|
| **Current** | **Missing** — the PWA shows a white flash on iOS launch |
| **Component** | Would be added to `layout.tsx` as `<link rel="apple-touch-startup-image">` |
| **Should depict** | Full-screen splash with Nysus logomark centered on cream background |
| **AI prompt** | `A minimal splash screen: solid cream (#F5EFE0) background. Centered: the Nysus "N" logomark in navy ink (#1B2A3A) with subtle vine detail. Below it, "NYSUS" in small elegant serif tracking. Very clean, very quiet. Style: ink on paper. Portrait orientation, 1170×2532px (iPhone 14 Pro).` |
| **Dimensions** | Multiple sizes needed (1170×2532, 1284×2778, 1179×2556 for various iPhones) |
| **Filename** | `/public/splash/splash-1170x2532.png` (and variants) |

---

### G. Files to Delete (5 unused template files)

| File | Size | Notes |
|------|------|-------|
| `/public/next.svg` | 28 bytes | Empty SVG, Next.js template leftover, unreferenced |
| `/public/vercel.svg` | 28 bytes | Empty SVG, unreferenced |
| `/public/window.svg` | 28 bytes | Empty SVG, unreferenced |
| `/public/file.svg` | 28 bytes | Empty SVG, unreferenced |
| `/public/globe.svg` | 28 bytes | Empty SVG, unreferenced |

---

### Summary: All Assets Needed

| # | Asset | Type | Dimensions | Priority |
|---|-------|------|-----------|----------|
| 1 | App icon 192 | PNG | 192×192 | High |
| 2 | App icon 512 | PNG | 512×512 | High |
| 3 | Maskable icon | PNG | 512×512 | High |
| 4 | Favicon 32 | PNG | 32×32 | High |
| 5–7 | Logomark SVG | SVG | scalable | High |
| 8 | Empty notebook | SVG | ~200×200 | Medium |
| 9 | Scene not found | SVG | ~160×160 | Medium |
| 10 | Reel jammed | SVG | ~160×160 | Medium |
| 11 | Clip failed icon | SVG | 32×32 | Low |
| 12 | Empty timeline | SVG | ~280×80 | Medium |
| 13 | Nothing to stitch | SVG | ~200×120 | Medium |
| 14 | OG image | PNG | 1200×630 | High |
| 15 | Apple splash screens | PNG | various | Medium |

---

## Part 2: Audio Transcription Review

### Architecture

The app implements two voice input modes via the **Web Speech API**:

- **Quick Dictation** (`lib/use-dictation.ts`) — tap the mic button, speak, auto-stops after 2s of silence
- **Script Mode** (`lib/use-script-dictation.ts`) — long-press mic (~450ms), full overlay with voice commands

Both use `SpeechRecognition` / `webkitSpeechRecognition` with proper feature detection and SSR safety.

### What's Working Well

- **Feature detection** is correct — checks standard API first, then webkit prefix, returns `null` during SSR
- **Graceful degradation** — mic button is disabled with a tooltip ("Voice input requires Chrome or Safari") on unsupported browsers
- **Interim + final result handling** is properly implemented — interim text streams in gray, final chunks accumulate
- **Long-press differentiation** uses pointer events (works on mobile and desktop) with a 450ms threshold and haptic feedback patterns
- **Voice commands in script mode** work well: "new shot", "scratch that", "send to Claude", "character note:" — commands are stripped from the final transcript
- **Cleanup on unmount** is correct — timers cleared, `abort()` used in script mode to prevent accidental submission
- **Error handling** catches speech API errors and displays them to the user
- **Microphone permissions** rely on the browser's built-in prompt (correct for Web Speech API)

### Issues Found

#### Issue 1: Quick dictation missing voice-source hint (Medium)

When text comes from script mode, it's wrapped with a system hint:
```
[User dictated this aloud, may contain transcription errors — interpret generously...]
```

Quick dictation does **not** add this hint. The `onFinal` callback just appends raw text to the input field, so when the user hits Send, Claude treats it as typed text and may be less forgiving of transcription errors.

**Fix:** Track whether the current input includes dictated text (e.g., a ref flag) and apply the hint at send time.

#### Issue 2: Command boundary splitting (Low risk)

If the speech engine splits a voice command across two result chunks (e.g., "new" in one final result, "shot" in the next), the command won't be detected. This is rare in practice since the speech API usually groups words logically, but it's worth noting.

**Fix (optional):** Buffer the last few tokens from the previous chunk and check for commands spanning the boundary.

#### Issue 3: `favicon-32.png` unreferenced (Low — tangential)

Not a transcription issue, but `favicon-32.png` exists in `/public/icons/` without being referenced in `layout.tsx` metadata.

### Browser Compatibility Matrix

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome (desktop + Android) | Full | Native `SpeechRecognition` |
| Safari 14.5+ (macOS + iOS) | Full | `webkitSpeechRecognition` |
| Edge | Full | Chromium-based |
| Firefox | None | Mic button disabled, tooltip shown |
| Older iOS Safari (<14.5) | None | Gracefully disabled |

### Verdict

The transcription implementation is **solid and production-ready**. The architecture is clean, the two modes are well-differentiated, cleanup is correct, and unsupported browsers get a graceful fallback. The only actionable fix is adding the voice-source hint to quick dictation for parity with script mode.
