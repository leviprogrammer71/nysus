/**
 * URL content-type guard. Pass through any URL we're about to hand to
 * Kling/Seedance — both reject `image/webp` with a cryptic
 * "mime type image/webp is not supported" error. We HEAD-check first
 * and throw a clear message if we'd be feeding webp into the void.
 *
 * The fix layers per the integration guide:
 *   1. Convert webp → jpg client-side before upload.
 *   2. Always pass `output_format: "jpg"` to image models.
 *   3. This guard — last line of defense for legacy uploads.
 */

export async function assertNotWebp(url: string): Promise<void> {
  let res: Response;
  try {
    res = await fetch(url, { method: "HEAD", cache: "no-store" });
  } catch {
    // If HEAD itself fails we don't want to block — let the actual
    // download in the model handler surface the error.
    return;
  }
  if (!res.ok) return;
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  if (ct.includes("image/webp")) {
    throw new Error(
      "Source image is webp — please re-upload as JPEG. Kling and Seedance reject webp inputs.",
    );
  }
}
