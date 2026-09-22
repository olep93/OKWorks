import { describe, expect, it } from "vitest";
import { invoiceArchiveLabel, invoiceArchiveTone } from "./invoice-status";

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
});
