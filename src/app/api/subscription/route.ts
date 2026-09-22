import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { sqlClient } from "@/lib/db/client";
import { stripeSandbox } from "@/lib/stripe-sandbox";
import { SANDBOX_TERMS_VERSION, sandboxBillingConfig, SUBSCRIPTION_PRICE_ORE, validateSandboxPrice } from "@/lib/subscription-policy";

export async function GET() {
  try {
    const user = await requireUser();
    let configured = false;
    try { sandboxBillingConfig(); configured = Boolean(process.env.STRIPE_TEST_WEBHOOK_SECRET); } catch {}
    const rows = await sqlClient`SELECT status, cancel_at_period_end, current_period_end FROM subscriptions WHERE organization_id = ${user.organizationId} AND provider = 'stripe_test'`;
    return NextResponse.json({ mode: "test", configured, priceOre: SUBSCRIPTION_PRICE_ORE, termsVersion: SANDBOX_TERMS_VERSION, canManage: user.role === "OWNER", subscription: rows[0] ?? null });
  } catch { return NextResponse.json({ error: "Logg inn først." }, { status: 401 }); }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    if (user.role !== "OWNER") return NextResponse.json({ error: "Bare firmaets eier kan administrere abonnement." }, { status: 403 });
    const input = z.object({ acceptedTestTerms: z.literal(true), termsVersion: z.literal(SANDBOX_TERMS_VERSION) }).safeParse(await request.json());
    if (!input.success) return NextResponse.json({ error: "Bekreft at dette er en uforpliktende test." }, { status: 400 });
    const { stripe, priceId, base } = stripeSandbox();
    if (!process.env.STRIPE_TEST_WEBHOOK_SECRET) throw new Error("BILLING_DISABLED");
    const price = await stripe.prices.retrieve(priceId);
    validateSandboxPrice(price);
    const attempt = await sqlClient.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`subscription:${user.organizationId}`}))`;
      const existing = await tx`SELECT status FROM subscriptions WHERE organization_id = ${user.organizationId} AND provider = 'stripe_test'`;
      if (existing.length && existing[0].status !== "CANCELED") throw new Error("SUBSCRIPTION_EXISTS");
      const previous = await tx`SELECT id, session_id, customer_email, expires_at FROM subscription_checkout_attempts WHERE organization_id = ${user.organizationId} AND status = 'OPEN' ORDER BY created_at DESC LIMIT 1`;
      if (previous.length) return previous[0];
      const id = randomUUID();
      const expiresAt = new Date((Math.floor(Date.now() / 1000) + 86400) * 1000);
      const rows = await tx`INSERT INTO subscription_checkout_attempts (id, organization_id, user_id, terms_version, customer_email, expires_at) VALUES (${id}, ${user.organizationId}, ${user.id}, ${SANDBOX_TERMS_VERSION}, ${user.email}, ${expiresAt}) RETURNING id, session_id, customer_email, expires_at`;
      return rows[0];
    });
    // Persist the attempt before contacting Stripe: retries reuse identical parameters.
    if (attempt.session_id) {
      const session = await stripe.checkout.sessions.retrieve(String(attempt.session_id));
      if (!session.livemode && session.status === "expired") {
        await sqlClient`UPDATE subscription_checkout_attempts SET status = 'EXPIRED' WHERE id = ${attempt.id} AND organization_id = ${user.organizationId} AND status = 'OPEN'`;
        return NextResponse.json({ error: "Den forrige testbetalingen er utløpt. Trykk igjen for å starte en ny." }, { status: 409 });
      }
      if (session.status !== "open" || !session.url || session.livemode) throw new Error("SUBSCRIPTION_EXISTS");
      return NextResponse.json({ url: session.url });
    }
    const id = String(attempt.id);
    const session = await stripe.checkout.sessions.create({ mode: "subscription", customer_email: String(attempt.customer_email), line_items: [{ price: priceId, quantity: 1 }], payment_method_types: ["card"], automatic_tax: { enabled: false }, allow_promotion_codes: false, expires_at: Math.floor(new Date(attempt.expires_at).getTime() / 1000), client_reference_id: user.organizationId, subscription_data: { metadata: { organizationId: user.organizationId, attemptId: id } }, success_url: `${base}/account/subscription?checkout=returned`, cancel_url: `${base}/account/subscription?checkout=canceled` }, { idempotencyKey: `sandbox-checkout-${id}` });
    if (session.livemode || !session.url) throw new Error("BILLING_DISABLED");
    await sqlClient`UPDATE subscription_checkout_attempts SET session_id = ${session.id} WHERE id = ${id} AND organization_id = ${user.organizationId}`;
    return NextResponse.json({ url: session.url });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "UNAUTHORIZED") return NextResponse.json({ error: "Logg inn først." }, { status: 401 });
    if (message === "SUBSCRIPTION_EXISTS") return NextResponse.json({ error: "Et testabonnement finnes allerede, eller bekreftelsen behandles. Oppdater siden." }, { status: 409 });
    return NextResponse.json({ error: "Testbetaling er ikke klar. Stripe-testnøkler, månedspris og webhook må konfigureres." }, { status: 503 });
  }
}
