import { afterEach, describe, expect, it, vi } from "vitest";
const sql = vi.hoisted(() => Object.assign(vi.fn(), { begin: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ sqlClient: sql }));
vi.mock("@/lib/auth", () => ({ tokenHash: (token: string) => `hash:${token}`, hashPassword: vi.fn().mockResolvedValue("hashed-password") }));
import { POST, PATCH } from "./route";
import { hashPassword } from "@/lib/auth";
const req = (body: unknown) => new Request("http://localhost/api/auth/recovery", { method: "POST", body: JSON.stringify(body) });
afterEach(() => { vi.resetAllMocks(); vi.unstubAllEnvs(); });
describe("password recovery", () => {
  it("fails explicitly without configured sender instead of claiming mail was sent", async () => {
    vi.stubEnv("RESEND_API_KEY", ""); expect((await POST(req({ email: "test@example.no" }))).status).toBe(503);
  });
  it("returns the same generic response for unknown and throttled addresses", async () => {
    vi.stubEnv("RESEND_API_KEY", "test"); vi.stubEnv("AUTH_FROM_EMAIL", "OKFaktura <noreply@okfaktura.no>"); vi.stubEnv("APP_URL", "https://ok-works.vercel.app");
    sql.mockResolvedValueOnce([{ attempts: 1 }]).mockResolvedValueOnce([]);
    const unknown = await (await POST(req({ email: "unknown@example.no" }))).json();
    sql.mockResolvedValueOnce([{ attempts: 6 }]);
    expect(await (await POST(req({ email: "test@example.no" }))).json()).toEqual(unknown);
  });
  it("rejects an expired or used token without changing passwords", async () => {
    sql.mockResolvedValueOnce([]);
    expect((await PATCH(req({ token: "a".repeat(43), password: "a-secure-password" }))).status).toBe(400);
    expect(sql.begin).not.toHaveBeenCalled();
  });
  it("consumes the token and revokes existing sessions in one transaction", async () => {
    sql.mockResolvedValueOnce([{ id: "user-1" }]);
    vi.mocked(hashPassword).mockResolvedValueOnce("hashed-password");
    const tx = vi.fn().mockResolvedValueOnce([{ id: "user-1" }]).mockResolvedValueOnce([]);
    sql.begin.mockImplementationOnce((work) => work(tx));
    expect((await PATCH(req({ token: "a".repeat(43), password: "a-secure-password" }))).status).toBe(200);
    expect(tx).toHaveBeenCalledTimes(2);
    expect(tx.mock.calls[1][0].join("")).toContain("DELETE FROM auth_sessions");
    expect(tx.mock.calls[1][1]).toBe("user-1");
  });
  it("does not revoke sessions when another request already consumed the token", async () => {
    sql.mockResolvedValueOnce([{ id: "user-1" }]);
    vi.mocked(hashPassword).mockResolvedValueOnce("hashed-password");
    const tx = vi.fn().mockResolvedValueOnce([]);
    sql.begin.mockImplementationOnce((work) => work(tx));
    expect((await PATCH(req({ token: "a".repeat(43), password: "a-secure-password" }))).status).toBe(400);
    expect(tx).toHaveBeenCalledTimes(1);
  });
});
