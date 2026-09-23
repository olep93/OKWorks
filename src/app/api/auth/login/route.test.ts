import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ limit: vi.fn(), verify: vi.fn(), session: vi.fn(), select: vi.fn() }));
vi.mock("@/lib/login-limit", () => ({ checkLoginLimit: mock.limit }));
vi.mock("@/lib/auth", () => ({ verifyPassword: mock.verify, createSession: mock.session }));
vi.mock("@/lib/db/client", () => ({ db: { select: () => {
  const query = { from: () => query, where: () => query, limit: mock.select };
  return query;
} } }));
import { POST } from "./route";
const submit = (values: Record<string, unknown> = {}) => POST(new Request("https://example.test/api/auth/login", { method: "POST", body: JSON.stringify({ email: "test@example.test", password: "synthetic-password", ...values }) }));
beforeEach(() => {
  vi.clearAllMocks();
  mock.limit.mockResolvedValue({ allowed: true, retryAfter: 900 });
  mock.select.mockResolvedValue([{ id: "user", passwordHash: "synthetic-hash", verificationRequired: true, emailVerifiedAt: new Date() }]);
  mock.verify.mockResolvedValue(true);
  mock.session.mockResolvedValue(undefined);
});
it("stops blocked attempts before user lookup, password hashing or session creation", async () => {
  mock.limit.mockResolvedValue({ allowed: false, retryAfter: 42 });
  const response = await submit();
  expect(response.status).toBe(429);
  expect(response.headers.get("Retry-After")).toBe("42");
  expect(mock.select).not.toHaveBeenCalled();
  expect(mock.verify).not.toHaveBeenCalled();
  expect(mock.session).not.toHaveBeenCalled();
});
it("normalizes email before consuming the shared limit", async () => {
  expect((await submit({ email: " Test@Example.Test " })).status).toBe(200);
  expect(mock.limit).toHaveBeenCalledWith("test@example.test");
  expect(mock.session).toHaveBeenCalledWith("user");
});
it("fails closed if shared protection is unavailable", async () => {
  mock.limit.mockRejectedValue(new Error("offline"));
  expect((await submit()).status).toBe(503);
  expect(mock.session).not.toHaveBeenCalled();
});
it("does not expose which credential was wrong", async () => {
  mock.select.mockResolvedValueOnce([]);
  const missing = await submit();
  mock.verify.mockResolvedValueOnce(false);
  const wrong = await submit();
  expect(missing.status).toBe(401);
  expect(wrong.status).toBe(401);
  expect(await missing.json()).toEqual(await wrong.json());
});
it("keeps verification mandatory", async () => {
  mock.select.mockResolvedValue([{ id: "user", passwordHash: "hash", verificationRequired: true, emailVerifiedAt: null }]);
  expect(await (await submit()).json()).toMatchObject({ needsVerification: true });
  expect(mock.session).not.toHaveBeenCalled();
});
it("rejects oversized passwords before password verification", async () => {
  expect((await submit({ password: "x".repeat(201) })).status).toBe(400);
  expect(mock.limit).not.toHaveBeenCalled();
});
it("handles malformed JSON as a client error", async () => {
  expect((await POST(new Request("https://example.test", { method: "POST", body: "{" }))).status).toBe(400);
});
