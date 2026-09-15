import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { decryptBankValue } from "@/lib/bank-crypto";
import { sqlClient } from "@/lib/db/client";
import { neonomicsRequest } from "@/lib/neonomics";

export async function GET(request: Request) {
  const appUrl = new URL("/", request.url);
  try {
    const user = await requireUser();
    const connectionId = new URL(request.url).searchParams.get("connection");
    if (!connectionId) throw new Error("MISSING_CONNECTION");
    const rows = await sqlClient`SELECT id, device_id, provider_session_encrypted FROM bank_connections WHERE id=${connectionId} AND organization_id=${user.organizationId} LIMIT 1`;
    if (!rows[0]) throw new Error("MISSING_CONNECTION");
    const sessionId = decryptBankValue(String(rows[0].provider_session_encrypted));
    const accounts = await neonomicsRequest("/ics/v3/accounts?scope=business-accounts", { sessionId, deviceId: String(rows[0].device_id) });
    if (!accounts.ok) { appUrl.searchParams.set("bank", "consent_failed"); return NextResponse.redirect(appUrl); }
    const source = Array.isArray(accounts.value) ? accounts.value : accounts.value?.accounts ?? [];
    const first = source[0] ?? {};
    const masked = String(first.bban ?? first.iban ?? first.accountNumber ?? "").replace(/.(?=.{4})/g, "•");
    await sqlClient`UPDATE bank_connections SET status='CONNECTED', provider_account_id=${first.id ? String(first.id) : null}, account_number_masked=${masked || null}, consent_expires_at=now() + interval '180 days', updated_at=now() WHERE id=${connectionId} AND organization_id=${user.organizationId}`;
    appUrl.searchParams.set("bank", "connected");
    return NextResponse.redirect(appUrl);
  } catch {
    appUrl.searchParams.set("bank", "error");
    return NextResponse.redirect(appUrl);
  }
}
