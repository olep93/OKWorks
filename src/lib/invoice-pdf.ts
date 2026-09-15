import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Snapshot = Record<string, unknown>;
type Line = { description: string; quantityThousandths: number; unit: string; unitPriceOre: number; subtotalOre: number; vatBasisPoints: number };
type Invoice = { invoiceNumber: number | null; status: string; issueDate: Date | string | null; dueDate: Date | string | null; subtotalOre: number; vatAmountOre: number; totalOre: number; currency: string; organizationSnapshot: unknown; customerSnapshot: unknown; bankAccountSnapshot: string | null };

const asText = (value: unknown) => typeof value === "string" ? value : "";
const money = (ore: number) => `${(ore / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;
const date = (value: Date | string | null) => value ? new Date(value).toLocaleDateString("nb-NO") : "—";

export async function buildInvoicePdf(invoice: Invoice, lines: Line[]) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const company = (invoice.organizationSnapshot ?? {}) as Snapshot;
  const customer = (invoice.customerSnapshot ?? {}) as Snapshot;
  const forest = rgb(0.055, 0.22, 0.16), muted = rgb(0.36, 0.42, 0.39), line = rgb(0.87, 0.9, 0.88), lime = rgb(0.72, 0.94, 0.34);
  const width = 595.28, height = 841.89, margin = 48;
  let page = pdf.addPage([width, height]);
  let y = height - margin;

  const drawText = (text: string, x: number, yy: number, size = 10, useBold = false, color = forest) => page.drawText(text.replace(/[–—]/g, "-"), { x, y: yy, size, font: useBold ? bold : regular, color });
  const drawHeader = () => {
    page.drawRectangle({ x: margin, y: height - 82, width: 34, height: 34, color: lime });
    drawText("OK", margin + 8, height - 70, 11, true);
    drawText(asText(company.name) || "Ditt firma", margin + 45, height - 63, 15, true);
    drawText(invoice.invoiceNumber ? `FAKTURA #${invoice.invoiceNumber}` : "FAKTURAUTKAST", width - margin - 165, height - 60, 16, true);
    if (!invoice.invoiceNumber) drawText("IKKE SENDT", width - margin - 165, height - 77, 8, true, muted);
    page.drawLine({ start: { x: margin, y: height - 99 }, end: { x: width - margin, y: height - 99 }, thickness: 2, color: forest });
    y = height - 130;
  };
  const addPage = () => { page = pdf.addPage([width, height]); drawHeader(); };
  drawHeader();

  drawText("FAKTURERES TIL", margin, y, 8, true, muted);
  drawText(asText(customer.name) || "Kunde", margin, y - 18, 11, true);
  [asText(customer.address), `${asText(customer.postalCode)} ${asText(customer.city)}`.trim(), customer.organizationNumber ? `Org.nr. ${asText(customer.organizationNumber)}` : ""].filter(Boolean).forEach((value, index) => drawText(value, margin, y - 35 - index * 14, 9, false, muted));
  drawText("Fakturadato", 365, y, 9, false, muted); drawText(date(invoice.issueDate), 472, y, 9, true);
  drawText("Forfallsdato", 365, y - 18, 9, false, muted); drawText(date(invoice.dueDate), 472, y - 18, 9, true);
  y -= 105;

  const drawTableHead = () => {
    page.drawRectangle({ x: margin, y: y - 18, width: width - margin * 2, height: 24, color: rgb(0.965, 0.975, 0.97) });
    drawText("BESKRIVELSE", margin + 6, y - 10, 7, true, muted); drawText("ANTALL", 330, y - 10, 7, true, muted); drawText("PRIS", 405, y - 10, 7, true, muted); drawText("BELØP", 496, y - 10, 7, true, muted);
    y -= 30;
  };
  drawTableHead();
  for (const item of lines) {
    if (y < 150) { addPage(); drawTableHead(); }
    const description = item.description.length > 52 ? `${item.description.slice(0, 49)}...` : item.description;
    drawText(description, margin + 6, y, 8.5);
    drawText(`${(item.quantityThousandths / 1000).toLocaleString("nb-NO")} ${item.unit}`, 330, y, 8.5);
    drawText(money(item.unitPriceOre), 405, y, 8.5);
    drawText(money(item.subtotalOre), 496, y, 8.5, true);
    page.drawLine({ start: { x: margin, y: y - 8 }, end: { x: width - margin, y: y - 8 }, thickness: .5, color: line });
    y -= 26;
  }
  if (y < 170) addPage();
  y -= 14;
  const totalsX = 350;
  drawText("Netto", totalsX, y, 9, false, muted); drawText(money(invoice.subtotalOre), 475, y, 9, true);
  drawText("MVA", totalsX, y - 20, 9, false, muted); drawText(money(invoice.vatAmountOre), 475, y - 20, 9, true);
  page.drawLine({ start: { x: totalsX, y: y - 31 }, end: { x: width - margin, y: y - 31 }, thickness: 1.5, color: forest });
  drawText("Å betale", totalsX, y - 49, 12, true); drawText(money(invoice.totalOre), 455, y - 49, 12, true);
  const account = invoice.bankAccountSnapshot || asText(company.bankAccount);
  if (account) drawText(`Betales til konto ${account}`, margin, 85, 9, true);
  const contact = [asText(company.invoiceEmail) || asText(company.email), asText(company.invoicePhone) || asText(company.phone)].filter(Boolean).join("  |  ");
  drawText(contact, margin, 55, 8, false, muted);
  drawText(company.organizationNumber ? `Org.nr. ${asText(company.organizationNumber)}` : "", width - margin - 115, 55, 8, false, muted);

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => pdfPage.drawText(`Side ${index + 1} av ${pages.length}`, { x: width / 2 - 22, y: 30, size: 7, font: regular, color: muted }));
  pdf.setTitle(invoice.invoiceNumber ? `Faktura ${invoice.invoiceNumber}` : "Fakturautkast");
  pdf.setCreator("OK Works");
  return pdf.save();
}
