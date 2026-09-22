import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ constructEvent: vi.fn(), sql: Object.assign(vi.fn(), { begin: vi.fn() }) }));
vi.mock("@/lib/stripe-sandbox", () => ({ stripeSandbox: () => ({ priceId: "price_test", stripe: { webhooks: { constructEvent: mocks.constructEvent } } }) }));
vi.mock("@/lib/db/client", () => ({ sqlClient: mocks.sql }));
import { POST } from "./route";
const request = () => new Request("https://okfaktura.no/api/subscription/webhook", { method: "POST", headers: { "stripe-signature": "test" }, body: "raw-body" });
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
describe("Stripe sandbox webhook boundary", () => {
  it("rejects invalid signatures before database access", async () => {
    vi.stubEnv("STRIPE_TEST_WEBHOOK_SECRET", "whsec_test");
    mocks.constructEvent.mockImplementationOnce(() => { throw new Error("invalid signature"); });
    expect((await POST(request())).status).toBe(400);
    expect(mocks.sql.begin).not.toHaveBeenCalled();
  });
  it("rejects signed live-mode events", async () => {
    vi.stubEnv("STRIPE_TEST_WEBHOOK_SECRET", "whsec_test");
    mocks.constructEvent.mockReturnValueOnce({ id: "evt_live", livemode: true, type: "customer.subscription.updated", data: { object: {} } });
    expect((await POST(request())).status).toBe(400);
    expect(mocks.sql.begin).not.toHaveBeenCalled();
  });
  it("acknowledges unrelated signed test events without database work", async () => {
    vi.stubEnv("STRIPE_TEST_WEBHOOK_SECRET", "whsec_test");
    mocks.constructEvent.mockReturnValueOnce({ id: "evt_test", livemode: false, type: "customer.created", data: { object: {} } });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ received: true, ignored: true });
    expect(mocks.sql.begin).not.toHaveBeenCalled();
  });
});
