import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers, invoiceLines, invoices, orderEntries, orders, organizations, timeEntries } from "@/lib/db/schema";
import { drivingInvoiceAmounts } from "@/lib/invoice-summary";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await context.params;
    const [order] = await db.select().from(orders).where(and(eq(orders.id, id), eq(orders.organizationId, user.organizationId))).limit(1);
    if (!order) return NextResponse.json({ error: "Ordren finnes ikke." }, { status: 404 });
    const [existingInvoice] = await db.select().from(invoices).where(and(eq(invoices.organizationId, user.organizationId), eq(invoices.sourceOrderId, id))).limit(1);
    if (existingInvoice && existingInvoice.status !== "DRAFT") return NextResponse.json({ error: `Ordren er allerede fakturert på faktura #${existingInvoice.invoiceNumber}.`, invoiceId: existingInvoice.id }, { status: 409 });
    const [[customer], [organization], timeRows, entryRows] = await Promise.all([
      db.select().from(customers).where(and(eq(customers.id, order.customerId), eq(customers.organizationId, user.organizationId))).limit(1),
      db.select().from(organizations).where(eq(organizations.id, user.organizationId)).limit(1),
      db.select().from(timeEntries).where(and(eq(timeEntries.orderId, id), eq(timeEntries.organizationId, user.organizationId))),
      db.select().from(orderEntries).where(and(eq(orderEntries.orderId, id), eq(orderEntries.organizationId, user.organizationId))),
    ]);
    if (!customer || !organization) return NextResponse.json({ error: "Kunde- eller firmainformasjon mangler." }, { status: 400 });
    const vatRate = organization.vatRegistered ? organization.defaultVatBasisPoints : 0;
    const sources = [
      ...timeRows.map((row) => ({ sourceType: "TIME", sourceId: row.id, lineType: "TIME", description: row.description || `Arbeid ${row.workDate.toLocaleDateString("nb-NO")}`, quantityThousandths: Math.round(row.minutes / 60 * 1000), unit: "timer", unitPriceOre: row.ratePerHourOre, subtotalOre: Math.round(row.minutes / 60 * row.ratePerHourOre) })),
      ...entryRows.filter((row) => !["IMAGE", "DOCUMENT"].includes(row.kind)).map((row) => ({ sourceType: row.kind, sourceId: row.id, lineType: row.kind, description: row.title + (row.description ? ` – ${row.description}` : ""), quantityThousandths: row.quantityThousandths ?? 1000, unit: row.unit ?? "stk", unitPriceOre: row.unitRateOre ?? row.amountOre, subtotalOre: row.amountOre })),
    ];
    if (!sources.length) return NextResponse.json({ error: "Registrer minst én fakturerbar post først." }, { status: 400 });
    const prepared = sources.map((line, index) => {
      const source = entryRows.find((row) => row.id === line.sourceId);
      const metadata = source?.metadata as Record<string, unknown> | null;
      const vatAmountOre = Math.round(line.subtotalOre * vatRate / 10000);
      const amounts = line.lineType === "DRIVING" && metadata?.tollInputGross === true
        ? drivingInvoiceAmounts(line.subtotalOre, Number(metadata.tollOre ?? 0), vatRate)
        : { subtotalOre: line.subtotalOre, vatAmountOre, totalOre: line.subtotalOre + vatAmountOre };
      return { ...line, ...amounts, organizationId: user.organizationId, vatBasisPoints: vatRate, sortOrder: index };
    });
    const subtotalOre = prepared.reduce((sum, line) => sum + line.subtotalOre, 0); const vatAmountOre = prepared.reduce((sum, line) => sum + line.vatAmountOre, 0); const totalOre = subtotalOre + vatAmountOre;
    const invoice = await db.transaction(async (tx) => {
      let draft = existingInvoice;
      if (draft) {
        const [current] = await tx.select().from(invoices).where(and(eq(invoices.id, draft.id), eq(invoices.organizationId, user.organizationId))).for("update");
        if (!current || current.status !== "DRAFT") throw new Error("INVOICE_NO_LONGER_DRAFT");
        draft = current;
      }
      const issueDate = new Date(); const dueDate = new Date(issueDate); dueDate.setDate(dueDate.getDate() + organization.defaultPaymentTermsDays);
      if (!draft) [draft] = await tx.insert(invoices).values({ organizationId: user.organizationId, sourceOrderId: id, customerId: customer.id, status: "DRAFT", issueDate, dueDate, subtotalOre, vatAmountOre, totalOre, remainingAmountOre: totalOre, organizationSnapshot: organization, customerSnapshot: customer, bankAccountSnapshot: organization.bankAccount, idempotencyKey: randomUUID() }).returning();
      else await tx.update(invoices).set({ issueDate, dueDate, subtotalOre, vatAmountOre, totalOre, remainingAmountOre: totalOre, organizationSnapshot: organization, customerSnapshot: customer, bankAccountSnapshot: organization.bankAccount, updatedAt: new Date() }).where(eq(invoices.id, draft.id));
      await tx.delete(invoiceLines).where(eq(invoiceLines.invoiceId, draft.id));
      await tx.insert(invoiceLines).values(prepared.map((line) => ({ ...line, invoiceId: draft.id })));
      return { ...draft, issueDate, dueDate, subtotalOre, vatAmountOre, totalOre };
    });
    return NextResponse.json({ invoice });
  } catch (error) { console.error(error); return NextResponse.json({ error: "Kunne ikke lage fakturautkastet." }, { status: 500 }); }
}
