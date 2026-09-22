import "server-only";
import Stripe from "stripe";
import { sandboxBillingConfig } from "@/lib/subscription-policy";
export function stripeSandbox() {
  const config = sandboxBillingConfig();
  return { ...config, stripe: new Stripe(config.key, { timeout: 10000, maxNetworkRetries: 1 }) };
}
