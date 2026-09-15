import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db, sqlClient } from "@/lib/db/client";
import { invoiceLines, invoices, orderEntries } from "@/lib/db/schema";
import { buildInvoicePdf } from "@/lib/invoice-pdf";

export const runtime = "nodejs";
const input = z.object({
  recipient: z.email(),
  subject: z.string().trim().min(3).max(300),
  message: z.string().trim().min(3).max(5000),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const parsed = input.safeParse(await request.json());
    if (!parsed.success)
      return NextResponse.json(
        { error: "Kontroller mottaker, emne og melding." },
        { status: 400 },
      );
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(
        and(
          eq(invoices.id, id),
          eq(invoices.organizationId, user.organizationId),
        ),
      )
      .limit(1);
    if (!invoice)
      return NextResponse.json(
        { error: "Fakturaen finnes ikke." },
        { status: 404 },
      );
    if (invoice.status === "DRAFT")
      return NextResponse.json(
        { error: "Fakturaen må finaliseres før sending." },
        { status: 409 },
      );
    if (["PAID", "VOID", "CREDITED"].includes(invoice.status))
      return NextResponse.json(
        { error: "Fakturaen kan ikke sendes i denne statusen." },
        { status: 409 },
      );
    const apiKey = process.env.RESEND_API_KEY;
    const from =
      process.env.INVOICE_FROM_EMAIL ?? "OK Works Test <onboarding@resend.dev>";
    if (!apiKey)
      return NextResponse.json(
        {
          error: "Testutsending er ikke aktivert ennå.",
          needsConfiguration: true,
        },
        { status: 503 },
      );
    const [lines, attachmentRows] = await Promise.all([
      db
        .select()
        .from(invoiceLines)
        .where(
          and(
            eq(invoiceLines.invoiceId, id),
            eq(invoiceLines.organizationId, user.organizationId),
          ),
        )
        .orderBy(asc(invoiceLines.sortOrder)),
      db
        .select({
          title: orderEntries.title,
          description: orderEntries.description,
          workDate: orderEntries.workDate,
          fileName: orderEntries.fileName,
          mimeType: orderEntries.mimeType,
          fileData: orderEntries.fileData,
        })
        .from(orderEntries)
        .where(
          and(
            eq(orderEntries.orderId, invoice.sourceOrderId),
            eq(orderEntries.organizationId, user.organizationId),
          ),
        )
        .orderBy(asc(orderEntries.workDate), asc(orderEntries.createdAt)),
    ]);
    const attachments = attachmentRows.filter(
      (row): row is typeof row & { fileData: Uint8Array } =>
        Boolean(row.fileData),
    );
    const pdf = await buildInvoicePdf(invoice, lines, attachments);
    const delivery =
      await sqlClient`INSERT INTO invoice_deliveries (organization_id, invoice_id, recipient, subject, message, sent_by) VALUES (${user.organizationId}, ${id}, ${parsed.data.recipient}, ${parsed.data.subject}, ${parsed.data.message}, ${user.id}) RETURNING id`;
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
        "Idempotency-Key": `invoice-${id}-delivery-${delivery[0].id}`,
      },
      body: JSON.stringify({
        from,
        to: [parsed.data.recipient],
        subject: parsed.data.subject,
        text: parsed.data.message,
        attachments: [
          {
            filename: `faktura-${invoice.invoiceNumber}.pdf`,
            content: Buffer.from(pdf).toString("base64"),
          },
        ],
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      await sqlClient`UPDATE invoice_deliveries SET status='FAILED', error_message=${String(result.message ?? "Resend avviste utsendingen.")} WHERE id=${delivery[0].id}`;
      return NextResponse.json(
        { error: String(result.message ?? "Kunne ikke sende fakturaen.") },
        { status: 502 },
      );
    }
    await sqlClient.begin(async (tx) => {
      await tx`UPDATE invoice_deliveries SET status='SENT', provider_message_id=${String(result.id)}, sent_at=now() WHERE id=${delivery[0].id}`;
      await tx`UPDATE invoices SET status='SENT', sent_at=now(), updated_at=now() WHERE id=${id}`;
      await tx`UPDATE orders SET status='INVOICED', updated_at=now() WHERE id=${invoice.sourceOrderId} AND organization_id=${user.organizationId}`;
    });
    return NextResponse.json({ ok: true, sentAt: new Date().toISOString() });
  } catch {
    return NextResponse.json(
      { error: "Kunne ikke sende fakturaen." },
      { status: 500 },
    );
  }
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const deliveries =
      await sqlClient`SELECT id, recipient, subject, status, error_message, sent_at, created_at FROM invoice_deliveries WHERE invoice_id=${id} AND organization_id=${user.organizationId} ORDER BY created_at DESC`;
    return NextResponse.json({
      deliveries,
      configured: Boolean(process.env.RESEND_API_KEY),
      from:
        process.env.INVOICE_FROM_EMAIL ??
        "OK Works Test <onboarding@resend.dev>",
    });
  } catch {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
}
