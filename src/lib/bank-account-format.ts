export function formatBankAccount(value: unknown): string {
  if (typeof value !== "string") return "";
  const digits = value.replace(/[\s.]/g, "");
  return /^\d{11}$/.test(digits) ? `${digits.slice(0, 4)} ${digits.slice(4, 6)} ${digits.slice(6)}` : value.trim();
}
