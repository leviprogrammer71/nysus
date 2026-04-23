"use client";

import { useCallback, useEffect, useState } from "react";
import { ACHIEVEMENTS } from "@/lib/progress";

interface ProgressResponse {
  xp: number;
  level: number;
  xp_into_level: number;
  xp_for_next: number;
  streak_days: number;
  counters: {
    scenes: number;
    stitches: number;
    shares: number;
    remixes_received: number;
  };
  achievements_total: number;
  achievements: Array<{
    slug: string;
    label: string;
    description: string;
    glyph: string;
    awarded_at?: string;
  }>;
}

/**
 * Level + XP + streak + achievement stamps. Sits on the dashboard
 * under the usage meter. Feeds the loop that keeps directors coming
 * back: "I'm 12 XP from level 4, one more scene does it."
 */
export function ProgressPanel() {
  const [data, setData] = useState<ProgressResponse | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/progress", { cache: "no-store" });
      if (!res.ok) return;
      setData((await res.json()) as ProgressResponse);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (!data) {
    return (
      <div className="mb-6 h-28 animate-shimmer rounded-lg border border-ink/10" />
    );
  }

  const pct = Math.min(
    100,
    Math.round(
      (data.xp_into_level / Math.max(1, data.xp_for_next)) * 100,
    ),
  );
  const allDefs = ACHIEVEMENTS;
  const unlockedSlugs = new Set(data.achievements.map((a) => a.slug));

  return (
    <section className="mb-6 rounded-lg border border-ink/10 bg-paper-deep px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-display text-base uppercase tracking-widest text-ink">
          Director
        </h2>
        <div className="flex items-center gap-3 font-body text-[11px] uppercase tracking-widest text-ink-soft/70">
          <span>
            <span className="font-display text-ink">LV {data.level}</span>
            <span className="ml-1 text-ink-soft/60">· {data.xp} XP</span>
          </span>
          {data.streak_days > 0 ? (
            <span
              className="inline-flex items-center gap-1 text-red-grease animate-icon-wiggle"
              title={`${data.streak_days}-day shipping streak`}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" aria-hidden
                fill="currentColor">
                <path d="M13 2c-.7 3 .5 5.5 2 7.5 1.3 1.7 2 3 2 5a5 5 0 0 1-10 0c0-1.3.3-2.3.8-3.2-.3 1.2-.3 2.2 0 3 .7-3 3.7-4.3 5.2-6.3 1-1.3 1-3.5 0-6z" />
              </svg>
              {data.streak_days}d
            </span>
          ) : null}
        </div>
      </div>

      {/* XP bar */}
      <div className="mt-2">
        <div className="flex justify-between font-body text-[10px] uppercase tracking-widest text-ink-soft/70">
          <span>
            {data.xp_into_level} / {data.xp_for_next} to LV {data.level + 1}
          </span>
          <span>{pct}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full bg-ink transition-[width] duration-700"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Achievement stamps */}
      <div className="mt-3">
        <div className="mb-1.5 flex justify-between font-body text-[10px] uppercase tracking-widest text-ink-soft/70">
          <span>Stamps</span>
          <span>
            {data.achievements.length} / {data.achievements_total}
          </span>
        </div>
        <ul className="flex flex-wrap gap-1.5">
          {allDefs.map((a) => {
            const unlocked = unlockedSlugs.has(a.slug);
            return (
              <li
                key={a.slug}
                title={`${a.label} — ${a.description}${
                  unlocked ? "" : " (locked)"
                }`}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border font-display text-sm animate-press ${
                  unlocked
                    ? "border-ink/40 bg-paper text-ink"
                    : "border-ink/10 bg-paper-deep/60 text-ink-soft/25"
                }`}
              >
                {a.glyph}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
