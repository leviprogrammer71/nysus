import Image from "next/image";

/**
 * Nysus logomark — classical muse face framed by a film reel, with
 * ivy vines and film strips wrapping around it. Hand-drawn pen sketch
 * in navy ink on cream paper.
 *
 * Static variant uses the raster PNG. Animated variant plays a muted
 * looping MP4 on top of the same poster frame so the first paint is
 * the static logo — no white flash when the browser is slow to
 * decode the video.
 */
export function Logomark({
  size = 48,
  ring = false,
  priority = false,
  animated = false,
  className,
}: {
  size?: number;
  ring?: boolean;
  priority?: boolean;
  /** Play welcome-loop.mp4 behind the logo. Silent, looping. */
  animated?: boolean;
  className?: string;
}) {
  const content = animated ? (
    <AnimatedLogo size={size} priority={priority} />
  ) : (
    <Image
      src="/illustrations/logo-mark.png"
      alt="Nysus logomark"
      width={size}
      height={size}
      priority={priority}
      className={`block ${className ?? ""}`.trim()}
      sizes={`${size}px`}
    />
  );

  if (!ring) return content;

  return (
    <span
      aria-hidden
      className="inline-flex items-center justify-center rounded-full border border-ink/60 overflow-hidden"
      style={{ width: size, height: size }}
    >
      {content}
    </span>
  );
}

/**
 * Muted auto-looping video with a PNG poster that shows first-paint
 * so it reads as "still logo that decided to move" rather than "video
 * thumbnail."
 *
 * `playsInline` is critical on iOS — without it Safari takes the video
 * fullscreen on autoplay.
 */
function AnimatedLogo({
  size,
  priority,
}: {
  size: number;
  priority: boolean;
}) {
  return (
    <span
      className="relative block overflow-hidden"
      style={{ width: size, height: size }}
      aria-label="Nysus logomark"
    >
      {/* Preload the poster as an image so the first paint is the
          sketch even while the browser negotiates the video. */}
      <Image
        src="/illustrations/logo-mark.png"
        alt=""
        width={size}
        height={size}
        priority={priority}
        className="absolute inset-0 block"
        sizes={`${size}px`}
      />
      <video
        src="/video/welcome-loop.mp4"
        poster="/illustrations/logo-mark.png"
        muted
        autoPlay
        loop
        playsInline
        preload="metadata"
        className="relative block w-full h-full object-cover"
        aria-hidden
      />
    </span>
  );
}
