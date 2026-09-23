import { beforeEach, expect, it, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";

const mock = vi.hoisted(() => ({ auth: vi.fn(), pdf: vi.fn(), filters: vi.fn(), rows: [] as unknown[][] }));
vi.mock("@/lib/auth", () => ({ requireUser: mock.auth }));
vi.mock("@/lib/invoice-pdf", () => ({ buildInvoicePdf: mock.pdf }));
vi.mock("@/lib/db/client", () => ({ db: { select: () => {
  const query = {
    from: () => query, innerJoin: () => query,
    where: (filter: unknown) => { mock.filters(filter); return query; },
    limit: async () => mock.rows.shift() ?? [],
    orderBy: async () => mock.rows.shift() ?? [],
  };
  return query;
} } }));

import { GET as readInvoice } from "@/app/api/invoices/[id]/route";
import { GET as readPdf } from "@/app/api/invoices/[id]/pdf/route";
import { GET as readAttachment } from "@/app/api/orders/[id]/entries/[entryId]/file/route";

const request = new Request("https://example.test/api/test");
const invoiceContext = { params: Promise.resolve({ id: "invoice-b" }) };
const fileContext = { params: Promise.resolve({ id: "order-b", entryId: "entry-b" }) };
const routes = [
  { name: "invoice", read: () => readInvoice(request, invoiceContext), params: ["invoice-b", "org-a"] },
  { name: "PDF", read: () => readPdf(request, invoiceContext), params: ["invoice-b", "org-a"] },
  { name: "attachment", read: () => readAttachment(request, fileContext), params: ["entry-b", "order-b", "org-a", "org-a"] },
];
const filters = () => mock.filters.mock.calls.map(([filter]) => new PgDialect().sqlToQuery(filter));
beforeEach(() => {
  vi.clearAllMocks();
  mock.auth.mockResolvedValue({ id: "user-a", organizationId: "org-a" });
  mock.pdf.mockResolvedValue(new Uint8Array([37, 80, 68, 70]));
  mock.rows = [];
});

it.each(routes)("$name rejects unauthenticated reads before database access", async ({ read }) => {
  mock.auth.mockRejectedValue(new Error("UNAUTHORIZED"));
  expect((await read()).status).toBe(401);
  expect(mock.filters).not.toHaveBeenCalled();
  expect(mock.pdf).not.toHaveBeenCalled();
});
it.each(routes)("$name returns not found for inaccessible records and enforces organization predicate", async ({ read, params }) => {
  mock.rows = [[]];
  const response = await read();
  expect(response.status).toBe(404);
  expect(filters()[0].params).toEqual(params);
  expect(filters()[0].sql).toContain('"organization_id"');
  expect(filters()[0].sql).toContain(" and ");
  expect(mock.pdf).not.toHaveBeenCalled();
});
it.each(routes)("$name does not misrepresent backend failures as expired sessions", async ({ read }) => {
  mock.auth.mockRejectedValue(new Error("DATABASE_UNAVAILABLE"));
  expect((await read()).status).toBe(500);
});
it("invoice lines have their own tenant restriction", async () => {
  mock.rows = [[{ id: "invoice-b" }], [{ description: "Synthetic line" }]];
  expect((await readInvoice(request, invoiceContext)).status).toBe(200);
  expect(filters()[1].params).toEqual(["invoice-b", "org-a"]);
  expect(filters()[1].sql).toContain('"invoice_lines"."organization_id"');
});
it("PDF uses tenant-filtered lines and attachments, with private cache headers", async () => {
  const invoice = { id: "invoice-b", sourceOrderId: "order-b", invoiceNumber: 1001 };
  const photo = { title: "Synthetic image", fileData: new Uint8Array([1]) };
  mock.rows = [[invoice], [], [photo, { title: "Text only", fileData: null }]];
  const response = await readPdf(request, invoiceContext);
  expect(response.status).toBe(200);
  expect(filters()[1].params).toEqual(["invoice-b", "org-a"]);
  expect(filters()[2].params).toEqual(["order-b", "org-a"]);
  expect(filters()[2].sql).toContain('"order_entries"."organization_id"');
  expect(mock.pdf).toHaveBeenCalledWith(invoice, [], [photo], expect.any(Array));
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("content-disposition")).toBe('attachment; filename="faktura-1001.pdf"');
});
it("attachment checks the parent order and entry belong to the same current firm", async () => {
  mock.rows = [[{ mimeType: "image/png", fileData: new Uint8Array([1, 2]) }]];
  const response = await readAttachment(request, fileContext);
  expect(response.status).toBe(200);
  expect(filters()[0].sql).toContain('"orders"."organization_id"');
  expect(filters()[0].sql).toContain('"order_entries"."organization_id"');
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
});
it.each(["text/html", "image/svg+xml", "application/javascript"])("refuses active attachment content %s", async (mimeType) => {
  mock.rows = [[{ mimeType, fileData: new Uint8Array([1]) }]];
  expect((await readAttachment(request, fileContext)).status).toBe(415);
});
