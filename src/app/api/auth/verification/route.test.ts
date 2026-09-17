import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sql: vi.fn(), config: vi.fn(), allowed: vi.fn(), send: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ sqlClient: mocks.sql }));
vi.mock("@/lib/auth", () => ({ tokenHash: (token: string) => `hash:${token}` }));
vi.mock("@/lib/auth-email", () => ({ authEmailConfig: mocks.config, allowVerificationEmail: mocks.allowed, sendVerificationEmail: mocks.send }));
import { PATCH, POST } from "./route";
const request = (body: unknown) => new Request("http://localhost/api/auth/verification", { method: "POST", body: JSON.stringify(body) });
afterEach(() => vi.resetAllMocks());
describe("email verification", () => {
  it("rejects malformed tokens before database access", async () => {
    expect((await PATCH(request({ token: "invalid" }))).status).toBe(400);
    expect(mocks.sql).not.toHaveBeenCalled();
  });
  it("atomically consumes an unexpired token without logging the user in", async () => {
    mocks.sql.mockResolvedValueOnce([{ id: "user-1" }]);
    expect((await PATCH(request({ token: "a".repeat(43) }))).status).toBe(200);
    const query = mocks.sql.mock.calls[0][0].join("");
    expect(query).toContain("verification_expires_at > now()");
    expect(query).toContain("email_verified_at IS NULL");
    expect(query).toContain("verification_token_hash = NULL");
    expect(mocks.sql).toHaveBeenCalledTimes(1);
  });
  it("rejects used or expired tokens", async () => {
    mocks.sql.mockResolvedValueOnce([]);
    expect((await PATCH(request({ token: "a".repeat(43) }))).status).toBe(400);
  });
  it("gives the same response when sending is throttled", async () => {
    mocks.allowed.mockResolvedValueOnce(true);
    const normal = await (await POST(request({ email: "test@example.no" }))).json();
    mocks.allowed.mockResolvedValueOnce(false);
    expect(await (await POST(request({ email: "test@example.no" }))).json()).toEqual(normal);
    expect(mocks.send).toHaveBeenCalledTimes(1);
  });
});
