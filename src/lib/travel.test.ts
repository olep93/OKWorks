import { describe, expect, it } from "vitest";
import { activeHotel, hotelStay, parseTollInfo, validDate } from "./travel";
import { formatDate, formatMoney, formatQuantity } from "./format";
import { checkInvoicePreflight } from "./invoice-preflight";
const stay = { hotelAddress: "Hotellgata 1", startDate: "2026-09-17", endDate: "2026-09-20" };
describe("hotel periods", () => {
  it("validates real calendar dates and ordered periods", () => {
    expect(validDate("2026-02-31")).toBe(false);
    expect(hotelStay({ ...stay, endDate: "2026-09-16" })).toBeNull();
    expect(hotelStay(stay)).toEqual(stay);
  });
  it("uses hotel on arrival, during stay and departure, not outside", () => {
    for (const date of ["2026-09-17", "2026-09-18", "2026-09-20"]) expect(activeHotel([{ metadata: stay }], date)).toEqual(stay);
    expect(activeHotel([{ metadata: stay }], "2026-09-21")).toBeNull();
    expect(activeHotel([{ metadata: stay }, { metadata: stay }], "2026-09-18")).toBeNull();
  });
});
describe("toll prices", () => {
  it("keeps unknown prices distinct from explicit zero", () => {
    expect(parseTollInfo(undefined)).toEqual({ tollKnown: false, tollOre: null });
    expect(parseTollInfo({ estimatedPrice: [{ currencyCode: "USD", units: "10" }] }).tollOre).toBeNull();
    expect(parseTollInfo({ estimatedPrice: [{ currencyCode: "NOK" }] })).toEqual({ tollKnown: true, tollOre: 0 });
  });
  it("converts decimal API money to integer ore", () => expect(parseTollInfo({ estimatedPrice: [{ currencyCode: "NOK", units: "123", nanos: 450000000 }] }).tollOre).toBe(12345));
  it("prevents finalizing hotel travel with unreviewed tolls", () => {
    const result = checkInvoicePreflight({ status: "DRAFT", totalOre: 100, lineCount: 1, organization: { name: "Firma", organizationNumber: "123456789", bankAccount: "15034567890" }, customer: { name: "Kunde", address: "Gate 1" }, unresolvedTollCount: 2 });
    expect(result.canFinalize).toBe(false);
    expect(result.errors.some((error) => error.includes("bompenger"))).toBe(true);
  });
});
it("formats Norwegian money, quantities and dates consistently", () => {
  expect(formatMoney(123456750).replace(/\u00a0/g, " ")).toBe("1 234 567,50 kr");
  expect(formatQuantity(1.23456)).toBe("1,235");
  expect(formatDate("2026-09-17")).toBe("17.09.2026");
});
