import { expect, it } from "vitest";
import { formatBankAccount } from "./bank-account-format";
it("formats Norwegian accounts without changing digits", () => {
  for (const value of ["15034567890", "1503.45.67890", "1503 45 67890"]) expect(formatBankAccount(value)).toBe("1503 45 67890");
});
it("preserves international formats and handles missing accounts", () => {
  expect(formatBankAccount("NO93 8601 1117 947")).toBe("NO93 8601 1117 947");
  expect(formatBankAccount(null)).toBe("");
});
