import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers, orders } from "@/lib/db/schema";

export async function GET() {
  try {
    const user = await requireUser();
    const [customerRows, orderRows] = await Promise.all([
      db.select().from(customers).where(eq(customers.organizationId, user.organizationId)).orderBy(desc(customers.createdAt)),
      db.select({
        id: orders.id,
        orderNumber: orders.orderNumber,
        title: orders.title,
        status: orders.status,
        workAddress: orders.workAddress,
        customerId: orders.customerId,
        updatedAt: orders.updatedAt,
      }).from(orders).where(eq(orders.organizationId, user.organizationId)).orderBy(desc(orders.createdAt)),
    ]);
    return NextResponse.json({ customers: customerRows, orders: orderRows });
  } catch {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
}
