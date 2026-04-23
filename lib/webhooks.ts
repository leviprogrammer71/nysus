import { env } from "@/lib/env";

/**
 * Build a webhook URL Replicate will actually accept.
 *
 * Replicate rejects non-HTTPS webhooks with a 422 ("Not a valid HTTPS URL"),
 * so in local dev (NEXT_PUBLIC_APP_URL=http://localhost:3000) we return
 * null and omit the field entirely — the client-side poll on
 * /api/clips/[id] already proactively refreshes state via
 * refreshClipFromReplicate, so the whole thing still lands on the
 * correct terminal state without the webhook.
 *
 * Prod / tunnelled dev (ngrok, cloudflared, Vercel previews) return a
 * normal HTTPS URL and the webhook fires as usual.
 */
export function replicateWebhookUrl(clipId: string): string | null {
  const base = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  if (!/^https:\/\//i.test(base)) return null;
  return (
    `${base}/api/replicate/webhook` +
    `?clip_id=${encodeURIComponent(clipId)}` +
    `&secret=${encodeURIComponent(env.CRON_SECRET)}`
  );
}
