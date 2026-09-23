import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { decryptBankValue } from "@/lib/bank-crypto";
import { sqlClient } from "@/lib/db/client";
import { neonomicsRequest } from "@/lib/neonomics";

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const toOre = (value: unknown) => Math.round(Number(value ?? 0) * 100);

export async function POST() {
  try {
    const user = await requireUser();
    const rows =
      await sqlClient`SELECT * FROM bank_connections WHERE organization_id=${user.organizationId} AND status='CONNECTED' ORDER BY created_at DESC LIMIT 1`;
    const connection = rows[0];
    if (
      !connection?.provider_account_id ||
      !connection?.provider_session_encrypted
    )
      return NextResponse.json(
        { error: "Ingen bankkonto er tilkoblet." },
        { status: 409 },
      );
    const sessionId = decryptBankValue(
      String(connection.provider_session_encrypted),
    );
    const response = await neonomicsRequest(
      `/ics/v3/accounts/${encodeURIComponent(String(connection.provider_account_id))}/transactions?scope=business-accounts`,
      { sessionId, deviceId: String(connection.device_id) },
    );
    if (!response.ok)
      return NextResponse.json(
        {
          error:
            "Banken krever nytt samtykke eller kunne ikke levere transaksjoner.",
        },
        { status: 502 },
      );
    const transactions = Array.isArray(response.value)
      ? response.value
      : (response.value?.transactions ?? response.value?.data ?? []);
    // Validate currency before any import: never guess NOK or truncate a
    // malformed value into NOK. A rejected batch can safely be retried.
    if (!Array.isArray(transactions) || transactions.some((item) => {
      if (!item || typeof item !== "object") return true;
      const amount = typeof item.amount === "object" && item.amount ? item.amount : null;
      const currency = amount?.currency ?? item.currency;
      return typeof currency !== "string" || !/^[A-Z]{3}$/.test(currency.trim().toUpperCase());
    })) return NextResponse.json({ error: "Banken leverte transaksjoner med manglende eller ugyldig valuta. Ingen transaksjoner ble importert. Prøv igjen senere." }, { status: 502 });
    let imported = 0,
      matched = 0;
    for (const item of transactions as Array<Record<string, unknown>>) {
      const providerId = String(
        item.id ?? item.transactionId ?? item.entryReference ?? "",
      );
      if (!providerId) continue;
      const amountObject =
        typeof item.amount === "object" && item.amount
          ? (item.amount as Record<string, unknown>)
          : null;
      const amountOre = toOre(amountObject?.amount ?? item.amount);
      if (!Number.isSafeInteger(amountOre) || amountOre <= 0) continue;
      const reference = String(
        item.remittanceInformationUnstructured ??
          item.reference ??
          item.message ??
          item.additionalInformation ??
          "",
      );
      const structured = item.remittanceInformationStructured as
        | Record<string, unknown>
        | undefined;
      const kid = digits(
        structured?.reference ??
          item.kid ??
          reference.match(/\b\d{7,25}\b/)?.[0],
      );
      const bookedAt = new Date(
        String(
          item.bookingDate ??
            item.bookedAt ??
            item.valueDate ??
            new Date().toISOString(),
        ),
      );
      const currency = String(amountObject?.currency ?? item.currency)
        .trim()
        .toUpperCase();
      if (!Number.isFinite(bookedAt.getTime())) continue;
      // Import and matching must commit together; a failed match must not
      // permanently consume the provider's duplicate-protection key.
      const outcome = await sqlClient.begin(async (tx) => {
        const inserted = await tx`INSERT INTO bank_transactions (organization_id, connection_id, provider_transaction_id, booked_at, amount_ore, currency, kid, reference, raw_data) VALUES (${user.organizationId}, ${connection.id}, ${providerId}, ${bookedAt}, ${amountOre}, ${currency}, ${kid || null}, ${reference || null}, ${JSON.stringify(item)}::jsonb) ON CONFLICT (organization_id, provider_transaction_id) DO NOTHING RETURNING id`;
        if (!inserted[0]) return { imported: 0, matched: 0 };
        if (!kid || currency !== "NOK") return { imported: 1, matched: 0 };
        const invoices = await tx`SELECT id, total_ore, source_order_id FROM invoices WHERE organization_id=${user.organizationId} AND kid=${kid} AND currency=${currency} AND status IN ('FINALIZED','SENT','PARTIALLY_PAID','OVERDUE') LIMIT 1 FOR UPDATE`;
        const invoice = invoices[0];
        if (!invoice) return { imported: 1, matched: 0 };
        const sums = await tx`SELECT COALESCE(sum(amount_ore),0)::bigint AS paid FROM invoice_payments WHERE invoice_id=${invoice.id} AND organization_id=${user.organizationId}`;
        const previouslyPaid = Number(sums[0].paid);
        // Keep possible duplicates/overpayments unmatched for human review.
        if (amountOre > Number(invoice.total_ore) - previouslyPaid) return { imported: 1, matched: 0 };
        await tx`INSERT INTO invoice_payments (organization_id, invoice_id, bank_transaction_id, amount_ore, paid_at, source) VALUES (${user.organizationId}, ${invoice.id}, ${inserted[0].id}, ${amountOre}, ${bookedAt}, 'BANK')`;
        const paid = previouslyPaid + amountOre;
        const remaining = Math.max(0, Number(invoice.total_ore) - paid);
        const status = remaining === 0 ? "PAID" : "PARTIALLY_PAID";
        await tx`UPDATE invoices SET paid_amount_ore=${paid}, remaining_amount_ore=${remaining}, status=${status}, paid_at=${remaining === 0 ? bookedAt : null}, updated_at=now() WHERE id=${invoice.id} AND organization_id=${user.organizationId}`;
        if (!remaining) await tx`UPDATE orders SET status='CLOSED', closed_at=now(), updated_at=now() WHERE id=${invoice.source_order_id} AND organization_id=${user.organizationId}`;
        await tx`UPDATE bank_transactions SET matched_invoice_id=${invoice.id} WHERE id=${inserted[0].id} AND organization_id=${user.organizationId}`;
        return { imported: 1, matched: 1 };
      });
      imported += outcome.imported;
      matched += outcome.matched;
    }
    await sqlClient`UPDATE bank_connections SET last_synced_at=now(), updated_at=now() WHERE id=${connection.id} AND organization_id=${user.organizationId}`;
    return NextResponse.json({ imported, matched });
  } catch {
    return NextResponse.json(
      { error: "Kunne ikke synkronisere banken." },
      { status: 500 },
    );
  }
}
