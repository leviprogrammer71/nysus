import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createPrediction, getPrediction } from "@/lib/replicate";

/**
 * POST /api/stitch
 *
 * Server-side stitch pipeline using Replicate's lucataco/ffmpeg-api.
 * Accepts an array of signed clip URLs, overlay options, and produces
 * a single stitched MP4 with text overlays burned in.
 *
 * Overlays:
 *   - location: top-left
 *   - price: large bottom-left (only if show_price)
 *   - realtor + brokerage: bottom-right
 *   - AI watermark: small bottom-center
 */

const FFMPEG_MODEL = "lucataco/ffmpeg-api";

const bodySchema = z.object({
  project_id: z.string().uuid(),
  clip_urls: z.array(z.string().url()).min(1).max(20),
  overlays: z
    .object({
      location: z.string().optional(),
      price: z.string().optional(),
      show_price: z.boolean().default(false),
      realtor: z.string().optional(),
      brokerage: z.string().optional(),
    })
    .optional(),
});

/**
 * Build the FFmpeg filter_complex string for text overlays.
 */
function buildOverlayFilter(
  overlays?: z.infer<typeof bodySchema>["overlays"],
): string {
  if (!overlays) return "";
  const draws: string[] = [];
  const font = "fontsize=28:fontcolor=white:borderw=2:bordercolor=black@0.6";

  if (overlays.location) {
    draws.push(
      `drawtext=text='${esc(overlays.location)}':x=32:y=32:${font}`,
    );
  }
  if (overlays.show_price && overlays.price) {
    draws.push(
      `drawtext=text='${esc(overlays.price)}':x=32:y=h-80:fontsize=48:fontcolor=white:borderw=3:bordercolor=black@0.6`,
    );
  }
  if (overlays.realtor || overlays.brokerage) {
    const line = [overlays.realtor, overlays.brokerage]
      .filter(Boolean)
      .join(" | ");
    draws.push(
      `drawtext=text='${esc(line)}':x=w-tw-32:y=h-52:${font}`,
    );
  }

  // AI watermark
  draws.push(
    `drawtext=text='Made with Nysus AI':x=(w-tw)/2:y=h-28:fontsize=16:fontcolor=white@0.5:borderw=1:bordercolor=black@0.3`,
  );

  return draws.join(",");
}

/** Escape single quotes for FFmpeg drawtext. */
function esc(s: string): string {
  return s.replace(/'/g, "'\\''").replace(/:/g, "\\:");
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message : "Bad request";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Build the concat + overlay FFmpeg command.
  // lucataco/ffmpeg-api takes:
  //   - input_files: array of URLs
  //   - ffmpeg_command: the -filter_complex / output flags
  const { clip_urls, overlays } = body;

  // Build filter chain: concat then overlays.
  const inputCount = clip_urls.length;
  const concatInputs = clip_urls
    .map((_, i) => `[${i}:v:0][${i}:a:0]`)
    .join("");
  const concatFilter = `${concatInputs}concat=n=${inputCount}:v=1:a=1[cv][ca]`;

  const overlayFilter = buildOverlayFilter(overlays);
  const fullFilter = overlayFilter
    ? `${concatFilter};[cv]${overlayFilter}[v]`
    : `${concatFilter};[cv]copy[v]`;

  const ffmpegCommand = `-filter_complex "${fullFilter}" -map "[v]" -map "[ca]" -c:v libx264 -preset fast -crf 23 -c:a aac -movflags +faststart output.mp4`;

  try {
    let prediction = await createPrediction({
      model: FFMPEG_MODEL,
      input: {
        input_files: clip_urls,
        ffmpeg_command: ffmpegCommand,
      },
    });

    // Poll up to 5 minutes — stitching multiple clips can take a while.
    const deadline = Date.now() + 300_000;
    while (
      (prediction.status === "starting" || prediction.status === "processing") &&
      Date.now() < deadline
    ) {
      await new Promise((r) => setTimeout(r, 3000));
      prediction = await getPrediction(prediction.id);
    }

    if (prediction.status !== "succeeded") {
      const err = String(prediction.error ?? `stitch ${prediction.status}`);
      return NextResponse.json({ error: err }, { status: 502 });
    }

    const output = prediction.output;
    const outputUrl =
      typeof output === "string"
        ? output
        : Array.isArray(output) && typeof output[0] === "string"
          ? (output[0] as string)
          : null;

    if (!outputUrl) {
      return NextResponse.json(
        { error: "Stitch returned no output URL" },
        { status: 502 },
      );
    }

    return NextResponse.json({ url: outputUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
