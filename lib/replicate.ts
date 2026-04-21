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
}

async function rpc<T>(
  path: string,
  init: RequestInit & { method: "GET" | "POST" | "DELETE" },
): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${env.REPLICATE_API_TOKEN}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `Replicate ${init.method} ${path} -> ${res.status}: ${body.slice(0, 500)}`,
    );
  }
  return (await res.json()) as T;
}

export async function createPrediction<Input>({
  model,
  version,
  input,
  webhook,
  webhook_events_filter,
}: CreatePredictionArgs<Input>): Promise<Prediction<Input>> {
  const body: Record<string, unknown> = { input };
  if (version) body.version = version;
  // When using `model`, POST to /models/{owner}/{name}/predictions instead.
  if (!version && !model) {
    throw new Error("createPrediction: supply `model` or `version`.");
  }
  if (webhook) body.webhook = webhook;
  if (webhook_events_filter) body.webhook_events_filter = webhook_events_filter;

  const path = model
    ? `/models/${model}/predictions`
    : `/predictions`;

  return rpc<Prediction<Input>>(path, {
    method: "POST",
    body: JSON.stringify(body),
  });
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
