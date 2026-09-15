import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { neonomicsRequest } from "@/lib/neonomics";

export async function GET() {
  try {
    await requireUser();
    const response = await neonomicsRequest("/ics/v3/banks");
    if (!response.ok) return NextResponse.json({ error: "Kunne ikke hente banker fra Neonomics." }, { status: 502 });
    const source = Array.isArray(response.value) ? response.value : response.value?.banks ?? response.value?.data ?? [];
    const banks = source.filter((bank: Record<string, unknown>) => String(bank.countryCode ?? bank.country ?? "").toUpperCase().includes("NO") || String(bank.id ?? "").toLowerCase().includes("norway")).map((bank: Record<string, unknown>) => ({ id: String(bank.id), name: String(bank.name ?? bank.displayName ?? bank.bic ?? "Bank") }));
    return NextResponse.json({ banks });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error && error.message === "NEONOMICS_AUTH_FAILED" ? "Neonomics avviste klienttilgangen." : "Kunne ikke hente banker." }, { status: 502 });
  }
}
