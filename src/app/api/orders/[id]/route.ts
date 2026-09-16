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
    const [order] = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(eq(orders.id, id), eq(orders.organizationId, user.organizationId)),
      )
      .limit(1);
    if (!order)
      return NextResponse.json(
        { error: "Ordren finnes ikke." },
        { status: 404 },
      );

    const [invoice] = await db
      .select({ id: invoices.id })
      .from(invoices)
      .where(
        and(
          eq(invoices.sourceOrderId, id),
          eq(invoices.organizationId, user.organizationId),
        ),
      )
      .limit(1);
    if (invoice)
      return NextResponse.json(
        {
          error:
            "Ordren har et fakturautkast eller en faktura og kan derfor ikke slettes.",
        },
        { status: 409 },
      );

    await db
      .delete(orders)
      .where(
        and(eq(orders.id, id), eq(orders.organizationId, user.organizationId)),
      );
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Kunne ikke slette ordren." },
      { status: 401 },
    );
  }
}
