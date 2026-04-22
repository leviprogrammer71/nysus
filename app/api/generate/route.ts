import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAllowedEmail } from "@/lib/auth";
import { env } from "@/lib/env";
import { createPrediction } from "@/lib/replicate";
import { buildSeedanceInput, SEEDANCE_MODEL } from "@/lib/seedance";
import { shotPromptSchema } from "@/lib/shot-prompt";
import { gateGeneration, recordUsage } from "@/lib/budget";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  project_id: z.string().uuid(),
  shot: shotPromptSchema,
  seed_image_url: z.string().url().optional().nullable(),
  seed_source: z
    .enum(["auto", "manual_frame", "upload", "none"])
    .default("none"),
});

export async function POST(request: NextRequest) {
  // --- Auth ----------------------------------------------------------
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !isAllowedEmail(user.email)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  // --- Parse ---------------------------------------------------------
  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await request.json());
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid payload" },
      { status: 400 },
    );
  }

  // --- Verify project ownership (RLS) --------------------------------
  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("id")
    .eq("id", body.project_id)
    .maybeSingle();
  if (projectError || !project) {
    return NextResponse.json(
      { error: projectError?.message ?? "Project not found" },
      { status: 404 },
    );
  }

  // --- Budget + rate-limit gate --------------------------------------
  const admin = createServiceRoleClient();
  const gate = await gateGeneration(admin);
  if (!gate.ok) {
    return NextResponse.json(
      { error: gate.reason, code: gate.code },
      { status: 429 },
    );
  }

  // --- Compute next order_index --------------------------------------
  const { data: lastClip } = await supabase
    .from("clips")
    .select("order_index")
    .eq("project_id", project.id)
    .order("order_index", { ascending: false })
    .limit(1)
    .maybeSingle();
  const orderIndex = (lastClip?.order_index ?? -1) + 1;

  // --- Insert queued clip row ----------------------------------------
  const { data: clipRow, error: clipError } = await supabase
    .from("clips")
    .insert({
      project_id: project.id,
      order_index: orderIndex,
      prompt: body.shot.prompt,
      shot_metadata: {
        shot_type: body.shot.shot_type,
        shot_number: body.shot.shot_number,
        duration: body.shot.duration,
        continuity_notes: body.shot.continuity_notes,
        voice_direction: body.shot.voice_direction,
        suggested_seed_behavior: body.shot.suggested_seed_behavior,
        image_prompt: body.shot.image_prompt,
        narration: body.shot.narration,
      },
      seed_image_url: body.seed_image_url ?? null,
      seed_source: body.seed_source,
      status: "queued",
    })
    .select("id")
    .single();

  if (clipError || !clipRow) {
    return NextResponse.json(
      { error: clipError?.message ?? "Failed to create clip" },
      { status: 500 },
    );
  }

  // --- Kick off Replicate prediction ---------------------------------
  const webhookUrl =
    `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "")}/api/replicate/webhook` +
    `?clip_id=${clipRow.id}&secret=${encodeURIComponent(env.CRON_SECRET)}`;

  const seedanceInput = buildSeedanceInput({
    shot: body.shot,
    seedImageUrl: body.seed_image_url,
  });

  try {
    const prediction = await createPrediction({
      model: SEEDANCE_MODEL,
      input: seedanceInput,
      // If APP_URL is localhost, Replicate will still accept the URL but
      // the webhook obviously won't fire. The client-side poll against
      // /api/clips/[id] covers that dev case.
      webhook: webhookUrl,
      webhook_events_filter: ["completed"],
    });

    // Service-role update so we don't depend on RLS timing for the
    // prediction_id write. `admin` is already instantiated above for
    // the budget gate.
    await admin
      .from("clips")
      .update({
        replicate_prediction_id: prediction.id,
        status: prediction.status === "starting" ? "queued" : "processing",
      })
      .eq("id", clipRow.id);

    // Record paid usage for the budget dashboard. Fire-and-forget.
    void recordUsage({
      admin,
      userId: user.id,
      projectId: project.id,
      provider: "replicate",
      action: "generate",
      metadata: {
        clip_id: clipRow.id,
        prediction_id: prediction.id,
        model: SEEDANCE_MODEL,
      },
    });

    return NextResponse.json({
      clip_id: clipRow.id,
      prediction_id: prediction.id,
      status: prediction.status,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    await supabase
      .from("clips")
      .update({ status: "failed", error_message: msg })
      .eq("id", clipRow.id);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
