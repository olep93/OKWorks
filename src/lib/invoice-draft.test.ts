import { describe, expect, it } from "vitest";
import { canResetInvoiceDraft } from "./invoice-draft";
import { checkInvoicePreflight } from "./invoice-preflight";

const draft = { status: "DRAFT", invoiceNumber: null, finalizedAt: null, sentAt: null, paidAmountOre: 0 };

describe("draft reset protection", () => {
  it("allows an unnumbered draft", () => expect(canResetInvoiceDraft(draft)).toBe(true));
  it("rejects finalized, numbered, sent and paid invoices", () => {
    for (const changed of [{ status: "FINALIZED" }, { invoiceNumber: 1001 }, { finalizedAt: new Date() }, { sentAt: new Date() }, { paidAmountOre: 100 }]) {
      expect(canResetInvoiceDraft({ ...draft, ...changed })).toBe(false);
    }
  });
});

describe("customer type preflight", () => {
  const input = { status: "DRAFT", totalOre: 10000, organization: { name: "Firma", organizationNumber: "123456789", bankAccount: "15034567890" }, lineCount: 1 };
  it("does not ask a private customer for an organization number", () => {
    const result = checkInvoicePreflight({ ...input, customer: { type: "PRIVATE", name: "Ole", address: "Gate 1" } });
    expect(result.canFinalize).toBe(true);
    expect(result.warnings.some((warning) => warning.includes("organisasjonsnummer"))).toBe(false);
  });
  it("keeps the warning for companies and legacy snapshots", () => {
    for (const type of ["COMPANY", undefined]) {
      expect(checkInvoicePreflight({ ...input, customer: { type, name: "Firma", address: "Gate 1" } }).warnings.some((warning) => warning.includes("organisasjonsnummer"))).toBe(true);
    }
  });
});
