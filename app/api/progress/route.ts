import { NextResponse } from "next/server";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { ACHIEVEMENTS, levelForXp } from "@/lib/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/progress — current user's XP, level, streak, counters,
 * and unlocked achievement slugs. Fuel for the dashboard's progress
 * widget.
 */
export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  const admin = createServiceRoleClient();
  const [progressR, achievementsR] = await Promise.all([
    admin.from("user_progress").select("*").eq("user_id", user.id).maybeSingle(),
    admin
      .from("user_achievements")
      .select("slug, awarded_at")
      .eq("user_id", user.id)
      .order("awarded_at", { ascending: false }),
  ]);

  const p = progressR.data ?? {
    xp: 0,
    level: 1,
    streak_days: 0,
    last_ship_date: null,
    total_scenes: 0,
    total_stitches: 0,
    total_shares: 0,
    total_remixes_received: 0,
    used_seedance: false,
    used_kling: false,
  };

  const lvl = levelForXp(p.xp);
  const defs = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.slug, a]));
  const unlocked = (achievementsR.data ?? [])
    .map((r) => ({ ...defs[r.slug], awarded_at: r.awarded_at }))
    .filter((a) => a.slug);

  return NextResponse.json({
    xp: p.xp,
    level: lvl.level,
    xp_into_level: lvl.xpIntoLevel,
    xp_for_next: lvl.xpForNext,
    streak_days: p.streak_days,
    counters: {
      scenes: p.total_scenes,
      stitches: p.total_stitches,
      shares: p.total_shares,
      remixes_received: p.total_remixes_received,
    },
    achievements_total: ACHIEVEMENTS.length,
    achievements: unlocked,
  });
}
