import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ sql: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db/client", () => ({ sqlClient: mock.sql }));
import { checkLoginLimit } from "./login-limit";
beforeEach(() => { vi.clearAllMocks(); mock.sql.mockResolvedValue([{ attempts: 1, retry_after: 900 }]); });
it("uses a stable normalized hash rather than plaintext email", async () => {
  await checkLoginLimit(" Test@Example.Test ");
  await checkLoginLimit("test@example.test");
  expect(mock.sql.mock.calls[0][1]).toMatch(/^[a-f0-9]{64}$/);
  expect(mock.sql.mock.calls[0][1]).toBe(mock.sql.mock.calls[1][1]);
});
it.each([[20, true], [21, false]])("enforces attempt boundary %s", async (attempts, allowed) => {
  mock.sql.mockResolvedValue([{ attempts, retry_after: 120 }]);
  expect(await checkLoginLimit("test@example.test")).toEqual({ allowed, retryAfter: 120 });
});
it("uses an atomic upsert and bounded counter with a fixed window", async () => {
  await checkLoginLimit("test@example.test");
  const query = mock.sql.mock.calls[0][0].join("?");
  expect(query).toContain("ON CONFLICT");
  expect(query).toContain("interval '15 minutes'");
  expect(query).toContain("LEAST(auth_mail_limits.attempts, 20)");
});
