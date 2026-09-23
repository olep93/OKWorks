import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mock = vi.hoisted(() => ({ auth: vi.fn(), filters: vi.fn(), check: vi.fn(), rows: [] as unknown[][], fail: false }));
vi.mock("@/lib/auth", () => ({ requireUser: mock.auth }));
vi.mock("@/lib/invoice-preflight", () => ({ checkInvoicePreflight: mock.check }));
vi.mock("@/lib/db/client", () => ({ db: { select: () => ({ from: () => ({ where: (filter: unknown) => {
  mock.filters(filter);
  const result = mock.fail ? Promise.reject(new Error("DATABASE_FAILURE")) : Promise.resolve(mock.rows.shift() ?? []);
  return Object.assign(result, { limit: () => result });
} }) }) } }));
import { GET } from "./route";
const read = () => GET(new Request("https://example.test"), { params: Promise.resolve({ id: "invoice" }) });
beforeEach(() => {
  vi.clearAllMocks();
  mock.fail = false;
  mock.auth.mockResolvedValue({ organizationId: "org" });
  mock.check.mockReturnValue({ canFinalize: true });
  mock.rows = [[{ status: "DRAFT", totalOre: 10000, sourceOrderId: "order", organizationSnapshot: {}, customerSnapshot: {} }], [{ count: 2 }], [{ count: 1 }], [{ count: 0 }]];
});
it("rejects missing authentication before reading invoice data", async () => {
  mock.auth.mockRejectedValue(new Error("UNAUTHORIZED"));
  expect((await read()).status).toBe(401);
  expect(mock.filters).not.toHaveBeenCalled();
});
it("returns 404 for an inaccessible invoice without reading related data", async () => {
  mock.rows = [[]];
  expect((await read()).status).toBe(404);
  expect(mock.filters).toHaveBeenCalledTimes(1);
  expect(new PgDialect().sqlToQuery(mock.filters.mock.calls[0][0]).params).toEqual(["invoice", "org"]);
  expect(mock.check).not.toHaveBeenCalled();
});
it("reports database failure without falsely asking the user to log in", async () => {
  mock.fail = true;
  const response = await read();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: "Kunne ikke kontrollere fakturaen. Prøv igjen." });
  expect(mock.check).not.toHaveBeenCalled();
});
it("scopes all counts to the current firm and passes their values to validation", async () => {
  const response = await read();
  expect(response.status).toBe(200);
  const filters = mock.filters.mock.calls.map(([filter]) => new PgDialect().sqlToQuery(filter));
  expect(filters.map((filter) => filter.params)).toEqual([
    ["invoice", "org"], ["invoice", "org"], ["order", "org", "IMAGE", "DOCUMENT"], ["order", "org", "DRIVING"],
  ]);
  for (const filter of filters) expect(filter.sql).toContain('"organization_id"');
  expect(mock.check).toHaveBeenCalledWith(expect.objectContaining({ lineCount: 2, documentationCount: 1, unresolvedTollCount: 0 }));
});
