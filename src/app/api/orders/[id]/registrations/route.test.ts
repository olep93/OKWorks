import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ rows: [] as unknown[][], deleted: vi.fn(), updated: vi.fn(), auth: vi.fn() }));
vi.mock("@/lib/auth", () => ({ requireUser: mock.auth }));
vi.mock("@/lib/db/client", () => ({ db: { transaction: async (callback: (tx: unknown) => Promise<unknown>) => {
  const select = () => {
    const query = {
      from: () => query, where: () => query,
      for: async () => mock.rows.shift() ?? [],
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(mock.rows.shift() ?? []).then(resolve),
    };
    return query;
  };
  return callback({ select, delete: (table: unknown) => { mock.deleted(table); return { where: () => ({ returning: async () => [{ id: "removed" }] }) }; }, update: () => ({ set: (values: unknown) => { mock.updated(values); return { where: async () => undefined }; } }) });
} } }));
import { DELETE } from "./route";

const registrationId = "00000000-0000-4000-8000-000000000001";
const draft = { id: "draft", status: "DRAFT", invoiceNumber: null, finalizedAt: null, sentAt: null, paidAmountOre: 0 };
beforeEach(() => { vi.clearAllMocks(); mock.rows = []; mock.auth.mockResolvedValue({ id: "user", organizationId: "org" }); });
const remove = (type = "TIME", id = registrationId) => DELETE(new Request("http://localhost/api/orders/order/registrations", { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ id, type }) }), { params: Promise.resolve({ id: "order" }) });

it("rejects malformed deletion without touching rows", async () => {
  expect((await remove("TIME", "invalid")).status).toBe(400);
  expect(mock.deleted).not.toHaveBeenCalled();
});
it("does not delete outside an accessible order", async () => {
  mock.rows = [[], []];
  expect((await remove()).status).toBe(404);
  expect(mock.deleted).not.toHaveBeenCalled();
});
it("protects finalized invoices", async () => {
  mock.rows = [[{ id: "invoice" }], [{ status: "OPEN" }], [{ ...draft, status: "FINALIZED", invoiceNumber: 1001 }]];
  expect((await remove()).status).toBe(409);
  expect(mock.deleted).not.toHaveBeenCalled();
});
it("clears draft totals when its last time registration is deleted", async () => {
  mock.rows = [[{ id: "draft" }], [{ status: "OPEN" }], [draft], [{ subtotal: "0", vat: "0", total: "0" }]];
  expect((await remove()).status).toBe(200);
  expect(mock.deleted).toHaveBeenCalledTimes(2);
  expect(mock.updated).toHaveBeenCalledWith(expect.objectContaining({ subtotalOre: 0, vatAmountOre: 0, totalOre: 0, remainingAmountOre: 0 }));
});
it("deletes hotel together with linked generated journeys", async () => {
  mock.rows = [[], [{ status: "OPEN" }], [], [{ id: registrationId, kind: "HOTEL", billingStatus: "UNBILLED" }], [{ id: "outbound", billingStatus: "UNBILLED" }, { id: "inbound", billingStatus: "UNBILLED" }]];
  const response = await remove("EXTRA");
  expect(response.status).toBe(200);
  expect((await response.json()).deletedCount).toBe(3);
});
it("protects invoiced registrations even if order status is inconsistent", async () => {
  mock.rows = [[], [{ status: "OPEN" }], [], [{ id: registrationId, kind: "LINE", billingStatus: "INVOICED" }]];
  expect((await remove("EXTRA")).status).toBe(409);
  expect(mock.deleted).not.toHaveBeenCalled();
});
