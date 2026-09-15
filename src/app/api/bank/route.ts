import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { sqlClient } from "@/lib/db/client";

export async function GET() {
  try {
    const user = await requireUser();
    const connections = await sqlClient`
      SELECT id, provider, account_number_masked, status, consent_expires_at, last_synced_at, created_at
      FROM bank_connections WHERE organization_id=${user.organizationId}
      ORDER BY created_at DESC
    `;
    return NextResponse.json({
      connections,
      configured: Boolean(process.env.NEONOMICS_CLIENT_ID && process.env.NEONOMICS_CLIENT_SECRET && process.env.BANK_TOKEN_ENCRYPTION_KEY),
      provider: "NEONOMICS",
      mode: process.env.NEONOMICS_ENVIRONMENT === "production" ? "production" : "sandbox",
    });
  } catch {
    return NextResponse.json({ error: "Ikke innlogget." }, { status: 401 });
  }
}
