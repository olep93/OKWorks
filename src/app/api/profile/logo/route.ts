import { PDFDocument } from "pdf-lib";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sqlClient } from "@/lib/db/client";

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
    await sqlClient.begin(async (tx) => {
      await tx`UPDATE organizations SET logo_storage_key=${logo}, updated_at=now() WHERE id=${user.organizationId}`;
      await tx`UPDATE invoices SET organization_snapshot=jsonb_set(COALESCE(organization_snapshot, '{}'::jsonb), '{logoStorageKey}', ${tx.json(logo)}), updated_at=now() WHERE organization_id=${user.organizationId} AND status='DRAFT'`;
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Kunne ikke lagre firmalogoen." }, { status: error instanceof Error && error.message === "UNAUTHORIZED" ? 401 : 500 });
  }
}
