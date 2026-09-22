import { afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ sql: Object.assign(vi.fn(), { begin: vi.fn() }), config: vi.fn(), allowed: vi.fn(), send: vi.fn(), hash: vi.fn() }));
vi.mock("@/lib/db/client", () => ({ sqlClient: mocks.sql }));
vi.mock("@/lib/auth", () => ({ hashPassword: mocks.hash }));
vi.mock("@/lib/auth-email", () => ({ authEmailConfig: mocks.config, allowVerificationEmail: mocks.allowed, sendVerificationEmail: mocks.send }));
import { POST } from "./route";
const body = { name: "Test User", email: "test@example.no", companyName: "Test Company", password: "long-test-password", confirmPassword: "long-test-password", acceptedTerms: true };
const request = () => new Request("http://localhost/api/auth/register", { method: "POST", body: JSON.stringify(body) });
afterEach(() => vi.resetAllMocks());
describe("registration verification", () => {
  it("rejects registration when the repeated password differs", async () => {
    const response = await POST(new Request("http://localhost/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ ...body, confirmPassword: "another-password" }),
    }));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Passordene er ikke like." });
    expect(mocks.sql.begin).not.toHaveBeenCalled();
  });
  it("does not create an unusable account when email is unconfigured", async () => {
    mocks.config.mockImplementationOnce(() => { throw new Error("AUTH_EMAIL_NOT_CONFIGURED"); });
    expect((await POST(request())).status).toBe(503);
    expect(mocks.sql.begin).not.toHaveBeenCalled();
  });
  it("creates an unverified account without a session", async () => {
    mocks.allowed.mockResolvedValueOnce(true);
    mocks.hash.mockResolvedValueOnce("hashed-password");
    const tx = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: "org-1" }]).mockResolvedValueOnce([{ id: "user-1" }]).mockResolvedValue([]);
    mocks.sql.begin.mockImplementationOnce((work) => work(tx));
    const response = await POST(request());
    expect(response.status).toBe(201);
    expect((await response.json()).needsVerification).toBe(true);
    const insert = tx.mock.calls[2][0].join("");
    expect(insert).toContain("verification_required");
    expect(insert).not.toContain("email_verified_at");
    expect(mocks.send).toHaveBeenCalledWith(body.email);
  });
});
