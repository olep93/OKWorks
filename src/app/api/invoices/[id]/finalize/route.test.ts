import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ auth: vi.fn(), sql: vi.fn(), invoice: null as Record<string, unknown> | null, lineCount: 1, tollCount: 0 }));
vi.mock("@/lib/auth", () => ({ requireUser: mock.auth }));
vi.mock("@/lib/db/client", () => ({ sqlClient: Object.assign(mock.sql, {
  begin: async (fn: (tx: unknown) => Promise<unknown>) => fn(mock.sql),
}) }));
import { POST } from "./route";
const finalize = () => POST(new Request("https://example.test", { method: "POST" }), { params: Promise.resolve({ id: "invoice" }) });
const statements = () => mock.sql.mock.calls.map(([parts]) => (parts as string[]).join("?"));
const writes = () => statements().filter((query) => /^(INSERT|UPDATE|DELETE)/.test(query));
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ id: "user", organizationId: "org" });
  mock.lineCount = 1; mock.tollCount = 0;
  mock.invoice = { id: "invoice", status: "DRAFT", source_order_id: "order", total_ore: 10000,
    organization_snapshot: { name: "Synthetic firm", organizationNumber: "123456789", bankAccount: "12345678901" },
    customer_snapshot: { name: "Synthetic customer", type: "PRIVATE", address: "Test address" },
  };
  mock.sql.mockImplementation(async (parts: TemplateStringsArray) => {
    const query = parts.join("?");
    if (query.startsWith("SELECT * FROM invoices")) return mock.invoice ? [mock.invoice] : [];
    if (query.includes("SELECT count") && query.includes("invoice_lines")) return [{ count: mock.lineCount }];
    if (query.includes("SELECT count") && query.includes("DRIVING")) return [{ count: mock.tollCount }];
    if (query.includes("SELECT count")) return [{ count: 1 }];
    if (query.startsWith("SELECT next_number")) return [{ next_number: 1001 }];
    if (query.startsWith("UPDATE invoices")) return [{ ...mock.invoice, status: "FINALIZED", invoice_number: 1001 }];
    return [];
  });
});
it("requires authentication before opening the invoice", async () => {
  mock.auth.mockRejectedValue(new Error("UNAUTHORIZED"));
  expect((await finalize()).status).toBe(401);
  expect(mock.sql).not.toHaveBeenCalled();
});
it("locks the invoice within the current firm's scope", async () => {
  mock.invoice = null;
  expect((await finalize()).status).toBe(404);
  expect(mock.sql.mock.calls[0].slice(1)).toEqual(["invoice", "org"]);
  expect(statements()[0]).toContain("organization_id = ? FOR UPDATE");
  expect(writes()).toEqual([]);
});
it.each(["FINALIZED", "SENT", "PARTIALLY_PAID", "PAID"])("does not consume a new number when %s is submitted again", async (status) => {
  mock.invoice = { ...mock.invoice, status, invoice_number: 1001 };
  expect(await (await finalize()).json()).toMatchObject({ alreadyFinalized: true });
  expect(writes()).toEqual([]);
});
it("rejects missing seller details before consuming a number", async () => {
  mock.invoice = { ...mock.invoice, organization_snapshot: { name: "Incomplete firm" } };
  expect((await finalize()).status).toBe(400);
  expect(writes()).toEqual([]);
});
it("rejects an empty invoice without allocating a number", async () => {
  mock.lineCount = 0;
  expect((await finalize()).status).toBe(400);
  expect(writes()).toEqual([]);
});
it("rejects unresolved tolls before allocating a number", async () => {
  mock.tollCount = 1;
  expect((await finalize()).status).toBe(400);
  expect(writes()).toEqual([]);
});
it("locks the firm sequence and scopes every source update to firm and source order", async () => {
  const response = await finalize();
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ invoice: { invoice_number: 1001 } });
  expect(statements().find((q) => q.startsWith("SELECT next_number"))).toContain("organization_id = ? FOR UPDATE");
  for (const table of ["time_entries t", "order_entries e"]) {
    const index = statements().findIndex((q) => q.startsWith(`UPDATE ${table}`));
    expect(mock.sql.mock.calls[index].slice(1)).toEqual(["invoice", "org", "org", "order"]);
    expect(statements()[index]).toContain("l.organization_id = ?");
    expect(statements()[index]).toContain(".order_id = ?");
  }
  expect(statements().some((q) => q.includes("INVOICE_FINALIZED"))).toBe(true);
});
