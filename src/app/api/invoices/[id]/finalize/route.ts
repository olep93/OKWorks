import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sqlClient } from "@/lib/db/client";
import { checkInvoicePreflight } from "@/lib/invoice-preflight";

export async function POST(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireUser(); const { id } = await context.params;
    const result = await sqlClient.begin(async (tx) => {
      const rows = await tx`SELECT * FROM invoices WHERE id = ${id} AND organization_id = ${user.organizationId} FOR UPDATE`;
      const invoice = rows[0];
      if (!invoice) return { status: 404, body: { error: "Fakturaen finnes ikke." } };
      if (invoice.status !== "DRAFT") return { status: 200, body: { invoice, alreadyFinalized: true } };

      const [lineCountRows, documentCountRows] = await Promise.all([
        tx`SELECT count(*)::int AS count FROM invoice_lines WHERE invoice_id = ${id} AND organization_id = ${user.organizationId}`,
        tx`SELECT count(*)::int AS count FROM order_entries WHERE order_id = ${invoice.source_order_id} AND organization_id = ${user.organizationId} AND kind IN ('IMAGE', 'DOCUMENT')`,
      ]);
      const preflight = checkInvoicePreflight({ status: invoice.status, totalOre: Number(invoice.total_ore), organization: invoice.organization_snapshot as Record<string, unknown>, customer: invoice.customer_snapshot as Record<string, unknown>, lineCount: Number(lineCountRows[0]?.count ?? 0), documentationCount: Number(documentCountRows[0]?.count ?? 0) });
      if (!preflight.canFinalize) return { status: 400, body: { error: "Fakturaen er ikke klar for finalisering.", preflight } };

      await tx`INSERT INTO invoice_sequences (organization_id, next_number) VALUES (${user.organizationId}, 1001) ON CONFLICT (organization_id) DO NOTHING`;
      const sequenceRows = await tx`SELECT next_number FROM invoice_sequences WHERE organization_id = ${user.organizationId} FOR UPDATE`;
      const invoiceNumber = Number(sequenceRows[0].next_number);
      await tx`UPDATE invoice_sequences SET next_number = ${invoiceNumber + 1}, updated_at = now() WHERE organization_id = ${user.organizationId}`;
      const finalizedRows = await tx`UPDATE invoices SET invoice_number = ${invoiceNumber}, status = 'FINALIZED', finalized_at = now(), remaining_amount_ore = total_ore, updated_at = now() WHERE id = ${id} RETURNING *`;
      await tx`UPDATE time_entries t SET billing_status = 'INVOICED', invoice_line_id = l.id, updated_at = now() FROM invoice_lines l WHERE l.invoice_id = ${id} AND l.source_type = 'TIME' AND l.source_id = t.id`;
      await tx`UPDATE order_entries e SET billing_status = 'INVOICED', updated_at = now() FROM invoice_lines l WHERE l.invoice_id = ${id} AND l.source_id = e.id`;
      await tx`UPDATE orders SET status = 'INVOICED', updated_at = now() WHERE id = ${invoice.source_order_id} AND organization_id = ${user.organizationId}`;
      await tx`INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata) VALUES (${user.organizationId}, ${user.id}, 'INVOICE_FINALIZED', 'INVOICE', ${id}, ${tx.json({ invoiceNumber })})`;
      return { status: 200, body: { invoice: finalizedRows[0], preflight } };
    });
    return NextResponse.json(result.body, { status: result.status });
  } catch (error) {
    console.error(error); return NextResponse.json({ error: "Kunne ikke finalisere fakturaen." }, { status: 500 });
  }
}
