import { add, calculateLine, nok, type Money } from "./money";

export type BillableSource = Readonly<{
  id: string;
  type: "ORDER_ITEM" | "TIME_ENTRY" | "TRIP" | "EXPENSE" | "DIET_ENTRY";
  description: string;
  quantityThousandths: number;
  unit: string;
  unitPriceOre: number;
  vatBasisPoints: number;
  billingStatus: "UNBILLED" | "INVOICED" | "NON_BILLABLE";
}>;

export type InvoiceDraftLine = Omit<BillableSource, "billingStatus"> & Readonly<{
  subtotal: Money;
  vat: Money;
  total: Money;
}>;

export type InvoiceDraft = Readonly<{
  organizationId: string;
  orderId: string;
  idempotencyKey: string;
  lines: readonly InvoiceDraftLine[];
  subtotal: Money;
  vat: Money;
  total: Money;
}>;

export function buildInvoiceDraft(input: {
  organizationId: string;
  orderId: string;
  idempotencyKey: string;
  sources: readonly BillableSource[];
}): InvoiceDraft {
  if (!input.organizationId || !input.orderId || !input.idempotencyKey) {
    throw new TypeError("Organization, order and idempotency key are required");
  }
  const seen = new Set<string>();
  const lines = input.sources.map((source) => {
    if (source.billingStatus !== "UNBILLED") {
      throw new Error(`Source ${source.id} is not available for invoicing`);
    }
    const uniqueSource = `${source.type}:${source.id}`;
    if (seen.has(uniqueSource)) {
      throw new Error(`Duplicate invoice source ${uniqueSource}`);
    }
    seen.add(uniqueSource);
    const amounts = calculateLine(source);
    return { ...source, ...amounts, billingStatus: undefined } as unknown as InvoiceDraftLine;
  });
  if (lines.length === 0) throw new Error("An invoice needs at least one line");

  return {
    organizationId: input.organizationId,
    orderId: input.orderId,
    idempotencyKey: input.idempotencyKey,
    lines,
    subtotal: add(...lines.map((line) => line.subtotal)),
    vat: add(...lines.map((line) => line.vat)),
    total: add(...lines.map((line) => line.total)),
  };
}

export function remainingAmount(total: Money, paid: Money): Money {
  return nok(Math.max(0, total.amountOre - paid.amountOre));
}
