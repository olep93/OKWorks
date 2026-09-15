import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth";
import { encryptBankValue } from "@/lib/bank-crypto";
import { sqlClient } from "@/lib/db/client";
import { neonomicsRequest } from "@/lib/neonomics";

const input = z.object({ bankId: z.string().min(3) });

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const parsed = input.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Velg en bank." }, { status: 400 });
    const deviceId = randomUUID();
    const session = await neonomicsRequest("/ics/v3/session", { method: "POST", deviceId, body: { bankId: parsed.data.bankId } });
    const sessionId = String(session.value?.sessionId ?? "");
    if (!session.ok || !sessionId) return NextResponse.json({ error: "Kunne ikke opprette banksesjon." }, { status: 502 });
    const rows = await sqlClient`INSERT INTO bank_connections (organization_id, provider, bank_id, device_id, provider_session_encrypted, status) VALUES (${user.organizationId}, 'NEONOMICS', ${parsed.data.bankId}, ${deviceId}, ${encryptBankValue(sessionId)}, 'CONSENT_REQUIRED') RETURNING id`;
    const connectionId = String(rows[0].id);
    const callback = new URL(`/api/bank/callback?connection=${connectionId}`, request.url).toString();
    const consent = await neonomicsRequest(`/ics/v3/consent/${encodeURIComponent(sessionId)}?scope=business-accounts`, { sessionId, deviceId, redirectUrl: callback });
    const links = consent.value?.links ?? [];
    const consentUrl = links.find((link: Record<string, unknown>) => String(link.rel ?? "").toLowerCase().includes("consent"))?.href ?? consent.value?.href;
    if (!consent.ok || !consentUrl) return NextResponse.json({ error: "Banken returnerte ingen samtykkelenke." }, { status: 502 });
    return NextResponse.json({ consentUrl });
  } catch (error) {
    if (error instanceof Error && error.message === "UNAUTHORIZED") return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
    return NextResponse.json({ error: "Kunne ikke starte banktilkoblingen." }, { status: 500 });
  }
}
