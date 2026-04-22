"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Dashboard usage meter. Bigger cousin of UsageStrip — shows today +
 * month progress bars, in-flight count, and a "top up $10" button
 * that opens Stripe Checkout (if configured).
 */
type UsageResponse = {
  spend: { today_cents: number; today_usd: string; month_cents: number; month_usd: string };
  caps: {
    daily_usd: string;
    monthly_usd: string;
    concurrent_generations: number;
    generations_per_hour: number;
    chat_per_hour: number;
    premium: boolean;
  };
  overrides: { day_cents: number; month_cents: number };
  rate_limits: {
    generations_last_hour: number;
    chat_last_hour: number;
    concurrent_clips_in_flight: number;
  };
};

export function UsageMeter() {
  const [data, setData] = useState<UsageResponse | null>(null);
  const [toppingUp, setToppingUp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/usage", { cache: "no-store" });
      if (!res.ok) return;
      setData((await res.json()) as UsageResponse);
    } catch {
      /* transient — skip */
    }
  }, []);

  useEffect(() => {
    // load() calls setData async — not a synchronous setState cascade,
    // just the initial fetch + a repeating poll. The rule's warning is
    // noisy here so we silence it with intent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    const t = setInterval(load, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const topUp = useCallback(async () => {
    setError(null);
    setToppingUp(true);
    try {
      const res = await fetch("/api/billing/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount_cents: 1000 }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error ?? "Top-up failed");
      if (body.url) {
        window.location.href = body.url as string;
        return;
      }
      if (body.ok) {
        await load();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setToppingUp(false);
    }
  }, [load]);

  if (!data) {
    return (
      <div className="mb-6 h-24 animate-pulse rounded-lg border border-ink/10 bg-paper-deep" />
    );
  }

  const todayPct = Math.min(
    100,
    (Number(data.spend.today_usd) / Math.max(1, Number(data.caps.daily_usd))) *
      100,
  );
  const monthPct = Math.min(
    100,
    (Number(data.spend.month_usd) /
      Math.max(1, Number(data.caps.monthly_usd))) *
      100,
  );
  const warnToday = todayPct >= 80;

  return (
    <section className="mb-6 rounded-lg border border-ink/10 bg-paper-deep px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-base uppercase tracking-widest text-ink">
          Usage
          {data.caps.premium ? (
            <span className="ml-2 rounded-full bg-amber-200/70 px-2 py-0.5 font-body text-[10px] uppercase tracking-widest text-ink">
              premium
            </span>
          ) : null}
        </h2>
        <div className="flex items-center gap-2">
          {warnToday ? (
            <button
              type="button"
              onClick={topUp}
              disabled={toppingUp}
              className="rounded-full border border-ink/25 bg-paper px-3 py-1 font-body text-[11px] uppercase tracking-widest text-ink hover:bg-ink/5 disabled:opacity-50"
            >
              {toppingUp ? "Loading…" : "+ $10 today"}
            </button>
          ) : null}
          {data.rate_limits.concurrent_clips_in_flight > 0 ? (
            <span className="font-hand text-base text-sepia-deep">
              {data.rate_limits.concurrent_clips_in_flight} rendering
            </span>
          ) : null}
        </div>
      </div>

      <Bar
        label={`Today — $${data.spend.today_usd} / $${data.caps.daily_usd}`}
        pct={todayPct}
        warn={warnToday}
      />
      <Bar
        label={`Month — $${data.spend.month_usd} / $${data.caps.monthly_usd}`}
        pct={monthPct}
        warn={monthPct >= 80}
      />

      {data.overrides.day_cents > 0 || data.overrides.month_cents > 0 ? (
        <p className="mt-1 font-body text-[10px] uppercase tracking-widest text-ink-soft/60">
          Includes top-ups: today +${(data.overrides.day_cents / 100).toFixed(2)}
          {data.overrides.month_cents > 0
            ? ` · month +$${(data.overrides.month_cents / 100).toFixed(2)}`
            : ""}
        </p>
      ) : null}
      {error ? (
        <p className="mt-1 font-body text-[11px] text-red-grease" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}

function Bar({
  label,
  pct,
  warn,
}: {
  label: string;
  pct: number;
  warn?: boolean;
}) {
  return (
    <div className="mt-2">
      <div className="flex justify-between font-body text-[10px] uppercase tracking-widest text-ink-soft/70">
        <span>{label}</span>
        <span>{Math.round(pct)}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink/10">
        <div
          className={`h-full rounded-full transition-[width] ${
            warn ? "bg-red-grease" : "bg-ink"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
