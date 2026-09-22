import { NextResponse } from "next/server";
import { Resend } from "resend";
import { sqlClient } from "@/lib/db/client";

export const runtime = "nodejs";

const deliveryStatuses: Record<string, string> = {
  "email.sent": "SENT",
  "email.delivered": "DELIVERED",
  "email.delivery_delayed": "DELAYED",
  "email.bounced": "BOUNCED",
  "email.complained": "COMPLAINED",
  "email.failed": "FAILED",
  "email.suppressed": "SUPPRESSED",
};

export async function POST(request: Request) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const id = request.headers.get("svix-id") ?? request.headers.get("webhook-id") ?? "";
  const timestamp = request.headers.get("svix-timestamp") ?? request.headers.get("webhook-timestamp") ?? "";
  const signature = request.headers.get("svix-signature") ?? request.headers.get("webhook-signature") ?? "";
  if (!secret) return NextResponse.json({ error: "Webhook deaktivert." }, { status: 503 });

  let event: ReturnType<Resend["webhooks"]["verify"]>;
  try {
    const payload = await request.text();
    event = new Resend(process.env.RESEND_API_KEY).webhooks.verify({ payload, headers: { id, timestamp, signature }, webhookSecret: secret });
  } catch {
    return NextResponse.json({ error: "Ugyldig webhook." }, { status: 400 });
  }

  const status = deliveryStatuses[event.type];
  if (!status || !("email_id" in event.data)) return NextResponse.json({ received: true, ignored: true });
  const providerMessageId = event.data.email_id;
  const failure = event.type === "email.bounced"
    ? event.data.bounce.message
    : event.type === "email.failed"
      ? event.data.failed.reason
      : event.type === "email.suppressed"
        ? event.data.suppressed.message
        : event.type === "email.complained"
          ? "Mottakeren rapporterte meldingen som spam."
          : null;
  try {
    await sqlClient.begin(async (tx) => {
      const inserted = await tx`INSERT INTO email_delivery_events (event_id, provider_message_id, event_type, payload_created_at) VALUES (${id}, ${providerMessageId}, ${event.type}, ${new Date(event.created_at)}) ON CONFLICT DO NOTHING RETURNING event_id`;
      if (!inserted.length) return;
      await tx`UPDATE invoice_deliveries SET status=${status}, error_message=${failure}, sent_at=COALESCE(sent_at, ${new Date(event.created_at)}) WHERE provider_message_id=${providerMessageId}`;
    });
    return NextResponse.json({ received: true });
  } catch {
    return NextResponse.json({ error: "Kunne ikke lagre leveringsstatus." }, { status: 503 });
  }
}
