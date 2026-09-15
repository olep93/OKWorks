import { and, eq, max } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers, orders } from "@/lib/db/schema";

const inputSchema = z.object({ customerId: z.uuid(), title: z.string().trim().min(3), description: z.string().trim().optional(), workAddress: z.string().trim().optional() });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Kontroller ordreinformasjonen." }, { status: 400 });
    const [customer] = await db.select({ id: customers.id }).from(customers).where(and(eq(customers.id, parsed.data.customerId), eq(customers.organizationId, user.organizationId))).limit(1);
    if (!customer) return NextResponse.json({ error: "Kunden finnes ikke." }, { status: 404 });
    const [sequence] = await db.select({ current: max(orders.orderNumber) }).from(orders).where(eq(orders.organizationId, user.organizationId));
    const orderNumber = Math.max(1001, (sequence?.current ?? 1000) + 1);
    const [order] = await db.insert(orders).values({
      organizationId: user.organizationId,
      customerId: customer.id,
      orderNumber,
      title: parsed.data.title,
      description: parsed.data.description || null,
      workAddress: parsed.data.workAddress || null,
      assignedUserId: user.id,
      status: "OPEN",
    }).returning();
    return NextResponse.json({ order }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Kunne ikke opprette ordren." }, { status: 401 });
  }
}
