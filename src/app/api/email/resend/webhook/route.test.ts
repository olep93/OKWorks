import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ verify: vi.fn(), sql: Object.assign(vi.fn(), { begin: vi.fn() }) }));
vi.mock("resend", () => ({ Resend: class { webhooks = { verify: mocks.verify }; } }));
vi.mock("@/lib/db/client", () => ({ sqlClient: mocks.sql }));
import { POST } from "./route";

const request = () => new Request("https://okfaktura.no/api/email/resend/webhook", { method: "POST", headers: { "svix-id": "evt_1", "svix-timestamp": "1", "svix-signature": "v1,test" }, body: "raw" });

afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });

describe("Resend delivery webhook", () => {
  it("stays disabled until a signing secret is configured", async () => {
    expect((await POST(request())).status).toBe(503);
    expect(mocks.verify).not.toHaveBeenCalled();
  });

  it("rejects invalid signatures before database access", async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec_test");
    mocks.verify.mockImplementationOnce(() => { throw new Error("invalid"); });
    expect((await POST(request())).status).toBe(400);
    expect(mocks.sql.begin).not.toHaveBeenCalled();
  });

  it("stores supported signed delivery events transactionally", async () => {
    vi.stubEnv("RESEND_WEBHOOK_SECRET", "whsec_test");
    mocks.verify.mockReturnValueOnce({ type: "email.delivered", created_at: "2026-09-22T12:00:00Z", data: { email_id: "mail_1" } });
    mocks.sql.begin.mockImplementationOnce(async (callback: (tx: typeof mocks.sql) => Promise<void>) => {
      const tx = vi.fn().mockResolvedValueOnce([{ event_id: "evt_1" }]).mockResolvedValueOnce([]);
      await callback(tx as unknown as typeof mocks.sql);
    });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.sql.begin).toHaveBeenCalledOnce();
  });
});
