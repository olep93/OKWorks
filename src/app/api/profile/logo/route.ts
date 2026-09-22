import { PDFDocument } from "pdf-lib";
import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { invoices, organizations } from "@/lib/db/schema";

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const file = (await request.formData()).get("logo");
    if (!(file instanceof File) || !["image/png", "image/jpeg"].includes(file.type) || file.size > 1_000_000 || !file.size)
      return NextResponse.json({ error: "Velg en PNG- eller JPG-logo på maks 1 MB." }, { status: 400 });
    const bytes = Buffer.from(await file.arrayBuffer());
    try {
      const pdf = await PDFDocument.create();
      const image = file.type === "image/png" ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      if (image.width > 4096 || image.height > 4096) throw new Error("LOGO_TOO_LARGE");
    } catch {
      return NextResponse.json({ error: "Bildet kunne ikke leses. Bruk PNG eller JPG, maks 4096 piksler per side." }, { status: 400 });
    }
    const logo = `data:${file.type};base64,${bytes.toString("base64")}`;
    await db.transaction(async (tx) => {
      const [organization] = await tx.update(organizations).set({ logoStorageKey: logo, updatedAt: new Date() }).where(eq(organizations.id, user.organizationId)).returning({ id: organizations.id });
      if (!organization) throw new Error("LOGO_ORGANIZATION_NOT_FOUND");
      const drafts = await tx.select({ id: invoices.id, snapshot: invoices.organizationSnapshot }).from(invoices).where(and(eq(invoices.organizationId, user.organizationId), eq(invoices.status, "DRAFT"))).for("update");
      for (const draft of drafts) {
        const snapshot = draft.snapshot && typeof draft.snapshot === "object" ? draft.snapshot : {};
        await tx.update(invoices).set({ organizationSnapshot: { ...snapshot, logoStorageKey: logo }, updatedAt: new Date() }).where(and(eq(invoices.id, draft.id), eq(invoices.organizationId, user.organizationId), eq(invoices.status, "DRAFT")));
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    // Log a safe error code only; never log image data, SQL parameters or credentials.
    const cause = error && typeof error === "object" && "cause" in error ? error.cause : error;
    const code = cause && typeof cause === "object" && "code" in cause ? String(cause.code) : "LOGO_UPLOAD_FAILED";
    console.error("Company logo upload failed", { code });
    return NextResponse.json({ error: "Kunne ikke lagre firmalogoen." }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}

export async function DELETE() {
  try {
    const user = await requireUser();
    await db.transaction(async (tx) => {
      const [organization] = await tx.update(organizations).set({ logoStorageKey: null, updatedAt: new Date() }).where(eq(organizations.id, user.organizationId)).returning({ id: organizations.id });
      if (!organization) throw new Error("LOGO_ORGANIZATION_NOT_FOUND");
      const drafts = await tx.select({ id: invoices.id, snapshot: invoices.organizationSnapshot }).from(invoices).where(and(eq(invoices.organizationId, user.organizationId), eq(invoices.status, "DRAFT"))).for("update");
      for (const draft of drafts) {
        const snapshot = draft.snapshot && typeof draft.snapshot === "object" ? draft.snapshot : {};
        await tx.update(invoices).set({ organizationSnapshot: { ...snapshot, logoStorageKey: null }, updatedAt: new Date() }).where(and(eq(invoices.id, draft.id), eq(invoices.organizationId, user.organizationId), eq(invoices.status, "DRAFT")));
      }
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const status = error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500;
    return NextResponse.json({ error: "Kunne ikke fjerne firmalogoen." }, { status });
  }
}
