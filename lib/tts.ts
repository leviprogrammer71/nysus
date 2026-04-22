/**
 * Text-to-speech provider abstraction.
 *
 * Priority: ElevenLabs (if ELEVENLABS_API_KEY set) → OpenAI TTS
 * (if OPENAI_API_KEY set) → null (endpoint returns 503).
 *
 * Returns an MP3 blob; the narration endpoint uploads it to the `clips`
 * bucket and the stitcher overlays it as an audio track.
 */

type Narration = {
  blob: Blob;
  contentType: string;
  provider: "elevenlabs" | "openai";
  model: string;
};

export function hasTTS(): boolean {
  return Boolean(
    (process.env.ELEVENLABS_API_KEY ?? "").trim() ||
      (process.env.OPENAI_API_KEY ?? "").trim(),
  );
}

const ELEVENLABS_DEFAULT_VOICE =
  // "Rachel" — a neutral female voice ElevenLabs exposes on the free
  // tier. Override per-character via voice_direction or an explicit id.
  process.env.ELEVENLABS_DEFAULT_VOICE ?? "21m00Tcm4TlvDq8ikWAM";

const ELEVENLABS_MODEL =
  process.env.ELEVENLABS_MODEL ?? "eleven_multilingual_v2";

const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL ?? "gpt-4o-mini-tts";
// Shipped voices in OpenAI's /v1/audio/speech: alloy, ash, coral, echo,
// fable, onyx, nova, sage, shimmer. "alloy" is the neutral default.
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE ?? "alloy";

export async function synthesizeNarration({
  text,
  voiceHint,
  signal,
}: {
  text: string;
  voiceHint?: string | null;
  signal?: AbortSignal;
}): Promise<Narration> {
  const eleven = (process.env.ELEVENLABS_API_KEY ?? "").trim();
  if (eleven) {
    return elevenlabs({ text, voiceHint, apiKey: eleven, signal });
  }
  const openai = (process.env.OPENAI_API_KEY ?? "").trim();
  if (openai) {
    return openaiTTS({ text, apiKey: openai, signal });
  }
  throw new Error(
    "No TTS provider configured. Set ELEVENLABS_API_KEY or OPENAI_API_KEY.",
  );
}

async function elevenlabs({
  text,
  voiceHint,
  apiKey,
  signal,
}: {
  text: string;
  voiceHint?: string | null;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<Narration> {
  // If the caller passes a raw 20-char voice id we use it directly;
  // otherwise we fall back to the app-level default. (A future pass
  // can map voice_direction strings like "warm, weathered" to the
  // closest ElevenLabs voice via their /v1/voices endpoint.)
  const voiceId =
    voiceHint && /^[A-Za-z0-9]{16,24}$/.test(voiceHint)
      ? voiceHint
      : ELEVENLABS_DEFAULT_VOICE;

  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: "POST",
      signal,
      headers: {
        "xi-api-key": apiKey,
        "content-type": "application/json",
        accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text,
        model_id: ELEVENLABS_MODEL,
        voice_settings: {
          stability: 0.45,
          similarity_boost: 0.75,
          style: 0.2,
          use_speaker_boost: true,
        },
      }),
    },
  );
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`ElevenLabs TTS ${res.status}: ${msg.slice(0, 400)}`);
  }
  const ab = await res.arrayBuffer();
  return {
    blob: new Blob([ab], { type: "audio/mpeg" }),
    contentType: "audio/mpeg",
    provider: "elevenlabs",
    model: ELEVENLABS_MODEL,
  };
}

async function openaiTTS({
  text,
  apiKey,
  signal,
}: {
  text: string;
  apiKey: string;
  signal?: AbortSignal;
}): Promise<Narration> {
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    signal,
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_TTS_MODEL,
      voice: OPENAI_TTS_VOICE,
      input: text,
      format: "mp3",
    }),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`OpenAI TTS ${res.status}: ${msg.slice(0, 400)}`);
  }
  const ab = await res.arrayBuffer();
  return {
    blob: new Blob([ab], { type: "audio/mpeg" }),
    contentType: "audio/mpeg",
    provider: "openai",
    model: OPENAI_TTS_MODEL,
  };
}
