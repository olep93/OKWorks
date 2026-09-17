export function canResetInvoiceDraft(invoice: {
  status: string;
  invoiceNumber: number | null;
  finalizedAt: unknown;
  sentAt: unknown;
  paidAmountOre: number;
}) {
  return invoice.status === "DRAFT" && invoice.invoiceNumber === null && !invoice.finalizedAt && !invoice.sentAt && invoice.paidAmountOre === 0;
}
