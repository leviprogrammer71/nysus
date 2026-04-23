import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { awardEvent } from "@/lib/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  project_id: z.string().uuid(),
  /** Number of scenes included in the stitch (informational). */
  scene_count: z.number().int().min(1).max(500).optional(),
  /** Approximate MP4 duration in seconds. */
  duration_sec: z.number().min(0.5).max(3600).optional(),
});

/**
 * POST /api/events/stitch
 *
 * The stitch itself runs in the browser with FFmpeg.wasm, so we need
 * an explicit ping from the client when it completes. Awards XP,
 * unlocks the "The Cut" achievement, bumps the streak.
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 },
    );
  }

  const admin = createServiceRoleClient();
  const result = await awardEvent({
    admin,
    userId: user.id,
    kind: "stitch_exported",
    meta: { project_id: body.project_id },
  });

  return NextResponse.json({
    ok: true,
    progress: result,
    scene_count: body.scene_count,
    duration_sec: body.duration_sec,
  });
}
