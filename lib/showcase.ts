import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * Showcase reels — the user's own finished films, served from
 * public/showcase. Manifest lives at public/showcase/manifest.json
 * so the dashboard can read it server-side on each render (no
 * network round-trip).
 *
 * Each reel has a slug (folder name), a display title, a style tag
 * ('realistic' | '3d'), a tagline, an aspect ratio, and a relative
 * URL to the transcoded reel MP4 + a JPG poster.
 */

export type ShowcaseReel = {
  slug: string;
  title: string;
  style: "realistic" | "3d";
  tagline: string;
  aspect_ratio: "9:16" | "16:9" | "1:1";
  video: string;
  poster: string;
};

let cached: ShowcaseReel[] | null = null;

export async function loadShowcase(): Promise<ShowcaseReel[]> {
  if (cached) return cached;
  try {
    const file = path.join(
      process.cwd(),
      "public",
      "showcase",
      "manifest.json",
    );
    const raw = await readFile(file, "utf8");
    const parsed = JSON.parse(raw) as { reels?: ShowcaseReel[] };
    cached = Array.isArray(parsed.reels) ? parsed.reels : [];
  } catch {
    cached = [];
  }
  return cached;
}
