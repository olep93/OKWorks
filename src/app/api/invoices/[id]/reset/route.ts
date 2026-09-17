import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { invoices, orders } from "@/lib/db/schema";
import { canResetInvoiceDraft } from "@/lib/invoice-draft";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const result = await db.transaction(async (tx) => {
      // Lock the invoice first, matching finalization, so reset cannot race it.
      const [invoice] = await tx.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.organizationId, user.organizationId))).for("update");
      if (!invoice) return { status: 404, body: { error: "Fakturautkastet finnes ikke." } };
      if (!canResetInvoiceDraft(invoice)) return { status: 409, body: { error: "Kun fakturautkast uten fakturanummer kan tilbakestilles. Finaliserte fakturaer beholdes." } };
      const [order] = await tx.select().from(orders).where(and(eq(orders.id, invoice.sourceOrderId), eq(orders.organizationId, user.organizationId))).for("update");
      if (!order) return { status: 404, body: { error: "Ordren finnes ikke." } };
      if (["INVOICED", "CLOSED", "CANCELLED"].includes(order.status)) return { status: 409, body: { error: "Denne ordren er låst og kan ikke tilbakestilles." } };
      // Only the draft and its cascading invoice lines are removed. Source registrations remain unchanged.
      await tx.delete(invoices).where(and(eq(invoices.id, id), eq(invoices.organizationId, user.organizationId)));
      return { status: 200, body: { orderId: order.id } };
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return NextResponse.json({ error: "Kunne ikke tilbakestille fakturautkastet." }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
