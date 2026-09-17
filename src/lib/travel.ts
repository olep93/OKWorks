export type HotelStay = { hotelAddress: string; startDate: string; endDate: string };
export function validDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
export function hotelStay(metadata: unknown): HotelStay | null {
  if (!metadata || typeof metadata !== "object") return null;
  const value = metadata as Record<string, unknown>;
  return typeof value.hotelAddress === "string" && value.hotelAddress.trim().length >= 3 && typeof value.startDate === "string" && validDate(value.startDate) && typeof value.endDate === "string" && validDate(value.endDate) && value.endDate >= value.startDate
    ? { hotelAddress: value.hotelAddress.trim(), startDate: value.startDate, endDate: value.endDate } : null;
}
export function activeHotel(stays: Array<{ metadata: unknown }>, date: string) {
  const matches = stays.map((row) => hotelStay(row.metadata)).filter((stay): stay is HotelStay => Boolean(stay && stay.startDate <= date && stay.endDate >= date));
  return matches.length === 1 ? matches[0] : null;
}
export const fullAddress = (value: { address?: string | null; postalCode?: string | null; city?: string | null }) => [value.address, value.postalCode, value.city].filter(Boolean).join(", ");
export function parseTollInfo(info: { estimatedPrice?: Array<{ currencyCode?: string; units?: string | number; nanos?: number }> } | undefined) {
  const price = info?.estimatedPrice?.find((item) => item.currencyCode === "NOK");
  const amount = price ? Math.round(Number(price.units ?? 0) * 100 + Number(price.nanos ?? 0) / 10_000_000) : null;
  const tollKnown = amount !== null && Number.isSafeInteger(amount) && amount >= 0;
  return { tollOre: tollKnown ? amount : null, tollKnown };
}
