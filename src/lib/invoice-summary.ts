type SummaryLine = { description: string; lineType?: string; quantityThousandths: number; unit: string; unitPriceOre: number; subtotalOre: number; vatBasisPoints: number };
const labels: Record<string, string> = { DRIVING: "Kjøring i km, bompenger og ferje", HOTEL: "Hotell", DIET: "Diett", PER_DIEM: "Diett", EXPENSE: "Utlegg" };

export function drivingInvoiceAmounts(amountOre: number, tollOre: number, vatBasisPoints: number) {
  const mileageNet = amountOre - tollOre;
  const tollNet = Math.round(tollOre * 10000 / (10000 + vatBasisPoints));
  const vatAmountOre = Math.round(mileageNet * vatBasisPoints / 10000) + tollOre - tollNet;
  return { subtotalOre: mileageNet + tollNet, vatAmountOre, totalOre: mileageNet + tollNet + vatAmountOre };
}

// Presentation only: retain every source line for editing, deletion and the appendix.
export function summarizeInvoiceLines<T extends SummaryLine>(lines: T[]): SummaryLine[] {
  const result: SummaryLine[] = [];
  const groups = new Map<string, SummaryLine>();
  for (const line of lines) {
    const label = labels[line.lineType ?? ""];
    if (!label) { result.push(line); continue; }
    const key = `${line.lineType}:${line.vatBasisPoints}`;
    let group = groups.get(key);
    if (!group) {
      group = { ...line, description: label, quantityThousandths: 1000, unit: "samlet", unitPriceOre: 0, subtotalOre: 0 };
      groups.set(key, group); result.push(group);
    }
    group.subtotalOre += line.subtotalOre;
    group.unitPriceOre = group.subtotalOre;
  }
  return result;
}
