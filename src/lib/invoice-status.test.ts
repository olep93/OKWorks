import { describe, expect, it } from "vitest";
import { invoiceArchiveLabel, invoiceArchiveTone, invoiceDetailState } from "./invoice-status";

const now = new Date("2026-09-22T12:00:00Z");

describe("invoice archive status", () => {
  it("distinguishes drafts, finalized invoices and sent invoices", () => {
    expect(invoiceArchiveLabel({ status: "DRAFT" }, now)).toBe("Utkast");
    expect(invoiceArchiveLabel({ status: "FINALIZED", dueDate: "2026-10-01" }, now)).toBe("Finalisert – ikke sendt");
    expect(invoiceArchiveLabel({ status: "SENT", dueDate: "2026-10-01", sentAt: "2026-09-22" }, now)).toBe("Sendt – ikke betalt");
  });

  it("prioritizes payment and overdue state", () => {
    expect(invoiceArchiveLabel({ status: "PAID", dueDate: "2026-09-01" }, now)).toBe("Betalt");
    expect(invoiceArchiveLabel({ status: "PARTIALLY_PAID", dueDate: "2026-09-01" }, now)).toBe("Delbetalt");
    expect(invoiceArchiveLabel({ status: "SENT", dueDate: "2026-09-01", sentAt: "2026-08-20" }, now)).toBe("Forfalt");
  });

  it("maps archive labels to stable visual tones", () => {
    expect(invoiceArchiveTone("Betalt")).toBe("betalt");
    expect(invoiceArchiveTone("Forfalt")).toBe("forfalt");
    expect(invoiceArchiveTone("Finalisert – ikke sendt")).toBe("ikke-sendt");
    expect(invoiceArchiveTone("Sendt – ikke betalt")).toBe("ikke-betalt");
  });

  it("keeps invoices current for the entire Norwegian due date", () => {
    const invoice = { status: "SENT", dueDate: "2026-09-22" };
    expect(invoiceArchiveLabel(invoice, new Date("2026-09-22T21:59:59Z"))).toBe("Sendt – ikke betalt");
    expect(invoiceArchiveLabel(invoice, new Date("2026-09-22T22:00:00Z"))).toBe("Forfalt");
  });

  it("does not label unsent or cancelled invoices as overdue", () => {
    expect(invoiceArchiveLabel({ status: "FINALIZED", dueDate: "2026-01-01" }, now)).toBe("Finalisert – ikke sendt");
    expect(invoiceArchiveLabel({ status: "VOID", dueDate: "2026-01-01" }, now)).toBe("Annullert");
    expect(invoiceArchiveLabel({ status: "CREDITED", dueDate: "2026-01-01" }, now)).toBe("Kreditert");
  });
});

describe("invoice detail presentation", () => {
  it.each(["PAID", "CREDITED", "VOID", "DRAFT", "UNKNOWN"])("does not offer payment or reminders for %s", (status) => {
    const state = invoiceDetailState({ status, sentAt: "2026-09-22" });
    expect(state.canRecordPayment).toBe(false);
    expect(state.canSend).toBe(false);
    expect(state.canRemind).toBe(false);
    expect(state.description).not.toContain("venter på betaling");
  });
  it("shows a paid invoice as paid even when it has an earlier sent date", () => {
    expect(invoiceDetailState({ status: "PAID", sentAt: "2026-09-22" }).title).toBe("Betalt faktura");
  });
  it("makes partial payment explicit and keeps follow-up actions available", () => {
    expect(invoiceDetailState({ status: "PARTIALLY_PAID", sentAt: "2026-09-22" })).toMatchObject({ title: "Delbetalt faktura", canRecordPayment: true, canRemind: true });
  });
  it("does not offer reminders for an unsent finalized invoice", () => {
    expect(invoiceDetailState({ status: "FINALIZED" })).toMatchObject({ title: "Finalisert faktura", canRecordPayment: true, canSend: true, canRemind: false });
  });
  it("allows reminders for sent invoices", () => {
    expect(invoiceDetailState({ status: "SENT" })).toMatchObject({ title: "Sendt faktura", canSend: true, canRemind: true });
  });
});
