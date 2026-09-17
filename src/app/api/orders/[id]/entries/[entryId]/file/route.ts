import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { orderEntries, orders } from "@/lib/db/schema";

export async function GET(_request: Request, context: { params: Promise<{ id: string; entryId: string }> }) {
  try {
    const user = await requireUser();
    const { id, entryId } = await context.params;
    const [entry] = await db.select({ fileData: orderEntries.fileData, mimeType: orderEntries.mimeType }).from(orderEntries).innerJoin(orders, eq(orders.id, orderEntries.orderId)).where(and(eq(orderEntries.id, entryId), eq(orderEntries.orderId, id), eq(orderEntries.organizationId, user.organizationId), eq(orders.organizationId, user.organizationId))).limit(1);
    if (!entry?.fileData) return NextResponse.json({ error: "Filen finnes ikke." }, { status: 404 });
    if (!["image/png", "image/jpeg", "application/pdf"].includes(entry.mimeType ?? "")) return NextResponse.json({ error: "Filtypen kan ikke forhåndsvises." }, { status: 415 });
    return new NextResponse(Buffer.from(entry.fileData), { headers: { "content-type": entry.mimeType!, "content-disposition": "inline", "cache-control": "private, no-store", "x-content-type-options": "nosniff" } });
  } catch (error) {
    return NextResponse.json({ error: "Kunne ikke hente filen." }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
