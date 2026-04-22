/**
 * Thin Stripe wrapper for top-up Checkout sessions.
 *
 * We don't pull in the `stripe` npm package — our surface is just two
 * HTTPS calls (create Checkout session, verify webhook signature) and
 * adding a ~2MB dep for that is heavy for a PWA. We hit the REST API
 * directly with fetch.
 *
 * Env:
 *   STRIPE_SECRET_KEY         — required to create Checkout sessions
 *   STRIPE_WEBHOOK_SECRET     — required to verify webhook payloads
 *   STRIPE_PRICE_ID_TOPUP_10  — optional. If unset, we use price_data
 *                               inline so the UI works without a
 *                               pre-created price object.
 */

export function hasStripe(): boolean {
  return Boolean((process.env.STRIPE_SECRET_KEY ?? "").trim());
}

function requireKey(): string {
  const k = (process.env.STRIPE_SECRET_KEY ?? "").trim();
  if (!k) {
    throw new Error(
      "Stripe is not configured. Set STRIPE_SECRET_KEY in .env.local.",
    );
  }
  return k;
}

/**
 * Create a Checkout session for a single line item of $amountCents.
 * Metadata carries user_id + scope + period so the webhook can write
 * a row to user_budget_overrides on payment.
 */
export async function createTopupCheckoutSession({
  amountCents,
  userId,
  email,
  successUrl,
  cancelUrl,
  scope,
  period,
}: {
  amountCents: number;
  userId: string;
  email?: string | null;
  successUrl: string;
  cancelUrl: string;
  scope: "day" | "month";
  period: string;
}): Promise<{ id: string; url: string }> {
  const key = requireKey();

  const body = new URLSearchParams();
  body.set("mode", "payment");
  body.set("success_url", successUrl);
  body.set("cancel_url", cancelUrl);
  if (email) body.set("customer_email", email);
  body.set("client_reference_id", userId);
  body.set("metadata[user_id]", userId);
  body.set("metadata[scope]", scope);
  body.set("metadata[period]", period);
  body.set("metadata[extra_cents]", String(amountCents));

  const priceId = (process.env.STRIPE_PRICE_ID_TOPUP_10 ?? "").trim();
  if (priceId) {
    body.set("line_items[0][price]", priceId);
    body.set("line_items[0][quantity]", "1");
  } else {
    body.set("line_items[0][price_data][currency]", "usd");
    body.set("line_items[0][price_data][product_data][name]", `Nysus credit top-up ($${(amountCents / 100).toFixed(2)})`);
    body.set("line_items[0][price_data][unit_amount]", String(amountCents));
    body.set("line_items[0][quantity]", "1");
  }

  const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
    method: "POST",
    headers: {
      authorization: `Bearer ${key}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`Stripe checkout.sessions.create ${res.status}: ${msg.slice(0, 400)}`);
  }
  const json = (await res.json()) as { id: string; url: string };
  return { id: json.id, url: json.url };
}

/**
 * Verify a Stripe webhook signature. Uses the `Stripe-Signature`
 * header format: `t=…,v1=…`. Node crypto is fine; Edge isn't (different
 * webcrypto signature), but webhook routes always run on the node
 * runtime.
 */
export async function verifyStripeSignature({
  payload,
  header,
  secret,
  toleranceSeconds = 300,
}: {
  payload: string;
  header: string | null;
  secret: string;
  toleranceSeconds?: number;
}): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((p) => {
      const [k, v] = p.split("=");
      return [k?.trim(), v?.trim()];
    }),
  );
  const t = Number(parts.t);
  const sig = parts.v1;
  if (!t || !sig) return false;
  if (
    Math.abs(Math.floor(Date.now() / 1000) - t) > toleranceSeconds
  ) {
    return false;
  }
  const { createHmac, timingSafeEqual } = await import("node:crypto");
  const signedPayload = `${t}.${payload}`;
  const expected = createHmac("sha256", secret)
    .update(signedPayload)
    .digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(sig, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
