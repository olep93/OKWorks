import Stripe from "stripe";
import { NextResponse } from "next/server";
import { z } from "zod";
import { stripeSandbox } from "@/lib/stripe-sandbox";
import { subscriptionStatus, validateSandboxPrice } from "@/lib/subscription-policy";
import { sqlClient } from "@/lib/db/client";

export const runtime = "nodejs";
export async function POST(request: Request) {
  let event: Stripe.Event;
  let client: ReturnType<typeof stripeSandbox>;
  try {
    client = stripeSandbox();
    const secret = process.env.STRIPE_TEST_WEBHOOK_SECRET;
    if (!secret) return NextResponse.json({ error: "Webhook deaktivert." }, { status: 503 });
    event = client.stripe.webhooks.constructEvent(await request.text(), request.headers.get("stripe-signature") ?? "", secret);
    if (event.livemode) return NextResponse.json({ error: "Ekte betaling er deaktivert." }, { status: 400 });
  } catch { return NextResponse.json({ error: "Ugyldig webhook eller manglende testoppsett." }, { status: 400 }); }
  const supported = ["customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"];
  if (!supported.includes(event.type)) return NextResponse.json({ received: true, ignored: true });
  try {
    const object = event.data.object as Stripe.Subscription;
    const organizationId = z.uuid().safeParse(object.metadata.organizationId);
    const attemptId = z.uuid().safeParse(object.metadata.attemptId);
    if (!organizationId.success || !attemptId.success) return NextResponse.json({ received: true, ignored: true });
    await sqlClient.begin(async (tx) => {
      await tx`SELECT pg_advisory_xact_lock(hashtext(${`subscription:${organizationId.data}`}))`;
      const binding = await tx`SELECT id FROM subscription_checkout_attempts WHERE id = ${attemptId.data} AND organization_id = ${organizationId.data}`;
      if (!binding.length) throw new Error("UNBOUND_SUBSCRIPTION");
      const inserted = await tx`INSERT INTO subscription_webhook_events (event_id, event_type, organization_id) VALUES (${event.id}, ${event.type}, ${organizationId.data}) ON CONFLICT DO NOTHING RETURNING event_id`;
      if (!inserted.length) return;
      // Fetch current authoritative state under the tenant lock instead of trusting event order.
      const current = await client.stripe.subscriptions.retrieve(object.id);
      if (current.livemode || current.metadata.organizationId !== organizationId.data || current.metadata.attemptId !== attemptId.data || current.items.data.length !== 1) throw new Error("INVALID_SUBSCRIPTION");
      const item = current.items.data[0];
      if (item.price.id !== client.priceId || item.quantity !== 1) throw new Error("INVALID_SUBSCRIPTION_PRICE");
      validateSandboxPrice(item.price);
      const existing = await tx`SELECT provider_subscription_id, status FROM subscriptions WHERE organization_id = ${organizationId.data}`;
      if (existing.length && existing[0].provider_subscription_id !== current.id && existing[0].status !== "CANCELED") throw new Error("SUBSCRIPTION_CONFLICT");
      const customerId = typeof current.customer === "string" ? current.customer : current.customer.id;
      const status = subscriptionStatus(current.status);
      const periodStart = new Date(item.current_period_start * 1000);
      const periodEnd = new Date(item.current_period_end * 1000);
      await tx`INSERT INTO subscriptions (organization_id, provider, provider_customer_id, provider_subscription_id, price_amount_ore, currency, status, current_period_start, current_period_end, cancel_at_period_end) VALUES (${organizationId.data}, 'stripe_test', ${customerId}, ${current.id}, 9900, 'NOK', ${status}, ${periodStart}, ${periodEnd}, ${current.cancel_at_period_end}) ON CONFLICT (organization_id) DO UPDATE SET provider = 'stripe_test', provider_customer_id = EXCLUDED.provider_customer_id, provider_subscription_id = EXCLUDED.provider_subscription_id, price_amount_ore = EXCLUDED.price_amount_ore, currency = EXCLUDED.currency, status = EXCLUDED.status, current_period_start = EXCLUDED.current_period_start, current_period_end = EXCLUDED.current_period_end, cancel_at_period_end = EXCLUDED.cancel_at_period_end, updated_at = now()`;
      await tx`UPDATE subscription_webhook_events SET processed_at = now() WHERE event_id = ${event.id}`;
      await tx`UPDATE subscription_checkout_attempts SET status = 'COMPLETED' WHERE id = ${attemptId.data} AND organization_id = ${organizationId.data}`;
    });
    return NextResponse.json({ received: true });
  } catch {
    // Rollback includes the ledger insert, so Stripe may safely retry failures.
    return NextResponse.json({ error: "Kunne ikke behandle testhendelsen. Prøv igjen." }, { status: 503 });
  }
}
