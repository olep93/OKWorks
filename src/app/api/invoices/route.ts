import { count, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers, invoices, orders } from "@/lib/db/schema";

export async function GET(request: Request) {
  try {
    const user = await requireUser();
    const url = new URL(request.url);
    const limitParam = url.searchParams.get("limit");
    const offsetParam = url.searchParams.get("offset");
    const requestedLimit = limitParam === null ? Number.NaN : Number(limitParam);
    const requestedOffset = offsetParam === null ? Number.NaN : Number(offsetParam);
    const limit = Number.isFinite(requestedLimit)
      ? Math.min(100, Math.max(1, Math.trunc(requestedLimit)))
      : 50;
    const offset = Number.isFinite(requestedOffset)
      ? Math.max(0, Math.trunc(requestedOffset))
      : 0;
    const [rows, totals] = await Promise.all([
      db.select({ id: invoices.id, invoiceNumber: invoices.invoiceNumber, status: invoices.status, totalOre: invoices.totalOre, issueDate: invoices.issueDate, dueDate: invoices.dueDate, finalizedAt: invoices.finalizedAt, sentAt: invoices.sentAt, paidAt: invoices.paidAt, customerName: customers.name, orderNumber: orders.orderNumber, orderTitle: orders.title }).from(invoices).innerJoin(customers, eq(invoices.customerId, customers.id)).innerJoin(orders, eq(invoices.sourceOrderId, orders.id)).where(eq(invoices.organizationId, user.organizationId)).orderBy(desc(invoices.createdAt)).limit(limit).offset(offset),
      db.select({ count: count() }).from(invoices).where(eq(invoices.organizationId, user.organizationId)),
    ]);
    return NextResponse.json({ invoices: rows, total: totals[0]?.count ?? 0, limit, offset });
  }
  catch { return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 }); }
}
