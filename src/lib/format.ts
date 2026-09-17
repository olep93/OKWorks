export const formatMoney = (ore: number) => `${(ore / 100).toLocaleString("nb-NO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;
export const formatQuantity = (value: number) => value.toLocaleString("nb-NO", { maximumFractionDigits: 3 });
export const formatDate = (value: Date | string | null) => value ? new Date(value).toLocaleDateString("nb-NO", { day: "2-digit", month: "2-digit", year: "numeric" }) : "-";
export function localDate() {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("-");
}
