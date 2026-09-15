import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { invoiceLines, invoices, orderEntries } from "@/lib/db/schema";
import { buildInvoicePdf } from "@/lib/invoice-pdf";

export const runtime = "nodejs";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await context.params;
    const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.organizationId, user.organizationId))).limit(1);
    if (!invoice) return NextResponse.json({ error: "Fakturaen finnes ikke." }, { status: 404 });
    const [lines, attachmentRows] = await Promise.all([
      db.select().from(invoiceLines).where(and(eq(invoiceLines.invoiceId, id), eq(invoiceLines.organizationId, user.organizationId))).orderBy(asc(invoiceLines.sortOrder)),
      db.select({ title: orderEntries.title, description: orderEntries.description, workDate: orderEntries.workDate, fileName: orderEntries.fileName, mimeType: orderEntries.mimeType, fileData: orderEntries.fileData }).from(orderEntries).where(and(eq(orderEntries.orderId, invoice.sourceOrderId), eq(orderEntries.organizationId, user.organizationId))).orderBy(asc(orderEntries.workDate), asc(orderEntries.createdAt)),
    ]);
    const attachments = attachmentRows.filter((row): row is typeof row & { fileData: Uint8Array } => Boolean(row.fileData));
    const bytes = await buildInvoicePdf(invoice, lines, attachments);
    const filename = invoice.invoiceNumber ? `faktura-${invoice.invoiceNumber}.pdf` : "fakturautkast.pdf";
    return new NextResponse(Buffer.from(bytes), { headers: { "content-type": "application/pdf", "content-disposition": `attachment; filename="${filename}"`, "cache-control": "private, no-store" } });
  } catch (error) {
    console.error(error); return NextResponse.json({ error: "Kunne ikke lage PDF-en." }, { status: 500 });
  }
}
