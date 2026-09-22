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
  it("paginates long descriptions and large formatted totals", async () => {
    const many = Array.from({ length: 25 }, () => ({ ...lines[0], description: "Utført arbeid med dokumentasjon og materialer. ".repeat(8), subtotalOre: 123456750 }));
    const bytes = await buildInvoicePdf({ ...invoice, subtotalOre: 3086418750, vatAmountOre: 771604688, totalOre: 3858023438 }, many);
    const pdf = await PDFDocument.load(bytes);
    expect(pdf.getPageCount()).toBeGreaterThan(2);
    expect(pdf.getPages().every((page) => page.getWidth() === 595.28)).toBe(true);
  });
  it("adds financial documentation even without images", async () => {
    const bytes = await buildInvoicePdf(invoice, lines, [], [{ kind: "HOTEL", title: "Hotell", description: "Opphold", workDate: "2026-09-17", fileName: null, mimeType: null, fileData: null, amountOre: 10000, metadata: { hotelAddress: "Gate 1", startDate: "2026-09-17", endDate: "2026-09-20" } }]);
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(2);
  });
  it("builds one complete appendix with travel, expenses, images and a source PDF", async () => {
    const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"));
    const source = await PDFDocument.create();
    source.addPage([300, 400]);
    const sourcePdf = await source.save();
    const registrations = [
      { kind: "IMAGE", title: "Før arbeid", description: "Kontrollbilde før oppstart", workDate: "2026-09-15", fileName: "for.png", mimeType: "image/png", fileData: png, amountOre: 0, metadata: {} },
      { kind: "EXPENSE", title: "Materiellutlegg", description: "Kvittering vedlagt", workDate: "2026-09-15", fileName: "kvittering.png", mimeType: "image/png", fileData: png, amountOre: 25000, metadata: {} },
      { kind: "HOTEL", title: "Hotell", description: "To netter", workDate: "2026-09-15", fileName: "hotell.png", mimeType: "image/png", fileData: png, amountOre: 240000, metadata: { hotelAddress: "Hotellveien 1", startDate: "2026-09-15", endDate: "2026-09-17" } },
      { kind: "DRIVING", title: "Utreise", description: "Kundebesøk", workDate: "2026-09-15", fileName: null, mimeType: null, fileData: null, amountOre: 72000, quantityThousandths: 120000, unit: "km", unitRateOre: 600, metadata: { origin: "Firmaadresse 1", destination: "Kundeadresse 2", tollOre: 4800, tollInputGross: true } },
      { kind: "DIET", title: "Diett", description: "Dagsats", workDate: "2026-09-15", fileName: null, mimeType: null, fileData: null, amountOre: 45000, metadata: {} },
      { kind: "DOCUMENT", title: "Arbeidsrapport", description: "Signert rapport", workDate: "2026-09-17", fileName: "rapport.pdf", mimeType: "application/pdf", fileData: sourcePdf, amountOre: 0, metadata: {} },
    ];
    const bytes = await buildInvoicePdf(invoice, lines, registrations.filter((item): item is typeof item & { fileData: Uint8Array } => Boolean(item.fileData)).map((item) => ({ title: item.title, description: item.description, workDate: item.workDate, fileName: item.fileName, mimeType: item.mimeType, fileData: item.fileData })), registrations);
    const result = await PDFDocument.load(bytes);
    expect(result.getPageCount()).toBeGreaterThanOrEqual(3);
    expect(result.getTitle()).toBe("Faktura 1001");
    expect(result.getCreator()).toBe("OKFaktura");
  });
});
