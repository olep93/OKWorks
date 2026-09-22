import { describe, expect, it } from "vitest";
import { sandboxBillingConfig, subscriptionStatus, validateSandboxPrice } from "./subscription-policy";
const config = { BILLING_MODE: "test", STRIPE_SECRET_KEY: "sk_test_fake", STRIPE_TEST_PRICE_ID: "price_test", APP_URL: "https://ok-works.vercel.app" };
const price = { livemode: false, active: true, currency: "nok", unit_amount: 9900, tax_behavior: "inclusive", recurring: { interval: "month", interval_count: 1 } };
describe("sandbox billing safety", () => {
  it("is disabled by default", () => { expect(() => sandboxBillingConfig({})).toThrow(); });
  it("rejects live keys even in test mode", () => { expect(() => sandboxBillingConfig({ ...config, STRIPE_SECRET_KEY: "sk_live_fake" })).toThrow(); });
  it("rejects live mode even with test keys", () => { expect(() => sandboxBillingConfig({ ...config, BILLING_MODE: "live" })).toThrow(); });
  it("uses a fixed HTTPS origin", () => { expect(sandboxBillingConfig(config).base).toBe("https://ok-works.vercel.app"); expect(() => sandboxBillingConfig({ ...config, APP_URL: "https://evil@example.no" })).toThrow(); });
  it("requires exactly 99 NOK inclusive monthly", () => {
    expect(() => validateSandboxPrice(price)).not.toThrow();
    for (const invalid of [{ livemode: true }, { unit_amount: 990 }, { tax_behavior: "exclusive" }, { currency: "eur" }, { recurring: { interval: "year", interval_count: 1 } }]) expect(() => validateSandboxPrice({ ...price, ...invalid })).toThrow();
  });
  it("maps unpaid and expired states without granting active status", () => { expect(subscriptionStatus("unpaid")).toBe("SUSPENDED"); expect(subscriptionStatus("incomplete_expired")).toBe("CANCELED"); expect(subscriptionStatus("future-unknown")).toBe("INCOMPLETE"); });
});
