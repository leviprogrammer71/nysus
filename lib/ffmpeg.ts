"use client";

import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

/**
 * FFmpeg.wasm loader + helpers.
 *
 * We lazy-load the core from a CDN (unpkg) with `toBlobURL` so that
 * Next's bundler doesn't try to include the ~30 MB wasm in our bundle.
 *
 * A single FFmpeg instance is kept for the session. Reusing it keeps
 * subsequent extractions fast (no re-init cost).
 */

const FFMPEG_BASE =
  "https://unpkg.com/@ffmpeg/core@0.12.10/dist/umd";

let instance: FFmpeg | null = null;
let loading: Promise<FFmpeg> | null = null;

export async function getFFmpeg(): Promise<FFmpeg> {
  if (instance) return instance;
  if (loading) return loading;

  loading = (async () => {
    const ff = new FFmpeg();
    await ff.load({
      coreURL: await toBlobURL(`${FFMPEG_BASE}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(
        `${FFMPEG_BASE}/ffmpeg-core.wasm`,
        "application/wasm",
      ),
    });
    instance = ff;
    return ff;
  })();

  return loading;
}

/**
 * Extract multiple frames from a video Blob/URL.
 * `times` is in seconds; pass `-0.1` for "0.1s before end".
 *
 * Returns parallel arrays of JPG Blobs and their object URLs.
 */
export async function extractFrames(
  video: Blob | string,
  times: Array<number | "end">,
): Promise<Array<{ blob: Blob; url: string; time: number | "end" }>> {
  const ff = await getFFmpeg();

  const inputName = "in.mp4";
  if (typeof video === "string") {
    await ff.writeFile(inputName, await fetchFile(video));
  } else {
    await ff.writeFile(
      inputName,
      new Uint8Array(await video.arrayBuffer()),
    );
  }

  const out: Array<{ blob: Blob; url: string; time: number | "end" }> = [];
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    const outName = `frame_${i}.jpg`;
    const args: string[] =
      t === "end"
        ? ["-sseof", "-0.1", "-i", inputName, "-vframes", "1", "-q:v", "2", outName]
        : ["-ss", String(t), "-i", inputName, "-vframes", "1", "-q:v", "2", outName];

    await ff.exec(args);
    const file = (await ff.readFile(outName)) as Uint8Array;
    // Copy the buffer so subsequent ffmpeg calls can free their side.
    const copy = new Uint8Array(file).buffer;
    const blob = new Blob([copy], { type: "image/jpeg" });
    out.push({ blob, url: URL.createObjectURL(blob), time: t });
    try {
      await ff.deleteFile(outName);
    } catch {
      /* ignore */
    }
  }

  try {
    await ff.deleteFile(inputName);
  } catch {
    /* ignore */
  }

  return out;
}

/**
 * Mix a narration audio track on top of a single MP4 clip. Output is
 * re-encoded so the clip carries a fresh audio stream (we can't copy
 * because the clip may be silent). The output is trimmed to the
 * shorter of the video or audio duration with `-shortest`.
 */
export async function mixNarrationOnClip({
  video,
  audio,
  videoName = "v.mp4",
  audioName = "a.mp3",
}: {
  video: Blob;
  audio: Blob;
  videoName?: string;
  audioName?: string;
}): Promise<Blob> {
  const ff = await getFFmpeg();
  await ff.writeFile(videoName, new Uint8Array(await video.arrayBuffer()));
  await ff.writeFile(audioName, new Uint8Array(await audio.arrayBuffer()));

  const outName = "mixed.mp4";
  await ff.exec([
    "-i",
    videoName,
    "-i",
    audioName,
    "-map",
    "0:v:0",
    "-map",
    "1:a:0",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-b:a",
    "192k",
    "-shortest",
    outName,
  ]);
  const file = (await ff.readFile(outName)) as Uint8Array;
  const copy = new Uint8Array(file).buffer;
  const blob = new Blob([copy], { type: "video/mp4" });
  try {
    await ff.deleteFile(videoName);
    await ff.deleteFile(audioName);
    await ff.deleteFile(outName);
  } catch {
    /* ignore */
  }
  return blob;
}

/**
 * Burn subtitles from an SRT string into a video. Output is
 * re-encoded (we have to, subtitles filter is video-only).
 */
export async function burnCaptions({
  video,
  srt,
}: {
  video: Blob;
  srt: string;
}): Promise<Blob> {
  const ff = await getFFmpeg();
  await ff.writeFile("in.mp4", new Uint8Array(await video.arrayBuffer()));
  await ff.writeFile("caps.srt", new TextEncoder().encode(srt));

  const outName = "captioned.mp4";
  await ff.exec([
    "-i",
    "in.mp4",
    "-vf",
    // Tight margin-bottom so captions sit in the lower-third safe zone
    // on 9:16 phones without clipping on 16:9.
    "subtitles=caps.srt:force_style='Fontsize=20,OutlineColour=&H80000000,BorderStyle=3,MarginV=40'",
    "-c:a",
    "copy",
    outName,
  ]);
  const file = (await ff.readFile(outName)) as Uint8Array;
  const copy = new Uint8Array(file).buffer;
  const blob = new Blob([copy], { type: "video/mp4" });
  try {
    await ff.deleteFile("in.mp4");
    await ff.deleteFile("caps.srt");
    await ff.deleteFile(outName);
  } catch {
    /* ignore */
  }
  return blob;
}

/**
 * Get a video's duration in seconds by parsing ffmpeg's stderr output.
 * FFmpeg.wasm doesn't expose ffprobe so we use the duration logged
 * when the file is probed.
 */
export async function probeDurationSec(video: Blob): Promise<number> {
  const ff = await getFFmpeg();
  await ff.writeFile("probe.mp4", new Uint8Array(await video.arrayBuffer()));
  let duration = 0;
  const handler = (e: { message: string }) => {
    const m = e.message.match(
      /Duration:\s+(\d+):(\d+):(\d+(?:\.\d+)?)/,
    );
    if (m) {
      const [, hh, mm, ss] = m;
      duration = Number(hh) * 3600 + Number(mm) * 60 + Number(ss);
    }
  };
  const ffAny = ff as unknown as {
    on?: (name: string, fn: (e: { message: string }) => void) => void;
    off?: (name: string, fn: (e: { message: string }) => void) => void;
  };
  ffAny.on?.("log", handler);
  try {
    // -f null triggers full probe without producing an output file
    await ff.exec(["-i", "probe.mp4", "-f", "null", "-"]);
  } catch {
    /* ffmpeg exits non-zero when there's no output; ignore */
  }
  ffAny.off?.("log", handler);
  try {
    await ff.deleteFile("probe.mp4");
  } catch {
    /* ignore */
  }
  return duration;
}

/**
 * Build an SRT string from per-clip narration texts + durations.
 * Each caption covers the full clip interval. SRT times look like
 * `HH:MM:SS,mmm`.
 */
export function buildSrtFromClips(
  parts: Array<{ text: string | null | undefined; durationSec: number }>,
): string {
  const fmt = (s: number) => {
    const hh = String(Math.floor(s / 3600)).padStart(2, "0");
    const mm = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const ss = Math.floor(s % 60);
    const ms = Math.round((s - Math.floor(s)) * 1000);
    return `${hh}:${mm}:${String(ss).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
  };

  let t = 0;
  const lines: string[] = [];
  let idx = 0;
  for (const p of parts) {
    const start = t;
    const end = t + Math.max(0.5, p.durationSec);
    t = end;
    if (!p.text || !p.text.trim()) continue;
    idx += 1;
    lines.push(String(idx));
    lines.push(`${fmt(start)} --> ${fmt(end)}`);
    // Wrap at ~40 chars so captions don't overflow 9:16.
    lines.push(wrap(p.text.trim(), 40));
    lines.push("");
  }
  return lines.join("\n");
}

function wrap(text: string, cols: number): string {
  const words = text.split(/\s+/);
  const out: string[] = [];
  let row = "";
  for (const w of words) {
    if ((row + " " + w).trim().length > cols) {
      if (row) out.push(row);
      row = w;
    } else {
      row = (row ? row + " " : "") + w;
    }
  }
  if (row) out.push(row);
  return out.join("\n");
}

/**
 * Concat MP4 clips into a single MP4 using ffmpeg's concat demuxer.
 * All inputs must be same resolution / fps / codec; Seedance outputs
 * are consistent so this is fine.
 */
export async function concatMp4s(clips: Blob[]): Promise<Blob> {
  const ff = await getFFmpeg();

  const listLines: string[] = [];
  for (let i = 0; i < clips.length; i++) {
    const name = `clip_${i}.mp4`;
    await ff.writeFile(
      name,
      new Uint8Array(await clips[i].arrayBuffer()),
    );
    listLines.push(`file '${name}'`);
  }

  const listName = "list.txt";
  await ff.writeFile(listName, new TextEncoder().encode(listLines.join("\n")));

  const outName = "out.mp4";
  await ff.exec([
    "-f",
    "concat",
    "-safe",
    "0",
    "-i",
    listName,
    "-c",
    "copy",
    outName,
  ]);

  const file = (await ff.readFile(outName)) as Uint8Array;
  const copy = new Uint8Array(file).buffer;
  const blob = new Blob([copy], { type: "video/mp4" });

  // Tidy
  try {
    await ff.deleteFile(listName);
    await ff.deleteFile(outName);
    for (let i = 0; i < clips.length; i++) {
      await ff.deleteFile(`clip_${i}.mp4`).catch(() => {});
    }
  } catch {
    /* ignore */
  }

  return blob;
}
