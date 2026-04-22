import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type SB = SupabaseClient<Database>;

/**
 * Web Push helper. Keeps the `web-push` dep behind a dynamic import so
 * that Next bundling for Edge routes doesn't trip over node:crypto
 * usage in the lib.
 *
 * Env:
 *   VAPID_PUBLIC_KEY  — also exposed to the client as NEXT_PUBLIC_VAPID_PUBLIC_KEY
 *   VAPID_PRIVATE_KEY
 *   VAPID_CONTACT     — mailto: or https: string, per web-push spec
 */

export function hasPush(): boolean {
  return Boolean(
    (process.env.VAPID_PUBLIC_KEY ?? "").trim() &&
      (process.env.VAPID_PRIVATE_KEY ?? "").trim(),
  );
}

export async function sendPushToUser({
  admin,
  userId,
  title,
  body,
  url,
  tag,
}: {
  admin: SB;
  userId: string;
  title: string;
  body: string;
  url?: string;
  tag?: string;
}): Promise<{ sent: number; removed: number }> {
  if (!hasPush()) return { sent: 0, removed: 0 };

  const { data: subs } = await admin
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subs || subs.length === 0) return { sent: 0, removed: 0 };

  const webpush = (await import("web-push")).default;
  webpush.setVapidDetails(
    process.env.VAPID_CONTACT ?? "mailto:admin@nysus.media",
    process.env.VAPID_PUBLIC_KEY as string,
    process.env.VAPID_PRIVATE_KEY as string,
  );

  const payload = JSON.stringify({ title, body, url, tag });
  let sent = 0;
  let removed = 0;

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: s.endpoint,
            keys: { p256dh: s.p256dh, auth: s.auth },
          },
          payload,
        );
        sent += 1;
        await admin
          .from("push_subscriptions")
          .update({ last_used_at: new Date().toISOString() })
          .eq("id", s.id);
      } catch (err: unknown) {
        const statusCode =
          typeof err === "object" && err !== null && "statusCode" in err
            ? (err as { statusCode: number }).statusCode
            : 0;
        // 404/410 → endpoint gone. Drop the row so we don't retry.
        if (statusCode === 404 || statusCode === 410) {
          await admin.from("push_subscriptions").delete().eq("id", s.id);
          removed += 1;
        }
      }
    }),
  );

  return { sent, removed };
}
