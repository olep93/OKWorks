import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { invoices, orders } from "@/lib/db/schema";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const result = await db.transaction(async (tx) => {
    // Lock existing invoices before the order, matching finalization's lock order.
    await tx.select({ id: invoices.id }).from(invoices).where(and(eq(invoices.sourceOrderId, id), eq(invoices.organizationId, user.organizationId))).for("update");
    const [order] = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(eq(orders.id, id), eq(orders.organizationId, user.organizationId)),
      )
      .limit(1).for("update");
    if (!order)
      return NextResponse.json(
        { error: "Ordren finnes ikke." },
        { status: 404 },
      );

    const invoiceRows = await tx
      .select({ id: invoices.id, status: invoices.status, invoiceNumber: invoices.invoiceNumber, finalizedAt: invoices.finalizedAt })
      .from(invoices)
      .where(
        and(
          eq(invoices.sourceOrderId, id),
          eq(invoices.organizationId, user.organizationId),
        ),
      )
      .for("update");
    if (invoiceRows.some((invoice) => invoice.status !== "DRAFT" || invoice.invoiceNumber !== null || invoice.finalizedAt !== null))
      return NextResponse.json(
        {
          error:
            "Ordren har en finalisert faktura og kan derfor ikke slettes.",
        },
        { status: 409 },
      );

    await tx.delete(invoices).where(and(eq(invoices.sourceOrderId, id), eq(invoices.organizationId, user.organizationId), eq(invoices.status, "DRAFT")));
    await tx
      .delete(orders)
      .where(
        and(eq(orders.id, id), eq(orders.organizationId, user.organizationId)),
      );
    return NextResponse.json({ ok: true });
    });
    return result;
  } catch {
    return NextResponse.json(
      { error: "Kunne ikke slette ordren." },
      { status: 500 },
    );
  }
}
