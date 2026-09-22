export const SUBSCRIPTION_PRICE_ORE = 9900;
export const SANDBOX_TERMS_VERSION = "sandbox-v1-no-binding";

export function sandboxBillingConfig(env: Record<string, string | undefined> = process.env) {
  if (env.BILLING_MODE !== "test" || !env.STRIPE_SECRET_KEY?.startsWith("sk_test_") || !env.STRIPE_TEST_PRICE_ID || !env.APP_URL) throw new Error("BILLING_DISABLED");
  const url = new URL(env.APP_URL);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("BILLING_DISABLED");
  return { key: env.STRIPE_SECRET_KEY, priceId: env.STRIPE_TEST_PRICE_ID, base: url.origin };
}

export function validateSandboxPrice(price: { livemode: boolean; active: boolean; currency: string; unit_amount: number | null; tax_behavior?: string | null; recurring?: { interval: string; interval_count: number } | null }) {
  if (price.livemode || !price.active || price.currency !== "nok" || price.unit_amount !== SUBSCRIPTION_PRICE_ORE || price.recurring?.interval !== "month" || price.recurring.interval_count !== 1 || price.tax_behavior !== "inclusive") throw new Error("INVALID_TEST_PRICE");
}

export function subscriptionStatus(status: string) {
  switch (status) {
    case "active": return "ACTIVE";
    case "trialing": return "TRIAL";
    case "past_due": return "PAST_DUE";
    case "canceled": case "incomplete_expired": return "CANCELED";
    case "unpaid": case "paused": return "SUSPENDED";
    default: return "INCOMPLETE";
  }
}
