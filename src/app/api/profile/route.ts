import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { organizationSettings, organizations, products } from "@/lib/db/schema";

const profileSchema = z.object({
  vehicleName: z.string().trim().max(120).optional(),
  vehicleFuelType: z.enum(["GASOLINE", "DIESEL", "ELECTRIC", "HYBRID"]).optional(),
  vehicleAutoPass: z.union([z.boolean(), z.enum(["true", "false", "on"])]).transform((value) => value === true || value === "true" || value === "on").optional(),
  name: z.string().trim().min(2), organizationNumber: z.string().trim().max(20),
  email: z.union([z.email(), z.literal("")]), phone: z.string().trim().max(40),
  address: z.string().trim().max(500), postalCode: z.string().trim().max(16), city: z.string().trim().max(120),
  invoiceEmail: z.union([z.email(), z.literal("")]), invoicePhone: z.string().trim().max(40),
  bankAccount: z.string().trim().max(32), defaultPaymentTermsDays: z.coerce.number().int().min(0).max(120),
  defaultVatBasisPoints: z.coerce.number().int().min(0).max(10000), defaultHourlyRateOre: z.coerce.number().int().min(0),
  mileageRateOre: z.coerce.number().int().min(0), dietDayRateOre: z.coerce.number().int().min(0),
  dietOvernightRateOre: z.coerce.number().int().min(0), hotelMarkupBasisPoints: z.coerce.number().int().min(0),
  expenseMarkupBasisPoints: z.coerce.number().int().min(0),
});

export async function GET() {
  try {
    const user = await requireUser();
    const [[organization], [settings], productRows] = await Promise.all([
      db.select().from(organizations).where(eq(organizations.id, user.organizationId)).limit(1),
      db.select().from(organizationSettings).where(eq(organizationSettings.organizationId, user.organizationId)).limit(1),
      db.select().from(products).where(and(eq(products.organizationId, user.organizationId), eq(products.active, true))),
    ]);
    return NextResponse.json({ organization, settings, products: productRows });
  } catch { return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 }); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireUser(); const parsed = profileSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Kontroller firmainformasjonen og satsene." }, { status: 400 });
    const value = parsed.data;
    const vehicle = { ...(value.vehicleName !== undefined ? { vehicleName: value.vehicleName || null } : {}), ...(value.vehicleFuelType !== undefined ? { vehicleFuelType: value.vehicleFuelType } : {}), ...(value.vehicleAutoPass !== undefined ? { vehicleAutoPass: value.vehicleAutoPass } : {}) };
    await db.transaction(async (tx) => {
      await tx.update(organizations).set({ name: value.name, organizationNumber: value.organizationNumber || null, email: value.email || null, phone: value.phone || null, address: value.address || null, postalCode: value.postalCode || null, city: value.city || null, invoiceEmail: value.invoiceEmail || null, invoicePhone: value.invoicePhone || null, bankAccount: value.bankAccount || null, defaultPaymentTermsDays: value.defaultPaymentTermsDays, defaultVatBasisPoints: value.defaultVatBasisPoints, defaultHourlyRateOre: value.defaultHourlyRateOre, updatedAt: new Date() }).where(eq(organizations.id, user.organizationId));
      await tx.insert(organizationSettings).values({ ...vehicle, organizationId: user.organizationId, mileageRateOre: value.mileageRateOre, dietDayRateOre: value.dietDayRateOre, dietOvernightRateOre: value.dietOvernightRateOre, hotelMarkupBasisPoints: value.hotelMarkupBasisPoints, expenseMarkupBasisPoints: value.expenseMarkupBasisPoints }).onConflictDoUpdate({ target: organizationSettings.organizationId, set: { ...vehicle, mileageRateOre: value.mileageRateOre, dietDayRateOre: value.dietDayRateOre, dietOvernightRateOre: value.dietOvernightRateOre, hotelMarkupBasisPoints: value.hotelMarkupBasisPoints, expenseMarkupBasisPoints: value.expenseMarkupBasisPoints, updatedAt: new Date() } });
    });
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Kunne ikke lagre firmaprofilen." }, { status: 401 }); }
}
