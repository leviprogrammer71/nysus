import Image from "next/image";

/**
 * Nysus logomark — classical muse face framed by a film reel, with
 * ivy vines and film strips wrapping around it. Hand-drawn pen sketch
 * in navy ink on cream paper.
 *
 * Source: /public/illustrations/logo-mark.png (1254×1254 raster). Used
 * in the PWA icons, login / home / setup headers, splash screen, and
 * OG image.
 *
 * Props:
 *   size   — pixel diameter (default 48)
 *   ring   — wrap in a thin ink circle, matching the old "N" mark feel
 *   priority — hint Next to eager-load (login / splash uses this)
 */
export function Logomark({
  size = 48,
  ring = false,
  priority = false,
  className,
}: {
  size?: number;
  ring?: boolean;
  priority?: boolean;
  className?: string;
}) {
  const img = (
    <Image
      src="/illustrations/logo-mark.png"
      alt="Nysus logomark"
      width={size}
      height={size}
      priority={priority}
      className={`block ${className ?? ""}`.trim()}
      // Raster source; let Next handle responsive srcset.
      sizes={`${size}px`}
    />
  );

  if (!ring) return img;

  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-full border border-ink/60 overflow-hidden"
      style={{ width: size, height: size }}
    >
      {img}
    </span>
  );
}
