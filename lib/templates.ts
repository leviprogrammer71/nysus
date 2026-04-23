import type { CharacterSheet, AestheticBible } from "@/lib/supabase/types";

/**
 * Quick-start project templates. Each template seeds a character_sheet
 * + aesthetic_bible so Dio has something to react to on turn 1 instead
 * of interviewing a blank page.
 *
 * Keep the templates evocative but sparse — we want to prime the
 * assistant, not script the user.
 */
export interface ProjectTemplate {
  slug: "blank" | "music_video" | "short_thriller" | "product_teaser" | "doc_portrait";
  name: string;
  blurb: string;
  character_sheet: CharacterSheet;
  aesthetic_bible: AestheticBible;
}

export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    slug: "blank",
    name: "Blank canvas",
    blurb: "Start from scratch. Dio will draft everything.",
    character_sheet: {},
    aesthetic_bible: {},
  },
  {
    slug: "music_video",
    name: "Music video",
    blurb: "Stylized, rhythmic, 60–90 second vertical cut.",
    character_sheet: {
      characters: [
        {
          name: "Lead performer",
          age: "mid-20s",
          appearance: "expressive eyes, strong silhouette, moves confidently through frame",
          wardrobe: "cohesive signature look — single statement color",
          demeanor: "magnetic, in their element",
          reference_images: [],
        },
      ],
      setting: {
        primary: "a recurring location that anchors the cuts",
        recurring_symbol: "one prop or object that appears each scene",
      },
    },
    aesthetic_bible: {
      visual_style: "stylized · graphic · high contrast",
      palette: "two strong hues + black, neon-adjacent",
      camera: "handheld with intentional motion blur; occasional locked-off insert",
      aspect_ratio: "9:16",
      audio_signature: "bass-forward, rhythmic percussion",
      thematic_motifs: ["transformation", "ritual"],
      forbidden: ["stock pop colors", "photorealism"],
    },
  },
  {
    slug: "short_thriller",
    name: "Short thriller",
    blurb: "Atmospheric, restrained, a single escalating scene.",
    character_sheet: {
      characters: [
        {
          name: "The protagonist",
          age: "30s",
          appearance: "tired, tense, composed",
          wardrobe: "understated — nothing that reads as costume",
          demeanor: "watchful, one step behind",
          reference_images: [],
        },
      ],
      setting: {
        primary: "a quiet domestic space that turns hostile by the end",
        recurring_symbol: "a single object that keeps reappearing",
      },
    },
    aesthetic_bible: {
      visual_style: "cinematic 35mm · desaturated · shallow depth of field",
      palette: "muted cool tones with one warm accent",
      camera: "slow dolly-ins, handheld only in stress moments",
      aspect_ratio: "9:16",
      audio_signature: "low drone + ticking small sounds",
      thematic_motifs: ["dread", "the everyday turning"],
      forbidden: ["jump scares", "quick cuts under 1 sec"],
    },
  },
  {
    slug: "product_teaser",
    name: "Product teaser",
    blurb: "Clean 15-second announce for a physical product.",
    character_sheet: {
      characters: [
        {
          name: "The hand",
          appearance: "shot is close on the product with a single pair of hands",
          wardrobe: "hands only — neutral sleeve",
          demeanor: "assured, unhurried",
          reference_images: [],
        },
      ],
      setting: {
        primary: "seamless studio backdrop that matches the product's tone",
        recurring_symbol: "the product itself",
      },
    },
    aesthetic_bible: {
      visual_style: "commercial · clean · editorial",
      palette: "two-tone — product color + complementary surface",
      camera: "locked-off macro and medium, minimal movement",
      aspect_ratio: "9:16",
      audio_signature: "a single resonant tone per cut + one tagline at the end",
      thematic_motifs: ["precision", "inevitability"],
      forbidden: ["lens flares", "stock upbeat music"],
    },
  },
  {
    slug: "doc_portrait",
    name: "Doc portrait",
    blurb: "Intimate one-subject profile, 45–60 seconds.",
    character_sheet: {
      characters: [
        {
          name: "The subject",
          appearance: "described in the subject's own words — keep the look specific",
          wardrobe: "whatever they'd wear on a normal day",
          demeanor: "honest, unguarded",
          reference_images: [],
        },
      ],
      setting: {
        primary: "a space the subject knows well — home, studio, or workplace",
      },
    },
    aesthetic_bible: {
      visual_style: "observational documentary naturalism",
      palette: "natural light only",
      camera: "handheld medium and close-up; cutaways to the hands",
      aspect_ratio: "9:16",
      audio_signature: "voiceover over ambient room tone, no score",
      thematic_motifs: ["craft", "quiet labor"],
      forbidden: ["re-enactments", "interview b-roll tropes"],
    },
  },
];

export function templateBySlug(slug: string): ProjectTemplate | null {
  return PROJECT_TEMPLATES.find((t) => t.slug === slug) ?? null;
}
