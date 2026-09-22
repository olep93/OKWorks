import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sqlClient } from "@/lib/db/client";
import { stripeSandbox } from "@/lib/stripe-sandbox";
export async function POST() {
  try {
    const user = await requireUser();
    if (user.role !== "OWNER") return NextResponse.json({ error: "Bare firmaets eier kan administrere abonnement." }, { status: 403 });
    const { stripe, base } = stripeSandbox();
    const rows = await sqlClient`SELECT provider_customer_id FROM subscriptions WHERE organization_id = ${user.organizationId} AND provider = 'stripe_test'`;
    if (!rows[0]?.provider_customer_id) return NextResponse.json({ error: "Ingen testkunde er knyttet til firmaet." }, { status: 404 });
    const session = await stripe.billingPortal.sessions.create({ customer: String(rows[0].provider_customer_id), return_url: `${base}/account/subscription` });
    return NextResponse.json({ url: session.url });
  } catch { return NextResponse.json({ error: "Testportalen er ikke klar." }, { status: 503 }); }
}
