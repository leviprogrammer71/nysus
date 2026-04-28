"use client";

import Link from "next/link";

interface Category {
  id: string;
  title: string;
  description: string;
  scenes: number;
  featured?: boolean;
}

const categories: Category[] = [
  {
    id: "listing-bundle",
    title: "Listing Bundle",
    description:
      "We render each as a Seedance 2.0 cinematic clip, stitch them into one finished MP4 with your price and realtor name burned in, and hand back a post-ready film. The full white-glove deliverable.",
    scenes: 6,
    featured: true,
  },
  {
    id: "luxury",
    title: "Luxury Listing",
    description:
      "Cinematic aerials, golden-hour interiors, slow pans. Built for $1M+ properties.",
    scenes: 6,
  },
  {
    id: "residential",
    title: "Residential Tour",
    description:
      "Clean walk-through: exterior, kitchen, living, bedrooms, backyard, close.",
    scenes: 5,
  },
  {
    id: "commercial",
    title: "Commercial Showcase",
    description:
      "Office, retail, or industrial — wide establishing shots with data overlays.",
    scenes: 4,
  },
  {
    id: "land",
    title: "Land & Lot",
    description:
      "Drone-style sweep of the parcel with boundary highlights and neighborhood context.",
    scenes: 3,
  },
];

export function ListingBundlePicker() {
  return (
    <section>
      <div className="mb-6">
        <p className="font-body text-[10px] uppercase tracking-[0.28em] text-ink-soft/70">
          Listing Bundle
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-ink sm:text-4xl">
          Pick your <span className="highlight">category</span>
        </h1>
        <p className="mt-2 max-w-xl font-body text-sm text-ink-soft/80 leading-relaxed">
          Choose a template. We handle the rest — stills, clips, overlays,
          stitch — and hand back one post-ready MP4.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {categories.map((cat) =>
          cat.featured ? (
            <FeaturedCard key={cat.id} cat={cat} />
          ) : (
            <Link
              key={cat.id}
              href={`/projects/new?template=${cat.id}`}
              className="group surface-card animate-lift rounded-xl px-5 py-4 block"
            >
              <h2
                className="font-display text-lg text-ink"
                style={{ wordBreak: "normal", overflowWrap: "break-word" }}
              >
                {cat.title}
              </h2>
              <p
                className="mt-1 font-body text-[13px] text-ink-soft/80 leading-relaxed"
                style={{ wordBreak: "normal", overflowWrap: "break-word" }}
              >
                {cat.description}
              </p>
              <p className="mt-2 font-hand text-sm text-sepia-deep">
                {cat.scenes} scenes included
              </p>
            </Link>
          ),
        )}
      </div>
    </section>
  );
}

function FeaturedCard({ cat }: { cat: Category }) {
  return (
    <Link
      href={`/projects/new?template=${cat.id}`}
      className="group relative block animate-lift rounded-xl bg-ink px-5 py-5 shadow-lg sm:col-span-2 transition-shadow hover:shadow-xl"
    >
      {/* DONE-FOR-YOU ribbon */}
      <span className="absolute -top-2.5 right-4 rounded bg-red-grease/90 px-2.5 py-1 font-body text-[10px] uppercase tracking-[0.18em] text-paper shadow-sm">
        Done-for-you
      </span>

      <h2
        className="font-display text-xl text-paper"
        style={{ wordBreak: "normal", overflowWrap: "break-word" }}
      >
        {cat.title}
      </h2>
      <p
        className="mt-1.5 max-w-lg font-body text-[13px] text-paper/75 leading-relaxed"
        style={{ wordBreak: "normal", overflowWrap: "break-word" }}
      >
        {cat.description}
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span className="font-hand text-sm text-highlight">
          {cat.scenes} scenes included
        </span>
        <span className="font-body text-[11px] uppercase tracking-widest text-paper/50">
          →
        </span>
      </div>
    </Link>
  );
}
