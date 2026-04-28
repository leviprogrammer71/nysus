"use client";

import Link from "next/link";
import { useState } from "react";
import { Logomark } from "@/app/components/logomark";

const plans = [
  {
    name: "Free",
    monthlyPrice: 0,
    annualPrice: 0,
    description: "Try the studio. No credit card.",
    features: [
      "3 projects",
      "10 stills / day",
      "5 clips / day",
      "Browser stitch",
      "Community gallery",
    ],
    cta: "Get started",
    ctaHref: "/login",
    featured: false,
  },
  {
    name: "Pro",
    monthlyPrice: 29,
    annualPrice: 19,
    description: "For directors who ship weekly.",
    features: [
      "Unlimited projects",
      "100 stills / day",
      "50 clips / day",
      "Server-side stitch with overlays",
      "Priority rendering",
      "Custom watermark",
    ],
    cta: "Start Pro",
    ctaHref: "/login?plan=pro",
    featured: true,
  },
  {
    name: "Listing Bundle",
    monthlyPrice: 49,
    annualPrice: 39,
    description: "Done-for-you real estate reels.",
    features: [
      "Everything in Pro",
      "Listing Bundle flow",
      "Price & realtor overlays burned in",
      "Multi-clip stitch to single MP4",
      "White-glove deliverable",
    ],
    cta: "Start Bundle",
    ctaHref: "/login?plan=bundle",
    featured: false,
  },
];

export default function PricingPage() {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-5 py-8 sm:px-6">
      <header className="mb-10 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2" aria-label="Nysus home">
          <Logomark size={28} animated />
          <span className="font-display text-[15px] sm:text-lg tracking-[0.22em] text-ink">
            NYSUS
          </span>
        </Link>
        <nav className="flex items-center gap-3">
          <Link
            href="/gallery"
            className="inline-flex h-11 items-center px-2.5 font-body text-[11px] uppercase tracking-widest text-ink-soft/80 hover:text-ink transition-colors"
          >
            Gallery
          </Link>
          <Link
            href="/login"
            className="ml-1 inline-flex h-11 items-center rounded-full bg-ink px-4 font-body text-[11px] uppercase tracking-widest text-paper hover:bg-ink-soft transition-colors"
          >
            Sign in
          </Link>
        </nav>
      </header>

      <section className="mb-8 text-center">
        <p className="font-body text-[10px] uppercase tracking-[0.28em] text-ink-soft/70">
          Pricing
        </p>
        <h1 className="mt-3 font-display text-3xl tracking-tight text-ink sm:text-5xl">
          Simple, <span className="highlight">transparent</span> plans
        </h1>
        <p className="mt-3 mx-auto max-w-lg font-body text-[15px] text-ink-soft/85 leading-relaxed">
          Start free. Upgrade when you need more renders, server-side stitch, or
          the done-for-you Listing Bundle.
        </p>
      </section>

      {/* Billing toggle */}
      <div className="mb-8 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setBilling("monthly")}
          className={`px-4 py-2 font-body text-xs uppercase tracking-widest rounded-full transition-colors ${
            billing === "monthly"
              ? "bg-ink text-paper"
              : "bg-paper-deep text-ink-soft hover:text-ink"
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setBilling("annual")}
          className={`px-4 py-2 font-body text-xs uppercase tracking-widest rounded-full transition-colors ${
            billing === "annual"
              ? "bg-ink text-paper"
              : "bg-paper-deep text-ink-soft hover:text-ink"
          }`}
        >
          Annual
          <span className="ml-1.5 text-[10px] text-highlight">save 34%</span>
        </button>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {plans.map((plan) => {
          const price =
            billing === "annual" ? plan.annualPrice : plan.monthlyPrice;
          return (
            <div
              key={plan.name}
              className={`relative flex flex-col rounded-xl px-5 py-6 ${
                plan.featured
                  ? "bg-ink text-paper shadow-lg ring-2 ring-ink"
                  : "surface-card"
              }`}
            >
              <h2
                className={`font-display text-xl ${
                  plan.featured ? "text-paper" : "text-ink"
                }`}
              >
                {plan.name}
              </h2>
              <p
                className={`mt-1 font-body text-[13px] leading-relaxed ${
                  plan.featured ? "text-paper/70" : "text-ink-soft/80"
                }`}
              >
                {plan.description}
              </p>
              <div className="mt-4 flex items-baseline gap-1">
                <span
                  className={`font-display text-4xl tracking-tight ${
                    plan.featured ? "text-paper" : "text-ink"
                  }`}
                >
                  ${price}
                </span>
                {price > 0 && (
                  <span
                    className={`font-body text-xs ${
                      plan.featured ? "text-paper/60" : "text-ink-soft/60"
                    }`}
                  >
                    / mo
                  </span>
                )}
              </div>
              <ul className="mt-5 flex-1 space-y-2">
                {plan.features.map((f) => (
                  <li
                    key={f}
                    className={`flex items-start gap-2 font-body text-[13px] ${
                      plan.featured ? "text-paper/85" : "text-ink/80"
                    }`}
                  >
                    <span className="mt-0.5 shrink-0 text-xs">
                      {plan.featured ? "◆" : "◇"}
                    </span>
                    <span style={{ wordBreak: "normal", overflowWrap: "break-word" }}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href={plan.ctaHref}
                className={`mt-6 inline-flex h-11 w-full items-center justify-center rounded-full font-body text-[11px] uppercase tracking-widest transition-colors ${
                  plan.featured
                    ? "bg-paper text-ink hover:bg-paper-deep"
                    : "bg-ink text-paper hover:bg-ink-soft"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          );
        })}
      </div>

      <footer className="mt-12 pb-safe text-center">
        <p className="font-body text-xs text-ink-soft/60">
          All plans include the Nysus studio, chat-driven workflow, and browser
          export. Cancel anytime.
        </p>
      </footer>
    </main>
  );
}
