import { NextResponse, type NextRequest } from "next/server";
import { createServiceRoleClient } from "@/lib/supabase/server";
import { verifyStripeSignature } from "@/lib/stripe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Stripe webhook. We only care about `checkout.session.completed` — on
 * that event we insert a `user_budget_overrides` row and the user's
 * effective daily cap bumps immediately.
 *
 * Requires STRIPE_WEBHOOK_SECRET. Idempotent via the unique index on
 * stripe_session_id (re-delivery is a no-op).
 */
export async function POST(request: NextRequest) {
  const secret = (process.env.STRIPE_WEBHOOK_SECRET ?? "").trim();
  if (!secret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET not set" },
      { status: 503 },
    );
  }

  const raw = await request.text();
  const header = request.headers.get("stripe-signature");
  const valid = await verifyStripeSignature({
    payload: raw,
    header,
    secret,
  });
  if (!valid) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  let event: {
    id: string;
    type: string;
    data: { object: Record<string, unknown> };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (event.type !== "checkout.session.completed") {
    return NextResponse.json({ ok: true, ignored: event.type });
  }

  const session = event.data.object as {
    id: string;
    client_reference_id?: string;
    payment_intent?: string;
    metadata?: Record<string, string>;
    amount_total?: number;
  };
  const userId = session.client_reference_id ?? session.metadata?.user_id;
  const scope = (session.metadata?.scope ?? "day") as "day" | "month";
  const period = session.metadata?.period;
  const extraFromMeta = Number(session.metadata?.extra_cents ?? "0");
  const extra = Number.isFinite(extraFromMeta) && extraFromMeta > 0
    ? extraFromMeta
    : session.amount_total ?? 0;

  if (!userId || !period || !extra) {
    return NextResponse.json(
      { error: "Missing required metadata on session", session_id: session.id },
      { status: 400 },
    );
  }

  const admin = createServiceRoleClient();
  const { error } = await admin.from("user_budget_overrides").insert({
    user_id: userId,
    scope,
    period,
    extra_cents: extra,
    stripe_session_id: session.id,
    stripe_payment_intent_id:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : null,
    metadata: { event_id: event.id },
  });
  if (error) {
    // Duplicate is fine (unique index) — return 200 so Stripe doesn't
    // keep retrying.
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, note: "duplicate" });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
