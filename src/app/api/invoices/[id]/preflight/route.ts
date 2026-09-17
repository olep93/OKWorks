import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { invoiceLines, invoices, orderEntries } from "@/lib/db/schema";
import { checkInvoicePreflight } from "@/lib/invoice-preflight";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.organizationId, user.organizationId))).limit(1);
    if (!invoice) return NextResponse.json({ error: "Fakturaen finnes ikke." }, { status: 404 });
    const [[lineResult], [documentResult], [tollResult]] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(invoiceLines).where(and(eq(invoiceLines.invoiceId, id), eq(invoiceLines.organizationId, user.organizationId))),
      db.select({ count: sql<number>`count(*) filter (where file_data is not null)::int` }).from(orderEntries).where(and(eq(orderEntries.orderId, invoice.sourceOrderId), eq(orderEntries.organizationId, user.organizationId), inArray(orderEntries.kind, ["IMAGE", "DOCUMENT"]))),
      db.select({ count: sql<number>`count(*)::int` }).from(orderEntries).where(and(eq(orderEntries.orderId, invoice.sourceOrderId), eq(orderEntries.organizationId, user.organizationId), eq(orderEntries.kind, "DRIVING"), sql`${orderEntries.metadata}->>'tollKnown' = 'false'`)),
    ]);
    return NextResponse.json(checkInvoicePreflight({ status: invoice.status, totalOre: invoice.totalOre, organization: invoice.organizationSnapshot as Record<string, unknown>, customer: invoice.customerSnapshot as Record<string, unknown>, lineCount: lineResult?.count ?? 0, documentationCount: documentResult?.count ?? 0, unresolvedTollCount: tollResult?.count ?? 0 }));
  } catch {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
}
