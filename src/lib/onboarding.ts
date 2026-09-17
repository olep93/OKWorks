type Organization = {
  name?: string | null; organizationNumber?: string | null;
  email?: string | null; invoiceEmail?: string | null;
  address?: string | null; postalCode?: string | null; city?: string | null;
  bankAccount?: string | null; defaultHourlyRateOre?: number | null;
};

// Completeness only: not a legal, bank-account or organization identity check.
export function organizationOnboarding(organization?: Organization) {
  const present = (value?: string | null) => Boolean(value?.trim());
  const checks = [
    { label: "Firmanavn", complete: present(organization?.name) },
    { label: "Organisasjonsnummer", complete: present(organization?.organizationNumber) },
    { label: "E-post på faktura", complete: present(organization?.invoiceEmail) || present(organization?.email) },
    { label: "Gateadresse", complete: present(organization?.address) },
    { label: "Postnummer", complete: present(organization?.postalCode) },
    { label: "Poststed", complete: present(organization?.city) },
    { label: "Bankkontonummer", complete: present(organization?.bankAccount) },
    { label: "Standard timesats", complete: organization?.defaultHourlyRateOre !== null && organization?.defaultHourlyRateOre !== undefined },
  ];
  const completed = checks.filter((check) => check.complete).length;
  return { complete: completed === checks.length, completed, total: checks.length, missing: checks.filter((check) => !check.complete).map((check) => check.label) };
}
