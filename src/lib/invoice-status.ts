export type InvoiceArchiveStatus = {
  status: string;
  dueDate?: string | Date | null;
  sentAt?: string | Date | null;
};

export function invoiceArchiveLabel(invoice: InvoiceArchiveStatus, now = new Date()) {
  if (invoice.status === "PAID") return "Betalt";
  if (invoice.status === "VOID") return "Annullert";
  if (invoice.status === "CREDITED") return "Kreditert";
  if (invoice.status === "PARTIALLY_PAID") return "Delbetalt";
  if (invoice.status === "DRAFT") return "Utkast";
  // A due date is a calendar day, not midnight: payment is not overdue
  // until the following day in the company's Norwegian time zone.
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Oslo" }).format(now);
  const due = invoice.dueDate instanceof Date
    ? invoice.dueDate.toISOString().slice(0, 10)
    : invoice.dueDate?.slice(0, 10);
  if ((invoice.status === "SENT" || invoice.sentAt) && due && due < today) return "Forfalt";
  if (invoice.status === "SENT" || invoice.sentAt) return "Sendt – ikke betalt";
  return "Finalisert – ikke sendt";
}

export function invoiceArchiveTone(label: string) {
  if (label === "Betalt") return "betalt";
  if (label === "Forfalt") return "forfalt";
  if (label === "Utkast") return "utkast";
  if (label === "Finalisert – ikke sendt") return "ikke-sendt";
  return "ikke-betalt";
}
