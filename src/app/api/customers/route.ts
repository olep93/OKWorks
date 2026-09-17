import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers, invoices } from "@/lib/db/schema";

const inputSchema = z.object({
  name: z.string().trim().min(2),
  organizationNumber: z.string().trim().max(20).optional(),
  email: z.union([z.email(), z.literal("")]).optional(),
  phone: z.string().trim().max(40).optional(),
  address: z.string().trim().max(500).optional(),
  postalCode: z.string().trim().max(16).optional(),
  city: z.string().trim().max(120).optional(),
});

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const parsed = inputSchema.extend({ id: z.uuid() }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Kontroller kundeinformasjonen." }, { status: 400 });
    const { id, ...value } = parsed.data;
    const customer = await db.transaction(async (tx) => {
      const [updated] = await tx.update(customers).set({
        name: value.name,
        organizationNumber: value.organizationNumber || null,
        email: value.email || null,
        phone: value.phone || null,
        address: value.address || null,
        postalCode: value.postalCode || null,
        city: value.city || null,
        updatedAt: new Date(),
      }).where(and(eq(customers.id, id), eq(customers.organizationId, user.organizationId))).returning();
      if (updated) await tx.update(invoices).set({ customerSnapshot: updated, updatedAt: new Date() }).where(and(eq(invoices.customerId, id), eq(invoices.organizationId, user.organizationId), eq(invoices.status, "DRAFT")));
      return updated;
    });
    if (!customer) return NextResponse.json({ error: "Kunden finnes ikke." }, { status: 404 });
    return NextResponse.json({ customer });
  } catch (error) {
    return NextResponse.json({ error: "Kunne ikke oppdatere kunden." }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = inputSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Kontroller kundeinformasjonen." }, { status: 400 });
    const [customer] = await db.insert(customers).values({
      organizationId: user.organizationId,
      name: parsed.data.name,
      organizationNumber: parsed.data.organizationNumber || null,
      email: parsed.data.email || null,
      phone: parsed.data.phone || null,
      address: parsed.data.address || null,
      postalCode: parsed.data.postalCode || null,
      city: parsed.data.city || null,
    }).returning();
    return NextResponse.json({ customer }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Kunne ikke opprette kunden." }, { status: 401 });
  }
}
