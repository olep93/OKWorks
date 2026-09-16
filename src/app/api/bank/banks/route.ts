import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { neonomicsRequest } from "@/lib/neonomics";

export async function GET() {
  try {
    const user = await requireUser();
    const response = await neonomicsRequest("/ics/v3/banks?countryCode=NO", { deviceId: user.id });
    if (!response.ok) return NextResponse.json({ error: "Kunne ikke hente banker fra Neonomics." }, { status: 502 });
    const source = Array.isArray(response.value) ? response.value : response.value?.banks ?? response.value?.data ?? [];
    if (!Array.isArray(source)) return NextResponse.json({ error: "Neonomics returnerte et ukjent format for banklisten." }, { status: 502 });
    const banks = source.filter((bank: Record<string, unknown>) => bank.id && (!bank.countryCode || String(bank.countryCode).toUpperCase() === "NO")).map((bank: Record<string, unknown>) => ({ id: String(bank.id), name: String(bank.bankDisplayName ?? bank.bankOfficialName ?? bank.name ?? bank.displayName ?? bank.bic ?? "Bank") })).sort((a, b) => a.name.localeCompare(b.name, "nb"));
    if (!banks.length) return NextResponse.json({ error: "Neonomics returnerte ingen norske banker for denne tilgangen. Kontroller banktilgangen i sandbox." }, { status: 502 });
    return NextResponse.json({ banks });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
    return NextResponse.json({ error: error instanceof Error && error.message === "NEONOMICS_AUTH_FAILED" ? "Neonomics avviste klienttilgangen." : "Kunne ikke hente banker." }, { status: 502 });
  }
}
