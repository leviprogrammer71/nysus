import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type SB = SupabaseClient<Database>;

/**
 * XP / level / achievement system.
 *
 * Single entry point: awardEvent(admin, userId, kind, meta). Callers
 * fire it from the webhook (video_complete), stills endpoint, stitch
 * ping, share toggle, and remix create. The helper handles:
 *
 *   - XP delta + level recompute
 *   - Streak bump/reset based on last_ship_date vs today (UTC)
 *   - Per-kind counter bumps (total_scenes, total_stitches, ...)
 *   - Unlocked achievements (idempotent insert via unique index)
 *
 * Never throws — award failures are logged but shouldn't break a
 * user's primary action.
 */

export type AwardKind =
  | "still_generated"
  | "video_complete"
  | "stitch_exported"
  | "project_shared"
  | "project_remixed" // awarded to the ORIGINAL author
  | "remix_created" // awarded to the remixer
  | "narration_added"
  | "character_portrait";

/** XP per event. Rounded so the level curve is legible to players. */
const XP: Record<AwardKind, number> = {
  still_generated: 2,
  video_complete: 10,
  stitch_exported: 25,
  project_shared: 15,
  project_remixed: 20,
  remix_created: 8,
  narration_added: 4,
  character_portrait: 5,
};

/**
 * Level formula: level N requires 50 * N * (N+1) / 2 XP cumulative.
 *   L1: 0     → 50    XP
 *   L2: 50    → 150   XP
 *   L3: 150   → 300   XP
 *   L4: 300   → 500   XP
 *   L5: 500   → 750   XP
 * Gentle enough that people level up within their first project.
 */
export function levelForXp(xp: number): {
  level: number;
  xpIntoLevel: number;
  xpForNext: number;
} {
  let level = 1;
  while (totalForLevel(level + 1) <= xp) level += 1;
  const floor = totalForLevel(level);
  const ceil = totalForLevel(level + 1);
  return { level, xpIntoLevel: xp - floor, xpForNext: ceil - floor };
}

function totalForLevel(level: number): number {
  // Sum of 50 * k for k in 1..level-1 = 50 * (level-1) * level / 2
  if (level <= 1) return 0;
  return (50 * (level - 1) * level) / 2;
}

// --- Achievements -------------------------------------------------------

export interface AchievementDef {
  slug: string;
  label: string;
  description: string;
  /** Emoji-like glyph shown inside the paper stamp. Keep it monochrome. */
  glyph: string;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    slug: "first_portrait",
    label: "The Cast",
    description: "Generated your first character portrait.",
    glyph: "◐",
  },
  {
    slug: "first_scene",
    label: "Action",
    description: "Rendered your first video clip.",
    glyph: "▶",
  },
  {
    slug: "first_stitch",
    label: "The Cut",
    description: "Exported your first stitched MP4.",
    glyph: "✂",
  },
  {
    slug: "first_share",
    label: "Released",
    description: "Published your first project to the gallery.",
    glyph: "◈",
  },
  {
    slug: "first_narration",
    label: "Voice",
    description: "Added narration to a scene.",
    glyph: "♪",
  },
  {
    slug: "ten_scenes",
    label: "Prolific",
    description: "10 scenes in the can.",
    glyph: "X",
  },
  {
    slug: "fifty_scenes",
    label: "A Body of Work",
    description: "50 scenes shipped.",
    glyph: "L",
  },
  {
    slug: "first_remix_received",
    label: "Inspired",
    description: "Someone remixed one of your projects.",
    glyph: "⇌",
  },
  {
    slug: "three_day_streak",
    label: "Show Up",
    description: "Shipped something 3 days in a row.",
    glyph: "3",
  },
  {
    slug: "seven_day_streak",
    label: "Ritual",
    description: "7-day shipping streak.",
    glyph: "7",
  },
  {
    slug: "range",
    label: "Range",
    description: "Animated scenes with both Seedance and Kling.",
    glyph: "≈",
  },
  {
    slug: "first_remix_created",
    label: "Inspired By",
    description: "Started from someone else's project.",
    glyph: "↻",
  },
];

function achievementsLookup(): Record<string, AchievementDef> {
  return Object.fromEntries(ACHIEVEMENTS.map((a) => [a.slug, a]));
}

// --- Main entry point ---------------------------------------------------

export interface AwardMeta {
  animation_model?: "seedance" | "kling" | null;
  project_id?: string;
}

export interface AwardResult {
  xp: number;
  level: number;
  streak_days: number;
  new_achievements: AchievementDef[];
}

export async function awardEvent({
  admin,
  userId,
  kind,
  meta = {},
}: {
  admin: SB;
  userId: string;
  kind: AwardKind;
  meta?: AwardMeta;
}): Promise<AwardResult | null> {
  try {
    // 1. Fetch current progress (seed row if missing).
    const { data: current } = await admin
      .from("user_progress")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    const baseline = current ?? {
      user_id: userId,
      xp: 0,
      level: 1,
      streak_days: 0,
      last_ship_date: null as string | null,
      total_scenes: 0,
      total_stitches: 0,
      total_shares: 0,
      total_remixes_received: 0,
      used_seedance: false,
      used_kling: false,
      updated_at: new Date().toISOString(),
    };

    // 2. XP + counters.
    const xpGain = XP[kind] ?? 0;
    const newXp = baseline.xp + xpGain;
    const newLevel = levelForXp(newXp).level;

    const patch: Partial<typeof baseline> = {
      xp: newXp,
      level: newLevel,
      updated_at: new Date().toISOString(),
    };

    if (kind === "video_complete") {
      patch.total_scenes = baseline.total_scenes + 1;
      if (meta.animation_model === "seedance") patch.used_seedance = true;
      if (meta.animation_model === "kling") patch.used_kling = true;
    }
    if (kind === "stitch_exported") {
      patch.total_stitches = baseline.total_stitches + 1;
    }
    if (kind === "project_shared") {
      patch.total_shares = baseline.total_shares + 1;
    }
    if (kind === "project_remixed") {
      patch.total_remixes_received = baseline.total_remixes_received + 1;
    }

    // 3. Streak update — trigger on ship-worthy events only.
    const shipEvents: AwardKind[] = [
      "video_complete",
      "stitch_exported",
      "project_shared",
    ];
    if (shipEvents.includes(kind)) {
      const today = utcDateString();
      const last = baseline.last_ship_date;
      if (!last) {
        patch.streak_days = 1;
      } else if (last === today) {
        // Already counted today — no change.
      } else if (isYesterday(last, today)) {
        patch.streak_days = (baseline.streak_days || 0) + 1;
      } else {
        patch.streak_days = 1;
      }
      patch.last_ship_date = today;
    }

    const nextRow = { ...baseline, ...patch };

    // 4. Persist progress (upsert).
    await admin.from("user_progress").upsert(nextRow, { onConflict: "user_id" });

    // 5. Evaluate achievements against the NEW totals.
    const defs = achievementsLookup();
    const toAward: string[] = [];

    if (kind === "character_portrait") toAward.push("first_portrait");
    if (kind === "narration_added") toAward.push("first_narration");
    if (kind === "remix_created") toAward.push("first_remix_created");
    if (kind === "project_remixed") toAward.push("first_remix_received");
    if (kind === "project_shared") toAward.push("first_share");

    if ((nextRow.total_scenes ?? 0) >= 1) toAward.push("first_scene");
    if ((nextRow.total_scenes ?? 0) >= 10) toAward.push("ten_scenes");
    if ((nextRow.total_scenes ?? 0) >= 50) toAward.push("fifty_scenes");
    if ((nextRow.total_stitches ?? 0) >= 1) toAward.push("first_stitch");
    if ((nextRow.streak_days ?? 0) >= 3) toAward.push("three_day_streak");
    if ((nextRow.streak_days ?? 0) >= 7) toAward.push("seven_day_streak");
    if (nextRow.used_seedance && nextRow.used_kling) toAward.push("range");

    const unique = Array.from(new Set(toAward)).filter((s) => defs[s]);
    const { data: already } =
      unique.length > 0
        ? await admin
            .from("user_achievements")
            .select("slug")
            .eq("user_id", userId)
            .in("slug", unique)
        : { data: [] };
    const alreadySet = new Set((already ?? []).map((r) => r.slug));
    const newly = unique.filter((s) => !alreadySet.has(s));

    if (newly.length > 0) {
      await admin.from("user_achievements").insert(
        newly.map((slug) => ({
          user_id: userId,
          slug,
          metadata: (meta.project_id ? { project_id: meta.project_id } : {}) as Record<
            string,
            unknown
          >,
        })),
      );
    }

    return {
      xp: newXp,
      level: newLevel,
      streak_days: nextRow.streak_days ?? 0,
      new_achievements: newly.map((s) => defs[s]),
    };
  } catch (err) {
    console.warn("awardEvent failed:", err);
    return null;
  }
}

function utcDateString(d: Date = new Date()): string {
  return (
    d.getUTCFullYear() +
    "-" +
    String(d.getUTCMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getUTCDate()).padStart(2, "0")
  );
}

function isYesterday(dateStr: string, today: string): boolean {
  const [y, m, d] = dateStr.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  const a = Date.UTC(y, m - 1, d);
  const b = Date.UTC(ty, tm - 1, td);
  return (b - a) / 86_400_000 === 1;
}
