/**
 * MaskGlyph — the half-shadowed Dionysian theater mask.
 *
 * One sepia-and-ink line drawing that anchors Nysus visually:
 *   - The wordmark glyph on the WorkspaceShell sidebar
 *   - The mobile top-bar mark
 *   - The favicon (we ship a PNG version too)
 *   - The watermark on PDF exports (future)
 *
 * The mask is split vertically. The right half carries a faint ink
 * fill ("the face beneath the face"). A sepia vine of grapes wraps
 * the brow — the recurring motif that also runs through the gutter
 * vine elsewhere in the app.
 *
 * One line. No flourish.
 */

export function MaskGlyph({
  size = 34,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  const w = size;
  const h = Math.round((size * 40) / 34);
  return (
    <svg
      width={w}
      height={h}
      viewBox="0 0 34 40"
      fill="none"
      aria-hidden
      className={className}
    >
      {/* Mask outline */}
      <path
        d="M17 2 C 6 2, 2 12, 2 22 C 2 32, 9 38, 17 38 C 25 38, 32 32, 32 22 C 32 12, 28 2, 17 2 Z"
        stroke="var(--color-ink)"
        strokeWidth="1.2"
      />
      {/* Vertical split — the line between the two faces */}
      <path
        d="M17 2 C 17 14, 17 26, 17 38"
        stroke="var(--color-ink)"
        strokeWidth="1"
        opacity=".55"
      />
      {/* Right half — the shadow */}
      <path
        d="M17 2 C 25 2, 30 10, 32 22 C 32 32, 25 38, 17 38 Z"
        fill="var(--color-ink)"
        opacity=".06"
      />
      {/* Eyes */}
      <ellipse cx="10" cy="18" rx="2.4" ry="1" fill="var(--color-ink)" />
      <ellipse cx="24" cy="18" rx="2.4" ry="1" fill="var(--color-ink)" />
      {/* Vine of grapes across the brow */}
      <path
        d="M6 8 C 10 6, 14 8, 17 6 C 20 8, 24 6, 28 8"
        stroke="var(--color-sepia-deep)"
        strokeWidth="0.9"
      />
      <circle cx="9" cy="7" r="1" fill="var(--color-sepia-deep)" />
      <circle cx="25" cy="7" r="1" fill="var(--color-sepia-deep)" />
    </svg>
  );
}
