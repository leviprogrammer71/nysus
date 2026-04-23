import { NextResponse } from "next/server";
import { replicateWhoami } from "@/lib/replicate";
import { OPENAI_IMAGE_MODEL } from "@/lib/openai-images";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health/replicate
 *
 * Probes Replicate auth + connectivity without creating a prediction.
 * Use when the UI shows 'fetch failed' and you need to know whether
 * the problem is REPLICATE_API_TOKEN, a VPN blocking api.replicate.com,
 * or something else.
 */
export async function GET() {
  const hasToken = Boolean((process.env.REPLICATE_API_TOKEN ?? "").trim());
  if (!hasToken) {
    return NextResponse.json(
      {
        ok: false,
        configured: false,
        error: "REPLICATE_API_TOKEN is not set in .env.local",
      },
      { status: 503 },
    );
  }

  const result = await replicateWhoami();
  return NextResponse.json(
    {
      ok: result.ok,
      configured: true,
      detail: result.detail,
      model: OPENAI_IMAGE_MODEL,
    },
    { status: result.ok ? 200 : 502 },
  );
}
