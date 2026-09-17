import { describe, expect, it } from "vitest";
import { organizationOnboarding } from "./onboarding";
describe("organization onboarding", () => {
  it("lists missing setup fields", () => {
    const state = organizationOnboarding({ name: "Test" });
    expect(state.completed).toBe(1);
    expect(state.missing).toContain("Bankkontonummer");
    expect(state.missing).not.toContain("Firmanavn");
  });
  it("accepts a separate invoice contact and an explicitly zero hourly rate", () => {
    expect(organizationOnboarding({ name: "Test", organizationNumber: "123456789", invoiceEmail: "invoice@example.no", address: "Gate 1", postalCode: "0001", city: "Oslo", bankAccount: "12345678901", defaultHourlyRateOre: 0 }).complete).toBe(true);
  });
  it("does not count blank fields or a missing rate", () => {
    expect(organizationOnboarding({ name: "  ", defaultHourlyRateOre: null }).completed).toBe(0);
  });
});
