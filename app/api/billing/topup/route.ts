import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isAuthenticated } from "@/lib/auth";
import { env } from "@/lib/env";
import { createTopupCheckoutSession, hasStripe } from "@/lib/stripe";
import { todayPeriod } from "@/lib/overrides";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  amount_cents: z
    .number()
    .int()
    .min(100)
    .max(10_000)
    .default(1000),
  scope: z.enum(["day", "month"]).default("day"),
});

/**
 * POST /api/billing/topup — mint a Stripe Checkout session.
 * Response shape:
 *   { url: "https://checkout.stripe.com/..." }  when Stripe is wired
 *   { error, code: "stripe_not_configured" }    503 when it isn't
 */
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!isAuthenticated(user)) {
    return NextResponse.json({ error: "Not authorized" }, { status: 401 });
  }

  if (!hasStripe()) {
    return NextResponse.json(
      {
        error: "Top-ups are not configured on this install. Set STRIPE_SECRET_KEY.",
        code: "stripe_not_configured",
      },
      { status: 503 },
    );
  }

  let body: z.infer<typeof bodySchema> = { amount_cents: 1000, scope: "day" };
  try {
    const raw = await request.json().catch(() => ({}));
    body = bodySchema.parse(raw);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Invalid body" },
      { status: 400 },
    );
  }

  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, "");
  const period = body.scope === "day" ? todayPeriod() : todayPeriod().slice(0, 7);

  try {
    const session = await createTopupCheckoutSession({
      amountCents: body.amount_cents,
      userId: user.id,
      email: user.email,
      successUrl: `${appUrl}/dashboard?topup=ok`,
      cancelUrl: `${appUrl}/dashboard?topup=cancel`,
      scope: body.scope,
      period,
    });
    return NextResponse.json({ url: session.url, id: session.id });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
