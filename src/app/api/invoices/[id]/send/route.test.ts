import { beforeEach, afterEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({
  rows: [] as unknown[][],
  auth: vi.fn(), pdf: vi.fn(), sql: vi.fn(), fetch: vi.fn(), filters: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ requireUser: mock.auth }));
vi.mock("@/lib/invoice-pdf", () => ({ buildInvoicePdf: mock.pdf }));
vi.mock("@/lib/db/client", () => {
  const sql = Object.assign(mock.sql, { begin: async (fn: (tx: unknown) => Promise<void>) => fn(mock.sql) });
  return { sqlClient: sql, db: { select: () => {
    const query = {
      from: () => query,
      where: (filter: unknown) => { mock.filters(filter); return query; },
      limit: async () => mock.rows.shift() ?? [],
      orderBy: async () => mock.rows.shift() ?? [],
    };
    return query;
  } } };
});
import { POST } from "./route";
import { PgDialect } from "drizzle-orm/pg-core";

const invoice = { id: "invoice", organizationId: "org", sourceOrderId: "order", status: "FINALIZED", sentAt: null };
const send = (deliveryType = "INVOICE") => POST(new Request("https://example.test/api/invoices/invoice/send", {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ deliveryType, recipient: "test@example.test", subject: "Test invoice", message: "Only a test" }),
}), { params: Promise.resolve({ id: "invoice" }) });
const statements = () => mock.sql.mock.calls.map(([parts]) => (parts as string[]).join("?"));

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("RESEND_API_KEY", "test-key");
  vi.stubGlobal("fetch", mock.fetch);
  mock.auth.mockResolvedValue({ id: "user", organizationId: "org" });
  mock.rows = [[invoice], [], []];
  mock.pdf.mockResolvedValue(new Uint8Array([1, 2, 3]));
  mock.sql.mockResolvedValue([{ id: "delivery" }]);
  mock.fetch.mockResolvedValue(new Response(JSON.stringify({ id: "provider-message" }), { status: 200 }));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it("does not send inaccessible invoices and scopes lookup to the current firm", async () => {
  mock.rows = [[]];
  expect((await send()).status).toBe(404);
  expect(mock.fetch).not.toHaveBeenCalled();
  const filter = new PgDialect().sqlToQuery(mock.filters.mock.calls[0][0]);
  expect(filter.sql).toContain('"organization_id"');
  expect(filter.params).toEqual(["invoice", "org"]);
});
it("returns an authentication error without sending when the session expires", async () => {
  mock.auth.mockRejectedValue(new Error("UNAUTHORIZED"));
  expect((await send()).status).toBe(401);
  expect(mock.fetch).not.toHaveBeenCalled();
  expect(mock.sql).not.toHaveBeenCalled();
});
it("blocks ordinary draft sending", async () => {
  mock.rows = [[{ ...invoice, status: "DRAFT" }]];
  expect((await send()).status).toBe(409);
  expect(mock.fetch).not.toHaveBeenCalled();
});
it("sends test drafts with documentation without assigning an invoice status", async () => {
  const photo = { fileData: new Uint8Array([9]), title: "Photo" };
  mock.rows = [[{ ...invoice, status: "DRAFT" }], [], [photo]];
  expect((await send("TEST_DRAFT")).status).toBe(200);
  expect(mock.pdf).toHaveBeenCalledWith(expect.objectContaining({ status: "DRAFT" }), [], [photo], [photo]);
  const payload = JSON.parse(mock.fetch.mock.calls[0][1].body);
  expect(payload.to).toEqual(["test@example.test"]);
  expect(payload.attachments[0].filename).toBe("TEST-fakturautkast-skal-ikke-betales.pdf");
  expect(statements().some((sql) => sql.includes("UPDATE invoices"))).toBe(false);
});
it.each(["PAID", "VOID", "CREDITED"])("blocks sending %s invoices", async (status) => {
  mock.rows = [[{ ...invoice, status }]];
  expect((await send()).status).toBe(409);
  expect(mock.fetch).not.toHaveBeenCalled();
});
it("does not remind before initial sending", async () => {
  expect((await send("REMINDER")).status).toBe(409);
  expect(mock.fetch).not.toHaveBeenCalled();
});
it("preserves payment status on resend, even when payment arrives during sending", async () => {
  mock.rows = [[{ ...invoice, status: "PARTIALLY_PAID", sentAt: new Date() }], [], []];
  expect((await send()).status).toBe(200);
  const update = statements().find((sql) => sql.includes("UPDATE invoices"));
  expect(update).toContain("CASE WHEN status='FINALIZED' THEN 'SENT' ELSE status END");
  expect(update).toContain("AND organization_id=");
  expect(statements().find((sql) => sql.includes("UPDATE orders"))).toContain("AND status!='CLOSED'");
});
it("records provider rejection without changing invoice state", async () => {
  mock.fetch.mockResolvedValue(new Response(JSON.stringify({ message: "Rejected" }), { status: 422 }));
  expect((await send()).status).toBe(502);
  expect(statements().some((sql) => sql.includes("status='FAILED'"))).toBe(true);
  expect(statements().some((sql) => sql.includes("UPDATE invoices"))).toBe(false);
});
