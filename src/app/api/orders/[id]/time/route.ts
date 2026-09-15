import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { orders, timeEntries } from "@/lib/db/schema";

async function ownedOrder(id: string, organizationId: string) {
  const [order] = await db.select({ id: orders.id, status: orders.status }).from(orders).where(and(eq(orders.id, id), eq(orders.organizationId, organizationId))).limit(1);
  return order;
}

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(); const { id } = await context.params; if (!(await ownedOrder(id, user.organizationId))) return NextResponse.json({ error: "Ordren finnes ikke." }, { status: 404 }); const entries = await db.select().from(timeEntries).where(and(eq(timeEntries.orderId, id), eq(timeEntries.organizationId, user.organizationId))).orderBy(asc(timeEntries.workDate), asc(timeEntries.createdAt)); return NextResponse.json({ entries }); }
  catch { return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 }); }
}

const inputSchema = z.object({ workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), hours: z.coerce.number().positive().max(24), rateOre: z.coerce.number().int().min(0), description: z.string().trim().max(1000) });

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(); const { id } = await context.params; const order = await ownedOrder(id, user.organizationId); if (!order) return NextResponse.json({ error: "Ordren finnes ikke." }, { status: 404 }); if (["INVOICED", "CLOSED", "CANCELLED"].includes(order.status)) return NextResponse.json({ error: "Ordren er låst og kan ikke få nye timer." }, { status: 409 }); const parsed = inputSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Kontroller dato, timer og sats." }, { status: 400 }); const [entry] = await db.insert(timeEntries).values({ organizationId: user.organizationId, orderId: id, userId: user.id, workDate: new Date(`${parsed.data.workDate}T12:00:00.000Z`), minutes: Math.round(parsed.data.hours * 60), ratePerHourOre: parsed.data.rateOre, description: parsed.data.description || null }).returning(); return NextResponse.json({ entry }, { status: 201 }); }
  catch { return NextResponse.json({ error: "Kunne ikke lagre timene." }, { status: 401 }); }
}
