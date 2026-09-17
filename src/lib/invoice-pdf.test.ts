import { PDFDocument, PDFName, PDFDict } from "pdf-lib";
import { describe, expect, it } from "vitest";
import { buildInvoicePdf } from "./invoice-pdf";

const invoice = {
  invoiceNumber: 1001, status: "FINALIZED", issueDate: "2026-09-15", dueDate: "2026-09-29", currency: "NOK",
  subtotalOre: 10000, vatAmountOre: 2500, totalOre: 12500,
  organizationSnapshot: { name: "OK Works", organizationNumber: "999888777", bankAccount: "1503.45.67890" },
  customerSnapshot: { name: "Kunde AS", address: "Kundegata 1" }, bankAccountSnapshot: "1503.45.67890",
};
const lines = [{ description: "Arbeid", quantityThousandths: 1000, unit: "time", unitPriceOre: 10000, subtotalOre: 10000, vatBasisPoints: 2500 }];

describe("invoice PDF", () => {
  it("embeds the company logo from the invoice snapshot", async () => {
    const logoStorageKey = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
    const bytes = await buildInvoicePdf({ ...invoice, organizationSnapshot: { ...invoice.organizationSnapshot, logoStorageKey } }, lines);
    const pdf = await PDFDocument.load(bytes);
    const images = pdf.getPage(0).node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
    expect(images?.keys().length).toBeGreaterThan(0);
    expect(pdf.getPageCount()).toBe(1);
  });
  it("adds an appendix overview and image page", async () => {
    const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
    const bytes = await buildInvoicePdf(invoice, lines, [{ title: "Ferdig arbeid", description: "Dokumentasjon", workDate: "2026-09-15", fileName: "ferdig.png", mimeType: "image/png", fileData: png }]);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });
});
