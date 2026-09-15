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
  try { const user = await requireUser(); const id = new URL(request.url).searchParams.get("id"); if (!id) return NextResponse.json({ error: "Mangler produkt-ID." }, { status: 400 }); await db.delete(products).where(and(eq(products.id, id), eq(products.organizationId, user.organizationId))); return NextResponse.json({ ok: true }); }
  catch { return NextResponse.json({ error: "Kunne ikke slette." }, { status: 401 }); }
}
