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
 */
const nextConfig: NextConfig = {
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
