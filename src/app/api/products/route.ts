import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { products } from "@/lib/db/schema";

const productSchema = z.object({ name: z.string().trim().min(2), unit: z.string().trim().min(1).max(30), priceOre: z.coerce.number().int().min(0), vatBasisPoints: z.coerce.number().int().min(0).max(10000), category: z.string().trim().max(80) });

export async function POST(request: Request) {
  try { const user = await requireUser(); const parsed = productSchema.safeParse(await request.json()); if (!parsed.success) return NextResponse.json({ error: "Kontroller vare- eller tjenesteinformasjonen." }, { status: 400 }); const [product] = await db.insert(products).values({ organizationId: user.organizationId, name: parsed.data.name, unit: parsed.data.unit, defaultPriceOre: parsed.data.priceOre, vatBasisPoints: parsed.data.vatBasisPoints, category: parsed.data.category || null }).returning(); return NextResponse.json({ product }, { status: 201 }); }
  catch { return NextResponse.json({ error: "Kunne ikke lagre varen eller tjenesten." }, { status: 401 }); }
}

export async function DELETE(request: Request) {
  try { const user = await requireUser(); const id = new URL(request.url).searchParams.get("id"); if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Mangler gyldig produkt-ID." }, { status: 400 }); const rows = await db.update(products).set({ active: false, updatedAt: new Date() }).where(and(eq(products.id, id!), eq(products.organizationId, user.organizationId))).returning({ id: products.id }); if (!rows.length) return NextResponse.json({ error: "Varen finnes ikke." }, { status: 404 }); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: "Kunne ikke slette." }, { status: 401 }); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser();
    const parsed = productSchema.extend({ id: z.uuid() }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Kontroller vare- eller tjenesteinformasjonen." }, { status: 400 });
    const value = parsed.data;
    const [product] = await db.update(products).set({ name: value.name, unit: value.unit, defaultPriceOre: value.priceOre, vatBasisPoints: value.vatBasisPoints, category: value.category || null, updatedAt: new Date() }).where(and(eq(products.id, value.id), eq(products.organizationId, user.organizationId), eq(products.active, true))).returning();
    if (!product) return NextResponse.json({ error: "Varen eller tjenesten finnes ikke." }, { status: 404 });
    return NextResponse.json({ product });
  } catch (error) {
    return NextResponse.json({ error: "Kunne ikke oppdatere varen eller tjenesten." }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
