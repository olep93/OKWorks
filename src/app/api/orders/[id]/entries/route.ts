import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { orderEntries, orders } from "@/lib/db/schema";

const kinds = ["LINE", "DRIVING", "EXPENSE", "HOTEL", "IMAGE", "DOCUMENT"] as const;
const inputSchema = z.object({ kind: z.enum(kinds), workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), title: z.string().trim().min(1).max(240), description: z.string().trim().max(1000).optional(), quantity: z.coerce.number().min(0).optional(), unit: z.string().trim().max(30).optional(), unitRateOre: z.coerce.number().int().min(0).optional(), costOre: z.coerce.number().int().min(0).optional(), markupBasisPoints: z.coerce.number().int().min(0).optional(), fileName: z.string().trim().max(300).optional(), metadata: z.record(z.string(), z.unknown()).optional() });

async function ownsOrder(id: string, organizationId: string) { const [order] = await db.select({ id: orders.id }).from(orders).where(and(eq(orders.id, id), eq(orders.organizationId, organizationId))).limit(1); return Boolean(order); }

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(); const { id } = await context.params; if (!(await ownsOrder(id, user.organizationId))) return NextResponse.json({ error: "Ordren finnes ikke." }, { status: 404 }); const entries = await db.select().from(orderEntries).where(and(eq(orderEntries.orderId, id), eq(orderEntries.organizationId, user.organizationId))).orderBy(asc(orderEntries.workDate), asc(orderEntries.createdAt)); return NextResponse.json({ entries }); }
  catch { return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 }); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await context.params; if (!(await ownsOrder(id, user.organizationId))) return NextResponse.json({ error: "Ordren finnes ikke." }, { status: 404 });
    const parsed = inputSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Kontroller informasjonen." }, { status: 400 }); const value = parsed.data;
    const quantityThousandths = value.quantity == null ? null : Math.round(value.quantity * 1000);
    const baseOre = value.costOre ?? Math.round((value.quantity ?? 0) * (value.unitRateOre ?? 0));
    const amountOre = Math.round(baseOre * (1 + (value.markupBasisPoints ?? 0) / 10000));
    const [entry] = await db.insert(orderEntries).values({ organizationId: user.organizationId, orderId: id, createdBy: user.id, kind: value.kind, workDate: new Date(`${value.workDate}T12:00:00.000Z`), title: value.title, description: value.description || null, quantityThousandths, unit: value.unit || null, unitRateOre: value.unitRateOre ?? null, amountOre, fileName: value.fileName || null, metadata: value.metadata ?? null, billingStatus: value.kind === "IMAGE" || value.kind === "DOCUMENT" ? "NON_BILLABLE" : "UNBILLED" }).returning();
    return NextResponse.json({ entry }, { status: 201 });
  } catch { return NextResponse.json({ error: "Kunne ikke lagre registreringen." }, { status: 401 }); }
}
