import { describe, expect, it } from "vitest";
import { buildInvoiceDraft, remainingAmount } from "./invoicing";
import { nok } from "./money";

const source = {
  id: "time-1",
  type: "TIME_ENTRY" as const,
  description: "Arbeidstime",
  quantityThousandths: 5_500,
  unit: "timer",
  unitPriceOre: 79_000,
  vatBasisPoints: 2_500,
  billingStatus: "UNBILLED" as const,
};

describe("invoice drafting", () => {
  it("creates totals only from unbilled sources", () => {
    const draft = buildInvoiceDraft({ organizationId: "org-1", orderId: "order-1", idempotencyKey: "idem-1", sources: [source] });
    expect(draft.total.amountOre).toBe(543_125);
  });

  it("prevents the same source from appearing twice", () => {
    expect(() => buildInvoiceDraft({ organizationId: "org-1", orderId: "order-1", idempotencyKey: "idem-1", sources: [source, source] })).toThrow(/Duplicate/);
  });

  it("rejects already invoiced sources", () => {
    expect(() => buildInvoiceDraft({ organizationId: "org-1", orderId: "order-1", idempotencyKey: "idem-1", sources: [{ ...source, billingStatus: "INVOICED" }] })).toThrow(/not available/);
  });

  it("supports partial and overpayment balances", () => {
    expect(remainingAmount(nok(10_000), nok(4_000)).amountOre).toBe(6_000);
    expect(remainingAmount(nok(10_000), nok(12_000)).amountOre).toBe(0);
  });
});
