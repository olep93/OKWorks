import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { sqlClient } from "@/lib/db/client";

const input = z.object({
  amountOre: z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  paidAt: z.iso.date(),
  note: z.string().trim().max(500).optional(),
  requestId: z.uuid().optional(),
});
type Context = { params: Promise<{ id: string }> };

export async function GET(_request: Request, ctx: Context) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const payments = await sqlClient`SELECT p.* FROM invoice_payments p JOIN invoices i ON i.id=p.invoice_id WHERE p.invoice_id=${id} AND i.organization_id=${user.organizationId} AND p.organization_id=${user.organizationId} ORDER BY p.paid_at DESC`;
    return NextResponse.json({ payments });
  } catch (error) {
    return NextResponse.json({ error: "Kunne ikke hente betalinger." }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function POST(request: Request, ctx: Context) {
  try {
    const user = await requireUser();
    const { id } = await ctx.params;
    const parsed = input.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Kontroller beløp og betalingsdato." }, { status: 400 });
    const invoice = await sqlClient.begin(async (tx) => {
      // Serialize manual payments for this invoice, including balance validation.
      const rows = await tx`SELECT * FROM invoices WHERE id=${id} AND organization_id=${user.organizationId} FOR UPDATE`;
      const current = rows[0];
      if (!current) return null;
      if (parsed.data.requestId) {
        const existing = await tx`SELECT invoice_id, amount_ore, paid_at, note FROM invoice_payments WHERE organization_id=${user.organizationId} AND idempotency_key=${parsed.data.requestId}`;
        if (existing[0]) {
          const payment = existing[0];
          if (payment.invoice_id !== id || Number(payment.amount_ore) !== parsed.data.amountOre || new Date(payment.paid_at).toISOString().slice(0, 10) !== parsed.data.paidAt || (payment.note || "") !== (parsed.data.note || "")) throw new Error("REQUEST_CONFLICT");
          return current;
        }
      }
      if (!["FINALIZED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(current.status)) throw new Error("INVALID_STATUS");
      const sums = await tx`SELECT COALESCE(sum(amount_ore),0)::bigint AS paid FROM invoice_payments WHERE invoice_id=${id} AND organization_id=${user.organizationId}`;
      const previouslyPaid = Number(sums[0].paid);
      const remainingBefore = Number(current.total_ore) - previouslyPaid;
      if (parsed.data.amountOre > remainingBefore) throw new Error("EXCEEDS_REMAINING");
      const paidAt = new Date(parsed.data.paidAt + "T12:00:00Z");
      await tx`INSERT INTO invoice_payments (organization_id, invoice_id, amount_ore, paid_at, source, note, created_by, idempotency_key) VALUES (${user.organizationId}, ${id}, ${parsed.data.amountOre}, ${paidAt}, 'MANUAL', ${parsed.data.note || null}, ${user.id}, ${parsed.data.requestId ?? null})`;
      const paid = previouslyPaid + parsed.data.amountOre;
      const remaining = Number(current.total_ore) - paid;
      const status = remaining === 0 ? "PAID" : "PARTIALLY_PAID";
      const updated = await tx`UPDATE invoices SET paid_amount_ore=${paid}, remaining_amount_ore=${remaining}, status=${status}, paid_at=${remaining === 0 ? paidAt : null}, updated_at=now() WHERE id=${id} AND organization_id=${user.organizationId} RETURNING *`;
      if (!remaining) await tx`UPDATE orders SET status='CLOSED', closed_at=now(), updated_at=now() WHERE id=${current.source_order_id} AND organization_id=${user.organizationId}`;
      await tx`INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata) VALUES (${user.organizationId}, ${user.id}, 'INVOICE_PAYMENT_REGISTERED', 'INVOICE', ${id}, ${JSON.stringify({ amountOre: parsed.data.amountOre, paidAt: parsed.data.paidAt, remainingAmountOre: remaining })}::jsonb)`;
      return updated[0];
    });
    if (!invoice) return NextResponse.json({ error: "Fakturaen finnes ikke." }, { status: 404 });
    return NextResponse.json({ invoice });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Økten er utløpt. Logg inn igjen." }, { status: 401 });
    if (error instanceof Error && error.message === "REQUEST_CONFLICT") return NextResponse.json({ error: "Dette betalingsforsøket er allerede brukt med andre opplysninger. Last siden på nytt og kontroller historikken." }, { status: 409 });
    if (error instanceof Error && error.message === "INVALID_STATUS") return NextResponse.json({ error: "Betaling kan bare registreres på en finalisert faktura med utestående beløp." }, { status: 409 });
    if (error instanceof Error && error.message === "EXCEEDS_REMAINING") return NextResponse.json({ error: "Beløpet overstiger restbeløpet. Kontroller om betalingen allerede er registrert." }, { status: 409 });
    return NextResponse.json({ error: "Kunne ikke registrere betalingen." }, { status: 500 });
  }
}
