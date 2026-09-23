export type InvoiceArchiveStatus = {
  status: string;
  dueDate?: string | Date | null;
  sentAt?: string | Date | null;
};

export function invoiceDetailState(invoice: Pick<InvoiceArchiveStatus, "status" | "sentAt">) {
  const sent = invoice.status === "SENT" || Boolean(invoice.sentAt);
  const open = ["FINALIZED", "SENT", "PARTIALLY_PAID", "OVERDUE"].includes(invoice.status);
  const descriptions: Record<string, [string, string]> = {
    DRAFT: ["Fakturautkast", "Kontroller opplysningene før fakturanummeret låses."],
    PAID: ["Betalt faktura", "Fakturaen er registrert som fullt betalt."],
    PARTIALLY_PAID: ["Delbetalt faktura", "En del av beløpet er registrert betalt. Se gjenstående beløp og betalingshistorikk nedenfor."],
    CREDITED: ["Kreditert faktura", "Fakturaen er kreditert og skal ikke følges opp som ubetalt."],
    VOID: ["Annullert faktura", "Fakturaen er annullert og skal ikke betales."],
    OVERDUE: ["Forfalt faktura", "Fakturaen har et utestående beløp etter forfall."],
  };
  const [title, description] = descriptions[invoice.status] ?? (open
    ? sent ? ["Sendt faktura", "Fakturaen er sendt og venter på betaling."] : ["Finalisert faktura", "Fakturaen er låst og klar for utsending."]
    : ["Faktura", "Kontroller fakturaens status før videre behandling."]);
  return { title, description, canSend: open, canRemind: open && sent, canRecordPayment: open };
}

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
