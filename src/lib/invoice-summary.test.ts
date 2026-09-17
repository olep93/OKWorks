import { describe, expect, it } from "vitest";
import { summarizeInvoiceLines, drivingInvoiceAmounts } from "./invoice-summary";
const base = { description: "Adresse og detaljer", quantityThousandths: 10000, unit: "km", unitPriceOre: 500, subtotalOre: 5000, vatBasisPoints: 2500 };
describe("invoice summary", () => {
  it("keeps gross toll exactly unchanged on the customer invoice", () => {
    expect(drivingInvoiceAmounts(15000, 10000, 2500)).toEqual({ subtotalOre: 13000, vatAmountOre: 3250, totalOre: 16250 });
    expect(drivingInvoiceAmounts(101, 101, 2500).totalOre).toBe(101);
    expect(drivingInvoiceAmounts(15000, 10000, 0).totalOre).toBe(15000);
  });
  it("groups travel without changing source data or totals", () => {
    const lines = [{ ...base, lineType: "DRIVING" }, { ...base, lineType: "DRIVING" }];
    const result = summarizeInvoiceLines(lines);
    expect(result).toHaveLength(1);
    expect(result[0].subtotalOre).toBe(10000);
    expect(result[0].description).toBe("Kjøring i km, bompenger og ferje");
    expect(lines[0].subtotalOre).toBe(5000);
  });
  it("keeps different VAT rates separate and preserves ordinary work lines", () => {
    expect(summarizeInvoiceLines([{ ...base, lineType: "HOTEL" }, { ...base, lineType: "HOTEL", vatBasisPoints: 1200 }, { ...base, lineType: "LINE" }])).toHaveLength(3);
  });
});
