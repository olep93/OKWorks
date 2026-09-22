export type InvoiceArchiveStatus = {
  status: string;
  dueDate?: string | Date | null;
  sentAt?: string | Date | null;
};

export function invoiceArchiveLabel(invoice: InvoiceArchiveStatus, now = new Date()) {
  if (invoice.status === "PAID") return "Betalt";
  if (invoice.status === "PARTIALLY_PAID") return "Delbetalt";
  if (invoice.status === "DRAFT") return "Utkast";
  if (invoice.dueDate && new Date(invoice.dueDate).getTime() < now.getTime()) return "Forfalt";
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
