import { beforeEach, expect, it, vi } from "vitest";
const mock = vi.hoisted(() => ({ auth: vi.fn(), sql: vi.fn(), provider: vi.fn(), rows: [] as unknown[][] }));
vi.mock("@/lib/auth", () => ({ requireUser: mock.auth }));
vi.mock("@/lib/bank-crypto", () => ({ decryptBankValue: () => "sandbox-session" }));
vi.mock("@/lib/neonomics", () => ({ neonomicsRequest: mock.provider }));
vi.mock("@/lib/db/client", () => ({ sqlClient: Object.assign(mock.sql, {
  begin: async (fn: (tx: unknown) => Promise<unknown>) => fn(mock.sql),
}) }));
import { POST } from "./route";
const connection = { id: "connection", provider_account_id: "account", provider_session_encrypted: "encrypted", device_id: "device" };
const item = { id: "bank-id", amount: { amount: "60", currency: "NOK" }, kid: "1234567", bookingDate: "2026-09-22" };
const statements = () => mock.sql.mock.calls.map(([parts]) => (parts as string[]).join("?"));
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ id: "user", organizationId: "org" });
  mock.provider.mockResolvedValue({ ok: true, value: [item] });
  mock.rows = [[connection], [{ id: "transaction" }], [{ id: "invoice", total_ore: 10000, source_order_id: "order" }], [{ paid: "4000" }], [], [], [], [], []];
  mock.sql.mockImplementation(async () => mock.rows.shift() ?? []);
});
it("uses locked invoice and payment ledger for the remaining balance", async () => {
  expect(await (await POST()).json()).toEqual({ imported: 1, matched: 1 });
  expect(statements().find((q) => q.startsWith("SELECT id, total_ore"))).toContain("FOR UPDATE");
  const update = statements().findIndex((q) => q.startsWith("UPDATE invoices"));
  expect(mock.sql.mock.calls[update].slice(1)).toEqual([10000, 0, "PAID", new Date("2026-09-22"), "invoice", "org"]);
  expect(statements().find((q) => q.startsWith("UPDATE orders"))).toContain("organization_id=?");
});
it("does not repeat an already imported provider transaction", async () => {
  mock.rows = [[connection], [], []];
  expect(await (await POST()).json()).toEqual({ imported: 0, matched: 0 });
  expect(statements().some((q) => q.startsWith("INSERT INTO invoice_payments"))).toBe(false);
});
it("never matches foreign currency to NOK", async () => {
  mock.provider.mockResolvedValue({ ok: true, value: [{ ...item, amount: { amount: "60", currency: "EUR" } }] });
  mock.rows = [[connection], [{ id: "transaction" }], []];
  expect(await (await POST()).json()).toEqual({ imported: 1, matched: 0 });
  expect(statements().some((q) => q.startsWith("SELECT id, total_ore"))).toBe(false);
});
it("leaves an overpayment unmatched instead of hiding a possible duplicate", async () => {
  mock.rows = [[connection], [{ id: "transaction" }], [{ id: "invoice", total_ore: 10000 }], [{ paid: "9000" }], []];
  expect(await (await POST()).json()).toEqual({ imported: 1, matched: 0 });
  expect(statements().some((q) => q.startsWith("INSERT INTO invoice_payments"))).toBe(false);
});
it("ignores malformed transaction amounts and dates", async () => {
  mock.provider.mockResolvedValue({ ok: true, value: [{ ...item, amount: "NaN", currency: "NOK" }, { ...item, bookingDate: "invalid" }] });
  mock.rows = [[connection], []];
  expect(await (await POST()).json()).toEqual({ imported: 0, matched: 0 });
});
it("does not call the provider without a connected bank", async () => {
  mock.rows = [[]];
  expect((await POST()).status).toBe(409);
  expect(mock.provider).not.toHaveBeenCalled();
});
it.each([undefined, null, "", "NOK-invalid", "NO", 123])("rejects currency %s before importing any part of the batch", async (currency) => {
  mock.provider.mockResolvedValue({ ok: true, value: [item, { ...item, id: "invalid", amount: { amount: "60", currency } }] });
  expect((await POST()).status).toBe(502);
  expect(statements()).toHaveLength(1);
  expect(statements().some((q) => q.startsWith("INSERT"))).toBe(false);
});
it("normalizes an explicitly supplied currency without guessing it", async () => {
  mock.provider.mockResolvedValue({ ok: true, value: [{ ...item, amount: { amount: "60", currency: " nok " } }] });
  expect(await (await POST()).json()).toEqual({ imported: 1, matched: 1 });
});
