import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mock = vi.hoisted(() => ({ get: vi.fn(), set: vi.fn(), clear: vi.fn(), insert: vi.fn(), remove: vi.fn(), filter: vi.fn(), rows: [] as unknown[] }));
vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mock.get, set: mock.set, delete: mock.clear }) }));
vi.mock("@/lib/db/client", () => ({ db: {
  insert: () => ({ values: mock.insert }),
  delete: () => ({ where: mock.remove }),
  select: () => {
    const query = { from: () => query, innerJoin: () => query,
      where: (filter: unknown) => { mock.filter(filter); return query; }, limit: async () => mock.rows };
    return query;
  },
} }));
import { clearSession, createSession, getCurrentUser, requireUser, tokenHash } from "./auth";

beforeEach(() => {
  vi.resetAllMocks();
  mock.rows = [];
});
afterEach(() => vi.unstubAllEnvs());
it("does not read the database without a session cookie", async () => {
  expect(await getCurrentUser()).toBeNull();
  expect(mock.filter).not.toHaveBeenCalled();
});
it("requires a valid session for protected actions", async () => {
  await expect(requireUser()).rejects.toThrow("UNAUTHORIZED");
});
it("queries by hashed token with expiry, active membership and email verification predicates", async () => {
  mock.get.mockReturnValue({ value: "synthetic-token" });
  expect(await getCurrentUser()).toBeNull();
  const query = new PgDialect().sqlToQuery(mock.filter.mock.calls[0][0]);
  expect(query.params[0]).toBe(tokenHash("synthetic-token"));
  expect(query.params).not.toContain("synthetic-token");
  expect(query.sql).toContain('"expires_at" >');
  expect(query.sql).toContain('"active" =');
  expect(query.sql).toContain('"verification_required" =');
  expect(query.sql).toContain('"email_verified_at" is not null');
});
it("returns the organization context supplied by the session lookup", async () => {
  mock.get.mockReturnValue({ value: "synthetic-token" });
  mock.rows = [{ id: "user", organizationId: "org", role: "OWNER" }];
  expect(await requireUser()).toEqual(mock.rows[0]);
});
it("stores only a token hash and uses a secure production cookie", async () => {
  vi.stubEnv("NODE_ENV", "production");
  await createSession("user");
  const [name, token, options] = mock.set.mock.calls[0];
  expect(name).toBe("okworks_session");
  expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(mock.insert).toHaveBeenCalledWith({ userId: "user", tokenHash: tokenHash(token), expiresAt: options.expires });
  expect(options).toMatchObject({ httpOnly: true, secure: true, sameSite: "lax", path: "/" });
  expect(options.expires.getTime()).toBeGreaterThan(Date.now());
});
it("does not set a cookie when session persistence fails", async () => {
  mock.insert.mockRejectedValue(new Error("DATABASE_FAILURE"));
  await expect(createSession("user")).rejects.toThrow("DATABASE_FAILURE");
  expect(mock.set).not.toHaveBeenCalled();
});
it("revokes only the hashed current session before clearing its cookie", async () => {
  mock.get.mockReturnValue({ value: "synthetic-token" });
  await clearSession();
  expect(new PgDialect().sqlToQuery(mock.remove.mock.calls[0][0]).params).toEqual([tokenHash("synthetic-token")]);
  expect(mock.clear).toHaveBeenCalledWith("okworks_session");
  expect(mock.remove.mock.invocationCallOrder[0]).toBeLessThan(mock.clear.mock.invocationCallOrder[0]);
});
it("can clear an absent cookie without deleting database sessions", async () => {
  await clearSession();
  expect(mock.remove).not.toHaveBeenCalled();
  expect(mock.clear).toHaveBeenCalledWith("okworks_session");
});
