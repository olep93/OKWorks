import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { invoices } from "@/lib/db/schema";

const mock = vi.hoisted(() => ({ auth: vi.fn(), filters: vi.fn(), locks: vi.fn(), remove: vi.fn(), rows: [] as unknown[][] }));
vi.mock("@/lib/auth", () => ({ requireUser: mock.auth }));
vi.mock("@/lib/db/client", () => ({ db: { transaction: async (fn: (tx: unknown) => Promise<unknown>) => fn({
  select: () => {
    const query = {
      from: () => query,
      where: (filter: unknown) => { mock.filters(filter); return query; },
      for: async (lock: string) => { mock.locks(lock); return mock.rows.shift() ?? []; },
    };
    return query;
  },
  delete: (table: unknown) => ({ where: async (filter: unknown) => mock.remove(table, filter) }),
}) } }));
import { POST } from "./route";

const draft = { id: "draft", sourceOrderId: "order", status: "DRAFT", invoiceNumber: null, finalizedAt: null, sentAt: null, paidAmountOre: 0 };
const reset = () => POST(new Request("https://example.test", { method: "POST" }), { params: Promise.resolve({ id: "draft" }) });
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ id: "user", organizationId: "org" });
  mock.rows = [[{ ...draft }], [{ id: "order", status: "OPEN" }]];
});
it("requires authentication before accessing data", async () => {
  mock.auth.mockRejectedValue(new Error("UNAUTHORIZED"));
  expect((await reset()).status).toBe(401);
  expect(mock.filters).not.toHaveBeenCalled();
  expect(mock.remove).not.toHaveBeenCalled();
});
it("returns 404 for an inaccessible invoice without deleting anything", async () => {
  mock.rows = [[]];
  expect((await reset()).status).toBe(404);
  expect(new PgDialect().sqlToQuery(mock.filters.mock.calls[0][0]).params).toEqual(["draft", "org"]);
  expect(mock.remove).not.toHaveBeenCalled();
});
it.each([
  { status: "FINALIZED" }, { status: "SENT" }, { status: "PAID" },
  { invoiceNumber: 1001 }, { finalizedAt: "2026-09-23" },
  { sentAt: "2026-09-23" }, { paidAmountOre: 1 },
])("rejects a protected invoice: %j", async (change) => {
  mock.rows = [[{ ...draft, ...change }]];
  expect((await reset()).status).toBe(409);
  expect(mock.remove).not.toHaveBeenCalled();
});
it.each(["INVOICED", "CLOSED", "CANCELLED"])("preserves drafts on a %s order", async (status) => {
  mock.rows[1] = [{ id: "order", status }];
  expect((await reset()).status).toBe(409);
  expect(mock.remove).not.toHaveBeenCalled();
});
it("does not delete a draft when its source order is inaccessible", async () => {
  mock.rows[1] = [];
  expect((await reset()).status).toBe(404);
  expect(mock.remove).not.toHaveBeenCalled();
});
it("locks invoice then order and deletes only the tenant-scoped draft", async () => {
  const response = await reset();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ orderId: "order" });
  expect(mock.locks.mock.calls).toEqual([["update"], ["update"]]);
  expect(mock.filters.mock.calls.map(([filter]) => new PgDialect().sqlToQuery(filter).params)).toEqual([["draft", "org"], ["order", "org"]]);
  expect(mock.remove).toHaveBeenCalledTimes(1);
  expect(mock.remove.mock.calls[0][0]).toBe(invoices);
  const deletion = new PgDialect().sqlToQuery(mock.remove.mock.calls[0][1]);
  expect(deletion.params).toEqual(["draft", "org"]);
  expect(deletion.sql).toContain('"organization_id"');
});
it("reports an internal failure as 500, not an expired session", async () => {
  mock.auth.mockRejectedValue(new Error("DATABASE_UNAVAILABLE"));
  expect((await reset()).status).toBe(500);
  expect(mock.remove).not.toHaveBeenCalled();
});
