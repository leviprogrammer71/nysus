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
