import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { orderEntries, orders } from "@/lib/db/schema";

const kinds = ["LINE", "DRIVING", "EXPENSE", "HOTEL", "IMAGE", "DOCUMENT"] as const;
const inputSchema = z.object({ kind: z.enum(kinds), workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), title: z.string().trim().min(1).max(240), description: z.string().trim().max(1000).optional(), quantity: z.coerce.number().min(0).optional(), unit: z.string().trim().max(30).optional(), unitRateOre: z.coerce.number().int().min(0).optional(), costOre: z.coerce.number().int().min(0).optional(), tollOre: z.coerce.number().int().min(0).optional(), markupBasisPoints: z.coerce.number().int().min(0).optional(), fileName: z.string().trim().max(300).optional(), metadata: z.record(z.string(), z.unknown()).optional() });

async function ownedOrder(id: string, organizationId: string) { const [order] = await db.select({ id: orders.id, status: orders.status }).from(orders).where(and(eq(orders.id, id), eq(orders.organizationId, organizationId))).limit(1); return order; }

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(); const { id } = await context.params; if (!(await ownedOrder(id, user.organizationId))) return NextResponse.json({ error: "Ordren finnes ikke." }, { status: 404 }); const entries = await db.select({ id: orderEntries.id, kind: orderEntries.kind, workDate: orderEntries.workDate, title: orderEntries.title, description: orderEntries.description, quantityThousandths: orderEntries.quantityThousandths, unit: orderEntries.unit, unitRateOre: orderEntries.unitRateOre, amountOre: orderEntries.amountOre, fileName: orderEntries.fileName, mimeType: orderEntries.mimeType, fileSize: orderEntries.fileSize }).from(orderEntries).where(and(eq(orderEntries.orderId, id), eq(orderEntries.organizationId, user.organizationId))).orderBy(asc(orderEntries.workDate), asc(orderEntries.createdAt)); return NextResponse.json({ entries }); }
  catch { return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 }); }
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await context.params; const order = await ownedOrder(id, user.organizationId); if (!order) return NextResponse.json({ error: "Ordren finnes ikke." }, { status: 404 }); if (["INVOICED", "CLOSED", "CANCELLED"].includes(order.status)) return NextResponse.json({ error: "Ordren er låst og kan ikke få nye registreringer." }, { status: 409 });
    const multipart = request.headers.get("content-type")?.includes("multipart/form-data");
    const form = multipart ? await request.formData() : null;
    const raw = form ? Object.fromEntries(Array.from(form.entries()).filter(([key]) => key !== "file")) : await request.json();
    const parsed = inputSchema.safeParse(raw); if (!parsed.success) return NextResponse.json({ error: "Kontroller informasjonen." }, { status: 400 }); const value = parsed.data;
    const file = form?.get("file");
    let fileData: Uint8Array | null = null; let mimeType: string | null = null; let fileSize: number | null = null; let fileName = value.fileName || null;
    if (value.kind === "IMAGE" || value.kind === "DOCUMENT") {
      if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Velg en fil som skal lastes opp." }, { status: 400 });
      if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Filen er for stor. Maksimal størrelse er 4 MB." }, { status: 413 });
      const allowed = value.kind === "IMAGE" ? ["image/jpeg", "image/png"] : ["application/pdf", "image/jpeg", "image/png"];
      if (!allowed.includes(file.type)) return NextResponse.json({ error: value.kind === "IMAGE" ? "Bruk JPG- eller PNG-bilde." : "Bruk PDF, JPG eller PNG." }, { status: 415 });
      fileData = new Uint8Array(await file.arrayBuffer()); mimeType = file.type; fileSize = file.size; fileName = file.name;
    }
    const quantityThousandths = value.quantity == null ? null : Math.round(value.quantity * 1000);
    const baseOre = value.costOre ?? Math.round((value.quantity ?? 0) * (value.unitRateOre ?? 0));
    const amountOre = Math.round(baseOre * (1 + (value.markupBasisPoints ?? 0) / 10000)) + (value.tollOre ?? 0);
    const [entry] = await db.insert(orderEntries).values({ organizationId: user.organizationId, orderId: id, createdBy: user.id, kind: value.kind, workDate: new Date(`${value.workDate}T12:00:00.000Z`), title: value.title, description: value.description || null, quantityThousandths, unit: value.unit || null, unitRateOre: value.unitRateOre ?? null, amountOre, fileName, mimeType, fileSize, fileData, metadata: value.metadata ?? null, billingStatus: value.kind === "IMAGE" || value.kind === "DOCUMENT" ? "NON_BILLABLE" : "UNBILLED" }).returning({ id: orderEntries.id, kind: orderEntries.kind, title: orderEntries.title, fileName: orderEntries.fileName, mimeType: orderEntries.mimeType, fileSize: orderEntries.fileSize });
    return NextResponse.json({ entry }, { status: 201 });
  } catch { return NextResponse.json({ error: "Kunne ikke lagre registreringen." }, { status: 401 }); }
}
