export type CheckSeverity = "BLOCKING" | "WARNING" | "INFO";

export type FinishJobCheck = Readonly<{
  severity: CheckSeverity;
  code: string;
  title: string;
  description: string;
  relatedEntityType: "ORDER" | "TIME_ENTRY" | "ORDER_ITEM" | "ATTACHMENT";
  relatedEntityId: string;
  canOverride: boolean;
}>;

export type FinishJobFacts = Readonly<{
  orderId: string;
  descriptionLength: number;
  billableEntryCount: number;
  hasBeforeImage: boolean;
  hasAfterImage: boolean;
  unattachedReceiptCount: number;
}>;

export function runFinishJobChecks(facts: FinishJobFacts): FinishJobCheck[] {
  const checks: FinishJobCheck[] = [];
  if (facts.billableEntryCount === 0) {
    checks.push({ severity: "BLOCKING", code: "NO_BILLABLE_ENTRIES", title: "Ingen fakturerbare poster", description: "Registrer timer eller linjer før jobben ferdigstilles.", relatedEntityType: "ORDER", relatedEntityId: facts.orderId, canOverride: false });
  }
  if (facts.descriptionLength < 24) {
    checks.push({ severity: "WARNING", code: "SHORT_WORK_DESCRIPTION", title: "Kort arbeidsbeskrivelse", description: "En mer utfyllende beskrivelse gir kunden bedre dokumentasjon.", relatedEntityType: "ORDER", relatedEntityId: facts.orderId, canOverride: true });
  }
  if (!facts.hasAfterImage) {
    checks.push({ severity: "WARNING", code: "MISSING_AFTER_IMAGE", title: "Mangler etter-bilde", description: "Legg til et bilde av ferdig resultat hvis det er relevant.", relatedEntityType: "ORDER", relatedEntityId: facts.orderId, canOverride: true });
  }
  if (facts.hasBeforeImage && facts.hasAfterImage) {
    checks.push({ severity: "INFO", code: "BEFORE_AFTER_COMPLETE", title: "Før og etter dokumentert", description: "Arbeidsrapporten kan vise bildene side om side.", relatedEntityType: "ORDER", relatedEntityId: facts.orderId, canOverride: false });
  }
  if (facts.unattachedReceiptCount > 0) {
    checks.push({ severity: "WARNING", code: "UNATTACHED_RECEIPT", title: "Kvittering uten utlegg", description: `${facts.unattachedReceiptCount} kvittering(er) er ikke knyttet til et fakturerbart utlegg.`, relatedEntityType: "ORDER", relatedEntityId: facts.orderId, canOverride: true });
  }
  return checks;
}
