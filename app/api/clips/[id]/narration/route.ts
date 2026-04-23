import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient, createServiceRoleClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { synthesizeNarration, hasTTS } from "@/lib/tts";
import { recordUsage } from "@/lib/budget";
import { awardEvent } from "@/lib/progress";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  /** Override the narration text baked on the clip row. */
  text: z.string().min(1).max(4000).optional(),
  /** ElevenLabs voice id (20-char) or future human-readable hint. */
  voice: z.string().optional(),
});

type Params = { params: Promise<{ id: string }> };

/**
 * POST /api/clips/[id]/narration
 *
 * Synthesizes narration audio via ElevenLabs (preferred) or OpenAI TTS.
 * Uploads the resulting MP3 to Storage at
 * {project_id}/narration/{clip_id}.mp3 and returns a fresh signed URL.
 * The stitcher reads narration_audio_url per clip and mixes it under
 * the video track at the clip's offset in the final export.
 */
export async function POST(request: NextRequest, { params }: Params) {
  const { id } = await params;

  if (!hasTTS()) {
    return NextResponse.json(
      {
        error:
          "TTS not configured. Set ELEVENLABS_API_KEY (preferred) or OPENAI_API_KEY.",
      },
      { status: 503 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  let body: z.infer<typeof bodySchema> = {};
  try {
    const raw = await request.json().catch(() => ({}));
    body = bodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 },
    );
  }

  const { data: clip, error: readErr } = await supabase
    .from("clips")
    .select("id, project_id, narration, shot_metadata")
    .eq("id", id)
    .maybeSingle();
  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }
  if (!clip) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const text = (body.text ?? clip.narration ?? "").trim();
  if (!text) {
    return NextResponse.json(
      { error: "No narration text on clip. Provide `text` or set clip.narration." },
      { status: 400 },
    );
  }

  const voiceHint =
    body.voice ??
    (typeof clip.shot_metadata?.voice_direction === "string"
      ? clip.shot_metadata.voice_direction
      : null);

  const admin = createServiceRoleClient();

  try {
    const narration = await synthesizeNarration({ text, voiceHint });

    const path = `${clip.project_id}/narration/${clip.id}.mp3`;
    const { error: uploadErr } = await admin.storage
      .from("clips")
      .upload(path, narration.blob, {
        contentType: narration.contentType,
        upsert: true,
      });
    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 500 });
    }
    const { data: signed } = await admin.storage
      .from("clips")
      .createSignedUrl(path, 60 * 60 * 6);
    const finalUrl = signed?.signedUrl ?? null;

    await admin
      .from("clips")
      .update({
        narration_audio_url: finalUrl,
        narration_model: narration.model,
        // If caller overrode text, persist so later stitches use the
        // same script shown in the UI.
        ...(body.text ? { narration: body.text } : {}),
      })
      .eq("id", clip.id);

    // Not a paid compute call as far as our budget model goes (we don't
    // meter TTS yet) — still record a tiny usage row so the dashboard
    // can show TTS activity.
    void recordUsage({
      admin,
      userId: user.id,
      projectId: clip.project_id,
      provider: narration.provider === "openai" ? "openai" : "openrouter",
      action: "chat",
      costCents: 1,
      metadata: {
        clip_id: clip.id,
        kind: "narration",
        tts_model: narration.model,
        tts_provider: narration.provider,
      },
    });
    void awardEvent({
      admin,
      userId: user.id,
      kind: "narration_added",
      meta: { project_id: clip.project_id },
    });

    return NextResponse.json({
      ok: true,
      clip_id: clip.id,
      narration_audio_url: finalUrl,
      provider: narration.provider,
      model: narration.model,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
