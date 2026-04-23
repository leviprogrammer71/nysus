/**
 * Subtle mythology glyphs for the Ari + Mae chat headers.
 *
 * Ari — Ariadne's thread. A spool with a line unspooling in a soft
 * labyrinth curve. Hand-drawn strokes, single color.
 *
 * Mae — the thyrsus / ivy. A staff with a pinecone head and a curling
 * ivy tendril. Same stroke weight, same color palette, so they read as
 * two halves of one set.
 *
 * Keep them small — 20px at default — and always inherit currentColor
 * so the header color controls tint.
 */

export function AriGlyph({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Spool body — elongated oval */}
      <ellipse cx="8" cy="10" rx="3.5" ry="5" />
      {/* A pair of thread windings */}
      <path d="M5.5 8.5c2 .6 3 .6 5 0M5.5 11.5c2 .6 3 .6 5 0" />
      {/* Thread unspooling outward in a soft labyrinth curve */}
      <path d="M11.5 10c2 0 2 2.5 4 2.5s2-2.5 4-2.5" />
    </svg>
  );
}

export function MaeGlyph({
  size = 20,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {/* Thyrsus staff */}
      <path d="M12 21V9" />
      {/* Pinecone head — three scale hatches */}
      <path d="M9 5c1.5 1 4.5 1 6 0" />
      <path d="M9 7c1.5 1 4.5 1 6 0" />
      <path d="M10 3.5c1 .8 3 .8 4 0" />
      {/* Curling ivy leaf */}
      <path d="M12 13c2 0 3.5 1 3.5 3s-1.5 2.5-3 2.5" />
      <path d="M14.2 15.6c-.3-.6-.1-1.2.5-1.5" />
    </svg>
  );
}
