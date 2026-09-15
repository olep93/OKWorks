type Snapshot = Record<string, unknown> | null;

export type InvoicePreflight = {
  canFinalize: boolean;
  errors: string[];
  warnings: string[];
};

export function checkInvoicePreflight(input: {
  status: string;
  totalOre: number;
  organization: Snapshot;
  customer: Snapshot;
  lineCount: number;
  documentationCount?: number;
}): InvoicePreflight {
  const errors: string[] = [];
  const warnings: string[] = [];
  const organization = input.organization ?? {};
  const customer = input.customer ?? {};
  const present = (value: unknown) => typeof value === "string" && value.trim().length > 0;

  if (input.status !== "DRAFT") errors.push("Fakturaen er allerede låst og kan ikke finaliseres på nytt.");
  if (!present(organization.name)) errors.push("Firmanavn mangler i firmaprofilen.");
  if (!present(organization.organizationNumber)) errors.push("Organisasjonsnummer mangler i firmaprofilen.");
  if (!present(organization.bankAccount)) errors.push("Bankkonto mangler i firmaprofilen.");
  if (!present(customer.name)) errors.push("Kunden mangler navn.");
  if (!present(customer.address)) errors.push("Kunden mangler fakturaadresse.");
  if (input.lineCount < 1) errors.push("Fakturaen må ha minst én fakturalinje.");
  if (input.totalOre <= 0) errors.push("Fakturabeløpet må være større enn 0 kr.");

  if (!present(customer.organizationNumber)) warnings.push("Kundens organisasjonsnummer er ikke registrert.");
  if (!present(customer.email)) warnings.push("Kundens e-post er ikke registrert.");
  if (!present(organization.invoiceEmail) && !present(organization.email)) warnings.push("Firmaets e-post vises ikke på fakturaen.");
  if (!present(organization.invoicePhone) && !present(organization.phone)) warnings.push("Firmaets telefon vises ikke på fakturaen.");
  if (!input.documentationCount) warnings.push("Ordren har ingen bilde- eller dokumentvedlegg.");

  return { canFinalize: errors.length === 0, errors, warnings };
}
