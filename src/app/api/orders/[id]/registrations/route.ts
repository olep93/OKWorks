import { and, eq, inArray, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { invoiceLines, invoices, orderEntries, orders, timeEntries } from "@/lib/db/schema";
import { hotelStay } from "@/lib/travel";
import { canResetInvoiceDraft } from "@/lib/invoice-draft";

const input = z.object({ id: z.uuid(), type: z.enum(["TIME", "EXTRA"]), workDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), description: z.string().trim().max(1000), title: z.string().trim().min(1).max(240), quantity: z.number().min(0).max(1000000), rateOre: z.number().int().min(0).max(100000000), amountOre: z.number().int().min(0).max(100000000000), tollOre: z.number().int().min(0).max(100000000).optional() });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Kontroller dato, antall og pris." }, { status: 400 });
    const value = parsed.data;
    const result = await db.transaction(async (tx) => {
      const invoiceScope = and(eq(invoices.sourceOrderId, id), eq(invoices.organizationId, user.organizationId));
      await tx.select({ id: invoices.id }).from(invoices).where(invoiceScope).for("update");
      const [order] = await tx.select().from(orders).where(and(eq(orders.id, id), eq(orders.organizationId, user.organizationId))).for("update");
      if (!order) return { status: 404, body: { error: "Ordren finnes ikke." } };
      const invoiceRows = await tx.select({ status: invoices.status }).from(invoices).where(invoiceScope).for("update");
      if (["INVOICED", "CLOSED", "CANCELLED"].includes(order.status) || invoiceRows.some((row) => row.status !== "DRAFT")) return { status: 409, body: { error: "Finalisert eller låst fakturagrunnlag kan ikke redigeres." } };
      const workDate = new Date(`${value.workDate}T12:00:00.000Z`);
      if (!Number.isFinite(workDate.getTime()) || workDate.toISOString().slice(0, 10) !== value.workDate) return { status: 400, body: { error: "Ugyldig dato." } };
      if (value.type === "TIME") {
        if (value.quantity <= 0 || value.quantity > 24 || Math.round(value.quantity * 60) < 1) return { status: 400, body: { error: "Angi minst ett minutt og maks 24 timer per registrering." } };
        const rows = await tx.update(timeEntries).set({ workDate, description: value.description || null, minutes: Math.round(value.quantity * 60), ratePerHourOre: value.rateOre, updatedAt: new Date() }).where(and(eq(timeEntries.id, value.id), eq(timeEntries.orderId, id), eq(timeEntries.organizationId, user.organizationId), eq(timeEntries.billingStatus, "UNBILLED"))).returning({ id: timeEntries.id });
        if (!rows.length) return { status: 404, body: { error: "Timeregistreringen finnes ikke eller er låst." } };
      } else {
        const scope = and(eq(orderEntries.id, value.id), eq(orderEntries.orderId, id), eq(orderEntries.organizationId, user.organizationId));
        const [entry] = await tx.select().from(orderEntries).where(scope);
        if (!entry || entry.billingStatus === "INVOICED") return { status: 404, body: { error: "Registreringen finnes ikke eller er låst." } };
        const financial = !["IMAGE", "DOCUMENT"].includes(entry.kind);
        const stay = entry.kind === "HOTEL" ? hotelStay(entry.metadata) : null;
        if (stay && value.workDate !== stay.startDate) return { status: 400, body: { error: "Hotellperioden kan ikke flyttes ved beløpsredigering, siden reisene hører til denne perioden." } };
        if (entry.kind === "DRIVING" && value.tollOre == null) return { status: 400, body: { error: "Angi bompenger, eller 0 dersom ruten er bomfri." } };
        await tx.update(orderEntries).set({ workDate, title: value.title, description: value.description || null, ...(["LINE", "DRIVING"].includes(entry.kind) ? { quantityThousandths: Math.round(value.quantity * 1000), unitRateOre: value.rateOre, amountOre: Math.round(value.quantity * value.rateOre) + (entry.kind === "DRIVING" ? value.tollOre ?? 0 : 0), ...(entry.kind === "DRIVING" ? { metadata: { ...(entry.metadata as Record<string, unknown> | null), tollOre: value.tollOre, tollKnown: true, tollInputGross: true, tollSource: "MANUAL" } } : {}) } : financial ? { amountOre: value.amountOre } : {}), updatedAt: new Date() }).where(scope);
      }
      return { status: 200, body: { ok: true, refreshDraft: invoiceRows.length > 0 } };
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return NextResponse.json({ error: "Kunne ikke oppdatere registreringen." }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser();
    const { id } = await context.params;
    const parsed = z.object({ id: z.uuid(), type: z.enum(["TIME", "EXTRA"]) }).safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Ugyldig registrering." }, { status: 400 });
    const result = await db.transaction(async (tx) => {
      const invoiceScope = and(eq(invoices.sourceOrderId, id), eq(invoices.organizationId, user.organizationId));
      await tx.select({ id: invoices.id }).from(invoices).where(invoiceScope).for("update");
      const [order] = await tx.select().from(orders).where(and(eq(orders.id, id), eq(orders.organizationId, user.organizationId))).for("update");
      if (!order) return { status: 404, body: { error: "Ordren finnes ikke." } };
      const drafts = await tx.select().from(invoices).where(invoiceScope).for("update");
      if (["INVOICED", "CLOSED", "CANCELLED"].includes(order.status) || drafts.some((row) => !canResetInvoiceDraft(row))) return { status: 409, body: { error: "Registreringer på finaliserte eller låste fakturaer kan ikke slettes." } };
      let sourceIds = [parsed.data.id];
      if (parsed.data.type === "TIME") {
        const removed = await tx.delete(timeEntries).where(and(eq(timeEntries.id, parsed.data.id), eq(timeEntries.orderId, id), eq(timeEntries.organizationId, user.organizationId), eq(timeEntries.billingStatus, "UNBILLED"))).returning({ id: timeEntries.id });
        if (!removed.length) return { status: 404, body: { error: "Timeregistreringen finnes ikke eller er låst." } };
      } else {
        const scope = and(eq(orderEntries.orderId, id), eq(orderEntries.organizationId, user.organizationId));
        const [entry] = await tx.select().from(orderEntries).where(and(scope, eq(orderEntries.id, parsed.data.id))).for("update");
        if (!entry) return { status: 404, body: { error: "Registreringen finnes ikke." } };
        const linked = entry.kind === "HOTEL" ? await tx.select().from(orderEntries).where(and(scope, eq(orderEntries.kind, "DRIVING"), sql`${orderEntries.metadata}->>'hotelEntryId' = ${entry.id}`)).for("update") : [];
        if ([entry, ...linked].some((row) => row.billingStatus === "INVOICED")) return { status: 409, body: { error: "Fakturerte registreringer kan ikke slettes." } };
        sourceIds = [entry.id, ...linked.map((row) => row.id)];
        await tx.delete(orderEntries).where(and(scope, inArray(orderEntries.id, sourceIds)));
      }
      // Update draft lines and totals atomically, including deletion of the very last billable line.
      for (const draft of drafts) {
        await tx.delete(invoiceLines).where(and(eq(invoiceLines.invoiceId, draft.id), eq(invoiceLines.organizationId, user.organizationId), inArray(invoiceLines.sourceId, sourceIds)));
        const [totals] = await tx.select({ subtotal: sql<string>`coalesce(sum(${invoiceLines.subtotalOre}), 0)`, vat: sql<string>`coalesce(sum(${invoiceLines.vatAmountOre}), 0)`, total: sql<string>`coalesce(sum(${invoiceLines.totalOre}), 0)` }).from(invoiceLines).where(and(eq(invoiceLines.invoiceId, draft.id), eq(invoiceLines.organizationId, user.organizationId)));
        await tx.update(invoices).set({ subtotalOre: Number(totals.subtotal), vatAmountOre: Number(totals.vat), totalOre: Number(totals.total), remainingAmountOre: Number(totals.total), updatedAt: new Date() }).where(and(eq(invoices.id, draft.id), eq(invoices.organizationId, user.organizationId)));
      }
      return { status: 200, body: { ok: true, deletedCount: sourceIds.length } };
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    return NextResponse.json({ error: "Kunne ikke slette registreringen." }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
