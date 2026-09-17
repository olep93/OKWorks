import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { invoices, orderEntries, orders, organizations, organizationSettings } from "@/lib/db/schema";
import { computeTravelRoutes } from "@/lib/travel-route";
import { fullAddress, hotelStay, validDate } from "@/lib/travel";

const kinds = ["LINE", "DRIVING", "EXPENSE", "HOTEL", "IMAGE", "DOCUMENT"] as const;
const inputSchema = z.object({ kind: z.enum(kinds), workDate: z.string().refine(validDate), title: z.string().trim().min(1).max(240), description: z.string().trim().max(1000).optional(), quantity: z.coerce.number().min(0).max(1000000).optional(), unit: z.string().trim().max(30).optional(), unitRateOre: z.coerce.number().int().min(0).max(100000000).optional(), costOre: z.coerce.number().int().min(0).max(100000000000).optional(), tollOre: z.coerce.number().int().min(0).max(100000000).optional(), markupBasisPoints: z.coerce.number().int().min(0).max(100000).optional(), fileName: z.string().trim().max(300).optional(), startDate: z.string().optional(), endDate: z.string().optional(), hotelAddress: z.string().trim().max(500).optional(), autoTravel: z.union([z.boolean(), z.enum(["true", "false"])]).transform((value) => value === true || value === "true").optional(), requestId: z.uuid().optional(), metadata: z.preprocess((value) => { if (typeof value !== "string") return value; try { return JSON.parse(value); } catch { return null; } }, z.record(z.string(), z.unknown()).optional()) });

async function ownedOrder(id: string, organizationId: string) { const [order] = await db.select({ id: orders.id, status: orders.status }).from(orders).where(and(eq(orders.id, id), eq(orders.organizationId, organizationId))).limit(1); return order; }

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try { const user = await requireUser(); const { id } = await context.params; if (!(await ownedOrder(id, user.organizationId))) return NextResponse.json({ error: "Ordren finnes ikke." }, { status: 404 }); const entries = await db.select({ id: orderEntries.id, kind: orderEntries.kind, workDate: orderEntries.workDate, title: orderEntries.title, description: orderEntries.description, quantityThousandths: orderEntries.quantityThousandths, unit: orderEntries.unit, unitRateOre: orderEntries.unitRateOre, amountOre: orderEntries.amountOre, fileName: orderEntries.fileName, mimeType: orderEntries.mimeType, metadata: orderEntries.metadata, fileSize: orderEntries.fileSize }).from(orderEntries).where(and(eq(orderEntries.orderId, id), eq(orderEntries.organizationId, user.organizationId))).orderBy(asc(orderEntries.workDate), asc(orderEntries.createdAt)); return NextResponse.json({ entries }); }
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
    if (value.kind === "IMAGE" || value.kind === "DOCUMENT" || (value.kind === "HOTEL" && file instanceof File && file.size > 0)) {
      if (!(file instanceof File) || !file.size) return NextResponse.json({ error: "Velg en fil som skal lastes opp." }, { status: 400 });
      if (file.size > 4 * 1024 * 1024) return NextResponse.json({ error: "Filen er for stor. Maksimal størrelse er 4 MB." }, { status: 413 });
      const allowed = value.kind === "IMAGE" ? ["image/jpeg", "image/png"] : ["application/pdf", "image/jpeg", "image/png"];
      if (!allowed.includes(file.type)) return NextResponse.json({ error: value.kind === "IMAGE" ? "Bruk JPG- eller PNG-bilde." : "Bruk PDF, JPG eller PNG." }, { status: 415 });
      fileData = new Uint8Array(await file.arrayBuffer()); mimeType = file.type; fileSize = file.size; fileName = file.name;
    }
    const stay = value.kind === "HOTEL" ? hotelStay(value) : null;
    const returnInput = value.kind === "DRIVING" && value.metadata?.returnTrip ? z.object({ date: z.string().refine(validDate), quantity: z.number().min(0).max(1000000), tollOre: z.number().int().min(0).max(100000000), tollSource: z.enum(["DIB", "GOOGLE_ESTIMATE", "MANUAL"]).optional() }).safeParse(value.metadata.returnTrip) : null;
    if (returnInput && (!returnInput.success || returnInput.data.date < value.workDate)) return NextResponse.json({ error: "Kontroller returdato, kilometer og bompenger." }, { status: 400 });
    if (value.kind === "HOTEL" && !stay) return NextResponse.json({ error: "Angi hotelladresse og gyldig fra–til-dato." }, { status: 400 });
    let trips: Array<{ origin: string; destination: string; date: string; distanceKm: number; tollOre: number | null; tollKnown: boolean; source: string }> = [];
    let mileageRateOre = 0;
    if (stay && value.autoTravel) {
      const [[org], [settings]] = await Promise.all([db.select().from(organizations).where(eq(organizations.id, user.organizationId)).limit(1), db.select().from(organizationSettings).where(eq(organizationSettings.organizationId, user.organizationId)).limit(1)]);
      const companyAddress = fullAddress(org ?? {});
      if (!org?.address?.trim()) return NextResponse.json({ error: "Legg inn firmaadressen i profilen før automatisk hotellkjøring." }, { status: 400 });
      const emissionType = z.enum(["GASOLINE", "DIESEL", "HYBRID", "ELECTRIC"]).safeParse(value.metadata?.emissionType || settings?.vehicleFuelType || "GASOLINE");
      if (!emissionType.success) return NextResponse.json({ error: "Velg en gyldig biltype." }, { status: 400 });
      mileageRateOre = settings?.mileageRateOre ?? 500;
      try {
        const outbound = await computeTravelRoutes(companyAddress, stay.hotelAddress, emissionType.data, stay.startDate, "08:00", typeof value.metadata?.autoPass === "boolean" ? value.metadata.autoPass : settings?.vehicleAutoPass ?? false, { date: stay.endDate, time: "16:00" });
        const inbound = outbound.returnRoute!;
        trips = [{ origin: companyAddress, destination: stay.hotelAddress, date: stay.startDate, ...outbound }, { origin: stay.hotelAddress, destination: companyAddress, date: stay.endDate, ...inbound }];
      } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Kunne ikke beregne hotellkjøring. Ingenting ble lagret." }, { status: 422 }); }
    }
    const quantityThousandths = value.quantity == null ? null : Math.round(value.quantity * 1000);
    const baseOre = value.costOre ?? Math.round((value.quantity ?? 0) * (value.unitRateOre ?? 0));
    const amountOre = Math.round(baseOre * (1 + (value.markupBasisPoints ?? 0) / 10000)) + (value.tollOre ?? 0);
    const entry = await db.transaction(async (tx) => {
      // Match finalization's invoice -> order lock order and recheck before adding costs.
      const invoiceRows = await tx.select().from(invoices).where(and(eq(invoices.sourceOrderId, id), eq(invoices.organizationId, user.organizationId))).for("update");
      const [currentOrder] = await tx.select().from(orders).where(and(eq(orders.id, id), eq(orders.organizationId, user.organizationId))).for("update");
      if (!currentOrder || ["INVOICED", "CLOSED", "CANCELLED"].includes(currentOrder.status) || invoiceRows.some((row) => row.status !== "DRAFT")) throw new Error("ORDER_LOCKED");
      if (value.requestId) {
        const existing = await tx.select().from(orderEntries).where(and(eq(orderEntries.orderId, id), eq(orderEntries.organizationId, user.organizationId)));
        const duplicate = existing.find((row) => (row.metadata as Record<string, unknown> | null)?.requestId === value.requestId);
        if (duplicate) return { id: duplicate.id, kind: duplicate.kind, title: duplicate.title };
      }
      if (stay) {
        const hotels = await tx.select({ metadata: orderEntries.metadata }).from(orderEntries).where(and(eq(orderEntries.orderId, id), eq(orderEntries.organizationId, user.organizationId), eq(orderEntries.kind, "HOTEL")));
        if (hotels.some((row) => { const other = hotelStay(row.metadata); return other && stay.startDate <= other.endDate && stay.endDate >= other.startDate; })) throw new Error("HOTEL_OVERLAP");
      }
      const [created] = await tx.insert(orderEntries).values({ organizationId: user.organizationId, orderId: id, createdBy: user.id, kind: value.kind, workDate: new Date(`${stay?.startDate ?? value.workDate}T12:00:00.000Z`), title: value.title, description: value.description || null, quantityThousandths, unit: value.unit || null, unitRateOre: value.unitRateOre ?? null, amountOre, fileName, mimeType, fileSize, fileData, metadata: { ...value.metadata, ...stay, requestId: value.requestId }, billingStatus: value.kind === "IMAGE" || value.kind === "DOCUMENT" ? "NON_BILLABLE" : "UNBILLED" }).returning({ id: orderEntries.id, kind: orderEntries.kind, title: orderEntries.title });
      if (returnInput?.success) {
        const returning = returnInput.data;
        await tx.insert(orderEntries).values({ organizationId: user.organizationId, orderId: id, createdBy: user.id, kind: "DRIVING", workDate: new Date(`${returning.date}T12:00:00Z`), title: `Retur: ${String(value.metadata?.destination || "")} – ${String(value.metadata?.origin || "")}`.slice(0, 240), description: value.description || null, quantityThousandths: Math.round(returning.quantity * 1000), unit: "km", unitRateOre: value.unitRateOre ?? 0, amountOre: Math.round(returning.quantity * (value.unitRateOre ?? 0)) + returning.tollOre, metadata: { origin: value.metadata?.destination, destination: value.metadata?.origin, outboundEntryId: created.id, emissionType: value.metadata?.emissionType, vehicleName: value.metadata?.vehicleName, tollKnown: true, tollInputGross: true, tollOre: returning.tollOre, tollSource: returning.tollSource ?? "MANUAL" }, billingStatus: "UNBILLED" });
      }
      if (trips.length) await tx.insert(orderEntries).values(trips.map((trip, index) => ({ organizationId: user.organizationId, orderId: id, createdBy: user.id, kind: "DRIVING", workDate: new Date(`${trip.date}T12:00:00Z`), title: `${index === 0 ? "Utreise" : "Hjemreise"}: ${trip.origin} – ${trip.destination}`.slice(0, 240), description: `Hotellopphold: ${value.title}. ${trip.tollKnown ? (trip.source === "DIB" ? "Bompenger og ferje fra DIB-estimat." : "Bompenger fra Google-estimat.") : "Bompenger er ukjent og må registreres manuelt før fakturering."}`, quantityThousandths: Math.round(trip.distanceKm * 1000), unit: "km", unitRateOre: mileageRateOre, amountOre: Math.round(trip.distanceKm * mileageRateOre) + (trip.tollOre ?? 0), metadata: { hotelEntryId: created.id, origin: trip.origin, destination: trip.destination, tollOre: trip.tollOre, tollKnown: trip.tollKnown, tollSource: trip.source === "DIB" ? "DIB" : "GOOGLE_ESTIMATE", emissionType: value.metadata?.emissionType, vehicleName: value.metadata?.vehicleName, autoPass: value.metadata?.autoPass, autoGenerated: true, tollInputGross: true }, billingStatus: "UNBILLED" as const })));
      return created;
    });
    return NextResponse.json({ entry, tripsAdded: trips.length, tollNeedsReview: trips.some((trip) => !trip.tollKnown) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ error: message === "ORDER_LOCKED" ? "Ordren er låst." : message === "HOTEL_OVERLAP" ? "Hotellperioden overlapper et annet opphold på denne ordren. Kontroller datoene." : "Kunne ikke lagre registreringen." }, { status: message === "UNAUTHORIZED" ? 401 : ["ORDER_LOCKED", "HOTEL_OVERLAP"].includes(message) ? 409 : 500 });
  }
}
