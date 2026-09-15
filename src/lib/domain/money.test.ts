import { describe, expect, it } from "vitest";
import { calculateLine, formatNok, nok, percent } from "./money";

describe("money", () => {
  it("keeps amounts in integer øre", () => {
    expect(() => nok(10.5)).toThrow(/integer/);
  });

  it("calculates quantity and VAT deterministically", () => {
    const result = calculateLine({
      unitPriceOre: 79_000,
      quantityThousandths: 5_500,
      vatBasisPoints: 2_500,
    });
    expect(result.subtotal.amountOre).toBe(434_500);
    expect(result.vat.amountOre).toBe(108_625);
    expect(result.total.amountOre).toBe(543_125);
  });

  it("rounds basis points to nearest øre", () => {
    expect(percent(nok(14_900), 1_000).amountOre).toBe(1_490);
  });

  it("formats Norwegian currency", () => {
    expect(formatNok(nok(184_200))).toContain("1 842");
  });
});
