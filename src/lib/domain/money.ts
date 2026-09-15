export type Money = Readonly<{ amountOre: number; currency: "NOK" }>;

function assertOre(amountOre: number): void {
  if (!Number.isSafeInteger(amountOre)) {
    throw new TypeError("Money must be represented as safe integer øre");
  }
}

export function nok(amountOre: number): Money {
  assertOre(amountOre);
  return { amountOre, currency: "NOK" };
}

export function add(...values: Money[]): Money {
  return nok(values.reduce((sum, value) => sum + value.amountOre, 0));
}

export function multiply(unitPrice: Money, quantityThousandths: number): Money {
  if (!Number.isSafeInteger(quantityThousandths)) {
    throw new TypeError("Quantity must use integer thousandths");
  }
  return nok(Math.round((unitPrice.amountOre * quantityThousandths) / 1000));
}

export function percent(value: Money, basisPoints: number): Money {
  if (!Number.isSafeInteger(basisPoints)) {
    throw new TypeError("Percentage must use integer basis points");
  }
  return nok(Math.round((value.amountOre * basisPoints) / 10_000));
}

export function calculateLine(input: {
  unitPriceOre: number;
  quantityThousandths: number;
  vatBasisPoints: number;
}) {
  const subtotal = multiply(nok(input.unitPriceOre), input.quantityThousandths);
  const vat = percent(subtotal, input.vatBasisPoints);
  return { subtotal, vat, total: add(subtotal, vat) } as const;
}

export function formatNok(value: Money): string {
  return new Intl.NumberFormat("nb-NO", {
    style: "currency",
    currency: value.currency,
    minimumFractionDigits: value.amountOre % 100 === 0 ? 0 : 2,
  }).format(value.amountOre / 100);
}
