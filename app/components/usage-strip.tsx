"use client";

import { useEffect, useState } from "react";

/**
 * Tiny strip that shows today's spend vs the daily cap. Quiet by
 * default; lights up red-grease when you're within 20% of the cap.
 *
 * Fetches /api/usage on mount only — not a live meter. Re-mounts on
 * projects-list refresh which is fine for a single-user app.
 */
type UsageResponse = {
  spend: { today_usd: string; month_usd: string };
  caps: { daily_usd: string; monthly_usd: string };
  rate_limits: {
    generations_last_hour: number;
    chat_last_hour: number;
    concurrent_clips_in_flight: number;
  };
};

export function UsageStrip() {
  const [data, setData] = useState<UsageResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/usage", { cache: "no-store" });
        if (!res.ok) return;
        const body = (await res.json()) as UsageResponse;
        if (!cancelled) setData(body);
      } catch {
        /* transient — just skip */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (!data) return null;

  const todayPct =
    Number(data.spend.today_usd) / Number(data.caps.daily_usd || 1);
  const monthPct =
    Number(data.spend.month_usd) / Number(data.caps.monthly_usd || 1);
  const warn = todayPct >= 0.8 || monthPct >= 0.8;

  return (
    <div
      className={`flex items-center gap-3 font-body text-[11px] uppercase tracking-widest ${
        warn ? "text-red-grease" : "text-ink-soft/60"
      }`}
      title={`Today: $${data.spend.today_usd} of $${data.caps.daily_usd} · Month: $${data.spend.month_usd} of $${data.caps.monthly_usd}`}
    >
      <span>
        ${data.spend.today_usd}<span className="opacity-60"> / ${data.caps.daily_usd} today</span>
      </span>
      {data.rate_limits.concurrent_clips_in_flight > 0 ? (
        <span className="font-hand text-sm normal-case tracking-normal">
          · {data.rate_limits.concurrent_clips_in_flight} rendering
        </span>
      ) : null}
    </div>
  );
}
