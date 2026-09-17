import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { customers, orderEntries, orders, organizations, organizationSettings } from "@/lib/db/schema";
import { computeDrivingRoute } from "@/lib/google-route";
import { activeHotel, fullAddress, validDate } from "@/lib/travel";
import { localDate } from "@/lib/format";

const schema = z.object({ origin: z.string().trim().min(3).max(500), destination: z.string().trim().min(3).max(500), emissionType: z.enum(["GASOLINE", "DIESEL", "HYBRID", "ELECTRIC"]).default("GASOLINE") });
async function context(id: string, organizationId: string) {
  const [row] = await db.select({ order: orders, customer: customers }).from(orders).innerJoin(customers, eq(customers.id, orders.customerId)).where(and(eq(orders.id, id), eq(orders.organizationId, organizationId))).limit(1);
  const [[org], [settings], stays] = await Promise.all([
    db.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1),
    db.select().from(organizationSettings).where(eq(organizationSettings.organizationId, organizationId)).limit(1),
    db.select({ metadata: orderEntries.metadata }).from(orderEntries).where(and(eq(orderEntries.orderId, id), eq(orderEntries.organizationId, organizationId), eq(orderEntries.kind, "HOTEL"))),
  ]);
  return { row, org, settings, stays };
}
export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await ctx.params;
    const date = new URL(request.url).searchParams.get("date") || localDate();
    if (!validDate(date)) return NextResponse.json({ error: "Ugyldig dato." }, { status: 400 });
    const data = await context(id, user.organizationId);
    if (!data.row) return NextResponse.json({ error: "Ordren finnes ikke." }, { status: 404 });
    const stay = activeHotel(data.stays, date);
    return NextResponse.json({ origin: stay?.hotelAddress || fullAddress(data.org ?? {}), destination: data.row.order.workAddress || fullAddress(data.row.customer), hotelStay: stay, mileageRateOre: data.settings?.mileageRateOre ?? 500, mapsConfigured: Boolean(process.env.GOOGLE_MAPS_API_KEY) });
  } catch { return NextResponse.json({ error: "Kunne ikke hente ruteforslag." }, { status: 401 }); }
}
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await ctx.params;
    const data = await context(id, user.organizationId);
    if (!data.row) return NextResponse.json({ error: "Ordren finnes ikke." }, { status: 404 });
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Kontroller adressene." }, { status: 400 });
    return NextResponse.json(await computeDrivingRoute(parsed.data.origin, parsed.data.destination, parsed.data.emissionType));
  } catch (error) { return NextResponse.json({ error: error instanceof Error && error.message === "UNAUTHORIZED" ? "Ikke innlogget." : error instanceof Error ? error.message : "Kunne ikke beregne ruten." }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 422 }); }
}
