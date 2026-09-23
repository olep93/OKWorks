import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ auth: vi.fn(), sql: vi.fn(), rows: [] as unknown[][] }));
vi.mock("@/lib/auth", () => ({ requireUser: mock.auth }));
vi.mock("@/lib/db/client", () => ({ sqlClient: Object.assign(mock.sql, {
  begin: async (fn: (tx: unknown) => Promise<unknown>) => fn(mock.sql),
}) }));
import { GET, POST } from "./route";
const context = { params: Promise.resolve({ id: "invoice" }) };
const current = { id: "invoice", status: "SENT", total_ore: 10000, source_order_id: "order" };
const submit = (values: Record<string, unknown> = {}) => POST(new Request("https://example.test/api/invoices/invoice/payments", {
  method: "POST", body: JSON.stringify({ amountOre: 4000, paidAt: "2026-09-22", ...values }),
}), context);
const statements = () => mock.sql.mock.calls.map(([parts]) => (parts as string[]).join("?"));
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ id: "user", organizationId: "org" });
  mock.rows = [[current], [{ paid: "0" }], [], [{ id: "invoice" }], []];
  mock.sql.mockImplementation(async () => mock.rows.shift() ?? []);
});

it.each([0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])("rejects invalid amount %s", async (amountOre) => {
  expect((await submit({ amountOre })).status).toBe(400);
  expect(mock.sql).not.toHaveBeenCalled();
});
it.each(["2026-02-30", "2026-13-01", "not-a-date"])("rejects invalid date %s", async (paidAt) => {
  expect((await submit({ paidAt })).status).toBe(400);
  expect(mock.sql).not.toHaveBeenCalled();
});
it("rejects an expired session without database access", async () => {
  mock.auth.mockRejectedValue(new Error("UNAUTHORIZED"));
  expect((await submit()).status).toBe(401);
  expect(mock.sql).not.toHaveBeenCalled();
});
it("does not change another firm's invoice", async () => {
  mock.rows = [[]];
  expect((await submit()).status).toBe(404);
  expect(mock.sql).toHaveBeenCalledTimes(1);
  expect(statements()[0]).toContain("organization_id=? FOR UPDATE");
  expect(mock.sql.mock.calls[0].slice(1)).toEqual(["invoice", "org"]);
});
it.each(["DRAFT", "PAID", "VOID", "CREDITED"])("protects %s invoices", async (status) => {
  mock.rows = [[{ ...current, status }]];
  expect((await submit()).status).toBe(409);
  expect(mock.sql).toHaveBeenCalledTimes(1);
});
it("rejects manual overpayment before insertion", async () => {
  mock.rows = [[current], [{ paid: "8000" }]];
  expect((await submit()).status).toBe(409);
  expect(statements().some((q) => q.startsWith("INSERT"))).toBe(false);
});
it("records a partial payment with audit history and tenant-scoped updates", async () => {
  expect((await submit()).status).toBe(200);
  const index = statements().findIndex((q) => q.startsWith("UPDATE invoices"));
  expect(mock.sql.mock.calls[index].slice(1)).toEqual([4000, 6000, "PARTIALLY_PAID", null, "invoice", "org"]);
  expect(statements().some((q) => q.startsWith("UPDATE orders"))).toBe(false);
  expect(statements().some((q) => q.includes("INVOICE_PAYMENT_REGISTERED"))).toBe(true);
});
it("closes the order only on full payment and uses the selected payment date", async () => {
  expect((await submit({ amountOre: 10000, paidAt: "2026-09-20" })).status).toBe(200);
  const index = statements().findIndex((q) => q.startsWith("UPDATE invoices"));
  expect(mock.sql.mock.calls[index].slice(1)).toEqual([10000, 0, "PAID", new Date("2026-09-20T12:00:00Z"), "invoice", "org"]);
  expect(statements().find((q) => q.startsWith("UPDATE orders"))).toContain("organization_id=?");
});
it("returns an already accepted request without inserting another payment", async () => {
  mock.rows = [[{ ...current, status: "PAID" }], [{ invoice_id: "invoice", amount_ore: 4000, paid_at: "2026-09-22T12:00:00Z", note: null }]];
  expect((await submit({ requestId: "00000000-0000-4000-8000-000000000001" })).status).toBe(200);
  expect(statements().some((q) => q.startsWith("INSERT"))).toBe(false);
});
it("rejects reuse of a request key with a changed amount", async () => {
  mock.rows = [[current], [{ invoice_id: "invoice", amount_ore: 5000, paid_at: "2026-09-22T12:00:00Z" }]];
  expect((await submit({ requestId: "00000000-0000-4000-8000-000000000001" })).status).toBe(409);
});
it("scopes payment history to both invoice and payment organization", async () => {
  mock.rows = [[]];
  expect((await GET(new Request("https://example.test"), context)).status).toBe(200);
  expect(statements()[0]).toContain("i.organization_id=? AND p.organization_id=?");
});
