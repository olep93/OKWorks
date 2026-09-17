import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

type Snapshot = Record<string, unknown>;
type Line = { description: string; quantityThousandths: number; unit: string; unitPriceOre: number; subtotalOre: number; vatBasisPoints: number };
type Attachment = { title: string; description: string | null; workDate: Date | string; fileName: string | null; mimeType: string | null; fileData: Uint8Array };
type Registration = Omit<Attachment, "fileData"> & { fileData: Uint8Array | null; kind: string; amountOre?: number; quantityThousandths?: number | null; unit?: string | null; unitRateOre?: number | null };
type Invoice = { invoiceNumber: number | null; status: string; issueDate: Date | string | null; dueDate: Date | string | null; subtotalOre: number; vatAmountOre: number; totalOre: number; currency: string; organizationSnapshot: unknown; customerSnapshot: unknown; bankAccountSnapshot: string | null };

const asText = (value: unknown) => typeof value === "string" ? value : "";
const money = (ore: number) => `${(ore / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;
const date = (value: Date | string | null) => value ? new Date(value).toLocaleDateString("nb-NO") : "—";

export async function buildInvoicePdf(invoice: Invoice, lines: Line[], attachments: Attachment[] = [], registrations: Registration[] = attachments.map((item) => ({ ...item, kind: item.mimeType === "application/pdf" ? "DOCUMENT" : "IMAGE" }))) {
  const pdf = await PDFDocument.create();
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const company = (invoice.organizationSnapshot ?? {}) as Snapshot;
  const customer = (invoice.customerSnapshot ?? {}) as Snapshot;
  const logoData = asText(company.logoStorageKey);
  const logo = logoData.startsWith("data:image/png;base64,")
    ? await pdf.embedPng(logoData)
    : logoData.startsWith("data:image/jpeg;base64,")
      ? await pdf.embedJpg(logoData)
      : null;
  const forest = rgb(0.055, 0.22, 0.16), muted = rgb(0.36, 0.42, 0.39), line = rgb(0.87, 0.9, 0.88), lime = rgb(0.72, 0.94, 0.34);
  const width = 595.28, height = 841.89, margin = 48;
  let page = pdf.addPage([width, height]);
  let y = height - margin;

  const drawText = (text: string, x: number, yy: number, size = 10, useBold = false, color = forest) => page.drawText(text.replace(/[–—]/g, "-"), { x, y: yy, size, font: useBold ? bold : regular, color });
  const drawHeader = () => {
    if (logo) {
      const scale = Math.min(265 / logo.width, 40 / logo.height);
      page.drawImage(logo, { x: margin, y: height - 85, width: logo.width * scale, height: logo.height * scale });
    } else {
    page.drawRectangle({ x: margin, y: height - 82, width: 34, height: 34, color: lime });
    drawText("OK", margin + 8, height - 70, 11, true);
    drawText(asText(company.name) || "Ditt firma", margin + 45, height - 63, 15, true);
    }
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
  if ((invoice as Invoice & { kid?: string | null }).kid) drawText(`KID ${(invoice as Invoice & { kid?: string | null }).kid}`, margin, 69, 9, true);
  const contact = [asText(company.invoiceEmail) || asText(company.email), asText(company.invoicePhone) || asText(company.phone)].filter(Boolean).join("  |  ");
  drawText(contact, margin, 55, 8, false, muted);
  drawText(company.organizationNumber ? `Org.nr. ${asText(company.organizationNumber)}` : "", width - margin - 115, 55, 8, false, muted);

  if (registrations.length) {
    const appendixPage = () => {
      page = pdf.addPage([width, height]);
      drawText("FAKTURAVEDLEGG", margin, height - 65, 18, true);
      drawText(invoice.invoiceNumber ? `Grunnlag og dokumentasjon til faktura #${invoice.invoiceNumber}` : "Grunnlag og dokumentasjon til fakturautkast", margin, height - 86, 9, false, muted);
      page.drawLine({ start: { x: margin, y: height - 103 }, end: { x: width - margin, y: height - 103 }, thickness: 2, color: forest });
      return height - 140;
    };
    let appendixY = appendixPage();
    drawText("ARBEIDSGRUNNLAG", margin, appendixY, 8, true, muted); appendixY -= 25;
    lines.forEach((item) => {
      if (appendixY < 105) { appendixY = appendixPage(); drawText("ARBEIDSGRUNNLAG, FORTSETTELSE", margin, appendixY, 8, true, muted); appendixY -= 25; }
      drawText(item.description.slice(0, 65), margin, appendixY, 9, true);
      drawText(`${(item.quantityThousandths / 1000).toLocaleString("nb-NO")} ${item.unit}  |  ${money(item.subtotalOre)}`, margin, appendixY - 15, 8, false, muted);
      appendixY -= 39;
    });
    const sections = [
      { name: "BILDER OG DOKUMENTASJON", kinds: ["IMAGE", "DOCUMENT"] },
      { name: "UTLEGG", kinds: ["EXPENSE"] },
      { name: "HOTELL", kinds: ["HOTEL"] },
      { name: "KJØRING", kinds: ["DRIVING"] },
      { name: "DIETT", kinds: ["DIET"] },
    ];
    const wrap = (text: string, size: number) => {
      const rows: string[] = [];
      let current = "";
      for (const char of text.replace(/[–—]/g, "-")) {
        if (char === "\n" || regular.widthOfTextAtSize(current + char, size) > width - margin * 2) {
          rows.push(current); current = char === "\n" ? "" : char;
        } else current += char;
      }
      if (current) rows.push(current);
      return rows;
    };
    for (const section of sections) {
      const items = registrations.filter((item) => section.kinds.includes(item.kind));
      if (!items.length) continue;
      const heading = (continuation = false) => {
        drawText(section.name + (continuation ? " - FORTSETTELSE" : ""), margin, appendixY, 10, true, muted);
        appendixY -= 27;
      };
      const ensureSpace = (required: number) => {
        if (appendixY - required < 65) { appendixY = appendixPage(); heading(true); }
      };
      for (const [index, item] of items.entries()) {
        const image = item.fileData && item.mimeType?.startsWith("image/")
          ? item.mimeType === "image/png" ? await pdf.embedPng(item.fileData) : await pdf.embedJpg(item.fileData)
          : null;
        const scale = image ? Math.min((width - margin * 2) / image.width, 300 / image.height, 1) : 0;
        const imageHeight = image ? image.height * scale : 0;
        const titleRows = wrap(`${index + 1}. ${item.title}`, 11);
        const requiredSpace = titleRows.length * 15 + 45 + imageHeight + (item.description ? 35 : 0);
        if (index === 0) {
          if (appendixY - requiredSpace - 27 < 65) appendixY = appendixPage();
          heading();
        } else ensureSpace(requiredSpace);
        for (const title of titleRows) { drawText(title, margin, appendixY, 11, true); appendixY -= 15; }
        const detail = [date(item.workDate), item.fileName, item.amountOre != null && !["IMAGE", "DOCUMENT"].includes(item.kind) ? `${money(item.amountOre)} eks. MVA` : ""].filter(Boolean).join("  |  ");
        for (const text of wrap(detail, 8)) { drawText(text, margin, appendixY, 8, false, muted); appendixY -= 12; }
        if (item.kind === "DRIVING" && item.quantityThousandths != null) {
          drawText(`${(item.quantityThousandths / 1000).toLocaleString("nb-NO")} ${item.unit || "km"}  |  ${money(item.unitRateOre ?? 0)} per ${item.unit || "km"}`, margin, appendixY, 9); appendixY -= 16;
        }
        if (image) {
          appendixY -= 8;
          page.drawImage(image, { x: margin, y: appendixY - imageHeight, width: image.width * scale, height: imageHeight });
          appendixY -= imageHeight + 18;
        }
        if (item.description) for (const text of wrap(item.description, 9)) {
          ensureSpace(14); drawText(text, margin, appendixY, 9); appendixY -= 14;
        }
        appendixY -= 22;
        if (item.fileData && item.mimeType === "application/pdf") {
          const source = await PDFDocument.load(item.fileData);
          const copied = await pdf.copyPages(source, source.getPageIndices());
          copied.forEach((copiedPage) => pdf.addPage(copiedPage));
          appendixY = 0;
        }
      }
    }
  }

  const pages = pdf.getPages();
  pages.forEach((pdfPage, index) => pdfPage.drawText(`Side ${index + 1} av ${pages.length}`, { x: width / 2 - 22, y: 30, size: 7, font: regular, color: muted }));
  pdf.setTitle(invoice.invoiceNumber ? `Faktura ${invoice.invoiceNumber}` : "Fakturautkast");
  pdf.setCreator("OK Works");
  return pdf.save();
}
