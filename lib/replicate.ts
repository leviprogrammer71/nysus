import { env } from "@/lib/env";

/**
 * Minimal typed wrapper over Replicate's REST API.
 *
 * We don't use the `replicate` npm package because it pulls in
 * node-fetch polyfills we don't need on Node 22 and it has its own
 * streaming abstractions that conflict with how we want to deal with
 * webhooks.
 */

const API = "https://api.replicate.com/v1";

export type PredictionStatus =
  | "starting"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled";

export interface Prediction<Input = Record<string, unknown>, Output = unknown> {
  id: string;
  version?: string;
  model?: string;
  input: Input;
  output: Output | null;
  status: PredictionStatus;
  error: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  urls?: { get: string; cancel: string };
}

export interface CreatePredictionArgs<Input> {
  /**
   * Model slug in `owner/name` form. Preferred over explicit
   * `version` — Replicate resolves to the current version server-side.
   */
  model?: string;
  /** Specific version SHA if you want to pin. */
  version?: string;
  input: Input;
  /**
   * Absolute webhook URL. Receives prediction updates at the events
   * listed in `webhook_events_filter`. Leave empty to disable webhooks
   * (the client will fall back to polling).
   */
  webhook?: string;
  webhook_events_filter?: Array<"start" | "output" | "logs" | "completed">;
  /**
   * Hold the connection open up to N seconds for fast jobs to finish
   * synchronously (Replicate's `Prefer: wait=N` header). Per the
   * integration guide, set this for image models like gpt-image-2 so
   * the prediction frequently lands inside the request and we skip
   * polling. Capped at 60 by Replicate.
   */
  preferWaitSeconds?: number;
}

async function rpc<T>(
  path: string,
  init: RequestInit & { method: "GET" | "POST" | "DELETE" },
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
      cache: "no-store",
    });
  } catch (err) {
    // Unwrap undici's "fetch failed" wrapper so callers see the
    // underlying DNS / connection / TLS failure instead of a useless
    // generic message.
    const cause = err instanceof Error
      ? ((err as { cause?: unknown }).cause as Error | undefined)
      : undefined;
    const code = cause ? (cause as { code?: string }).code : undefined;
    const detail = cause
      ? `${code ? `${code} · ` : ""}${cause.message}`
      : err instanceof Error
      ? err.message
      : String(err);
    throw new Error(
      `Replicate ${init.method} ${path} — network error: ${detail}`,
    );
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Replicate ${init.method} ${path} -> ${res.status}: ${body.slice(0, 500)}`,
    );
  }
  return (await res.json()) as T;
}

/**
 * Parse a model string into (model, version?). Replicate slugs come
 * in two forms:
 *   - "owner/name"                 → latest version (POST /models/...)
 *   - "owner/name:<versionSha>"    → pinned version (POST /predictions)
 */
function parseModelSlug(slug: string): { model: string; version?: string } {
  const [modelPart, versionPart] = slug.split(":");
  if (versionPart && versionPart.length >= 8) {
    return { model: modelPart, version: versionPart };
  }
  return { model: slug };
}

export async function createPrediction<Input>({
  model,
  version,
  input,
  webhook,
  webhook_events_filter,
  preferWaitSeconds,
}: CreatePredictionArgs<Input>): Promise<Prediction<Input>> {
  if (!version && !model) {
    throw new Error("createPrediction: supply `model` or `version`.");
  }

  // When `model` carries a `:version` suffix, switch to the /predictions
  // endpoint with an explicit version — the /models/owner/name/predictions
  // endpoint can't take a version SHA in the URL.
  let resolvedVersion = version;
  let resolvedModel = model;
  if (!resolvedVersion && model && model.includes(":")) {
    const parsed = parseModelSlug(model);
    resolvedVersion = parsed.version;
    resolvedModel = parsed.model;
  }

  const body: Record<string, unknown> = { input };
  if (resolvedVersion) body.version = resolvedVersion;
  if (webhook) body.webhook = webhook;
  if (webhook_events_filter) body.webhook_events_filter = webhook_events_filter;

  const path =
    resolvedVersion
      ? `/predictions`
      : `/models/${resolvedModel}/predictions`;

  // Replicate caps `Prefer: wait` at 60. Snap to that ceiling.
  const headers: Record<string, string> = {};
  if (preferWaitSeconds && preferWaitSeconds > 0) {
    headers.Prefer = `wait=${Math.min(60, Math.floor(preferWaitSeconds))}`;
  }

  return rpc<Prediction<Input>>(path, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
}

/**
 * Probe Replicate authentication without creating a prediction. Used
 * by /api/health/replicate to verify REPLICATE_API_TOKEN + network
 * reachability before burning a generation credit.
 */
export async function replicateWhoami(): Promise<{
  ok: boolean;
  detail: string;
}> {
  try {
    const res = await fetch(`${API}/account`, {
      headers: { Authorization: `Bearer ${env.REPLICATE_API_TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      return {
        ok: false,
        detail: `HTTP ${res.status}: ${body.slice(0, 300)}`,
      };
    }
    const body = (await res.json()) as {
      username?: string;
      name?: string;
      github_url?: string;
      type?: string;
    };
    return {
      ok: true,
      detail: `authenticated as ${body.username ?? body.name ?? "(unknown)"}`,
    };
  } catch (err) {
    const cause = err instanceof Error
      ? ((err as { cause?: unknown }).cause as Error | undefined)
      : undefined;
    const detail = cause
      ? `${(cause as { code?: string }).code ?? ""} ${cause.message ?? ""}`.trim()
      : err instanceof Error
      ? err.message
      : String(err);
    return { ok: false, detail };
  }
}

export async function getPrediction<Input, Output>(
  id: string,
): Promise<Prediction<Input, Output>> {
  return rpc<Prediction<Input, Output>>(`/predictions/${id}`, { method: "GET" });
}

export async function cancelPrediction(id: string): Promise<void> {
  await rpc<unknown>(`/predictions/${id}/cancel`, { method: "POST" });
}

/**
 * Fetch a URL produced by a Replicate output (often a signed CDN URL
 * that expires after an hour). Used by the webhook handler to mirror
 * the video into our own Supabase Storage bucket.
 */
export async function fetchReplicateOutputAsBlob(url: string): Promise<{
  blob: Blob;
  contentType: string;
}> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Replicate output ${res.status}: ${url}`);
  }
  const contentType = res.headers.get("content-type") ?? "video/mp4";
  const blob = await res.blob();
  return { blob, contentType };
}
