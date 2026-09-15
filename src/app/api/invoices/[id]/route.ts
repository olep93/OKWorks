import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { invoiceLines, invoices } from "@/lib/db/schema";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(); const { id } = await context.params; const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id, id), eq(invoices.organizationId, user.organizationId))).limit(1); if (!invoice) return NextResponse.json({ error: "Fakturaen finnes ikke." }, { status: 404 }); const lines = await db.select().from(invoiceLines).where(and(eq(invoiceLines.invoiceId, id), eq(invoiceLines.organizationId, user.organizationId))).orderBy(asc(invoiceLines.sortOrder)); return NextResponse.json({ invoice, lines }); }
  catch { return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 }); }
}
