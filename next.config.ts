import type { NextConfig } from "next";

/**
 * Nysus Next.js config.
 *
 * We intentionally DO NOT set COOP/COEP globally. Those headers enable
 * SharedArrayBuffer (needed for multi-threaded FFmpeg.wasm) but break
 * <img>/<video> loads from Supabase Storage signed URLs on Safari.
 *
 * Our `lib/ffmpeg.ts` loads the single-threaded `ffmpeg-core.js` build,
 * which works without SharedArrayBuffer. A 90-second stitch runs in
 * ~10-20s single-threaded — acceptable for mobile-first delivery.
 *
 * images.remotePatterns: next/image refuses any hostname that isn't
 * explicitly allowed. We permit any *.supabase.co host (where every
 * stills / portraits / thumbnails signed URL points) and any
 * *.supabase.in (legacy region). Anything else should use a plain
 * <img> tag.
 */
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co", pathname: "/storage/v1/**" },
      { protocol: "https", hostname: "**.supabase.in", pathname: "/storage/v1/**" },
      // Replicate output CDN — we normally mirror to Storage first, but
      // the dev poll can hand back a pbxt URL briefly before the mirror
      // lands. Whitelisting avoids a flash of broken images.
      { protocol: "https", hostname: "replicate.delivery" },
      { protocol: "https", hostname: "pbxt.replicate.delivery" },
    ],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
        ],
      },
    ];
  },
};

export default nextConfig;
