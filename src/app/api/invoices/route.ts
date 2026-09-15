import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers, invoices, orders } from "@/lib/db/schema";

export async function GET() {
  try { const user = await requireUser(); const rows = await db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, status: invoices.status, totalOre: invoices.totalOre, issueDate: invoices.issueDate, dueDate: invoices.dueDate, customerName: customers.name, orderNumber: orders.orderNumber, orderTitle: orders.title }).from(invoices).innerJoin(customers, eq(invoices.customerId, customers.id)).innerJoin(orders, eq(invoices.sourceOrderId, orders.id)).where(eq(invoices.organizationId, user.organizationId)).orderBy(desc(invoices.createdAt)); return NextResponse.json({ invoices: rows }); }
  catch { return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 }); }
}
