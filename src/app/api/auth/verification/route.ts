import { NextResponse } from "next/server";
import { z } from "zod";
import { tokenHash } from "@/lib/auth";
import { authEmailConfig, allowVerificationEmail, sendVerificationEmail } from "@/lib/auth-email";
import { sqlClient } from "@/lib/db/client";

export async function POST(request: Request) {
  try {
    const input = z.object({ email: z.email().max(320) }).safeParse(await request.json());
    if (!input.success) return NextResponse.json({ error: "Skriv en gyldig e-postadresse." }, { status: 400 });
    authEmailConfig();
    const email = input.data.email.trim().toLowerCase();
    if (await allowVerificationEmail(email)) {
      try { await sendVerificationEmail(email); }
      catch { console.error("Verification email failed; no address or token logged."); }
    }
    return NextResponse.json({ message: "Hvis kontoen venter på bekreftelse, sender vi en ny lenke. Sjekk også søppelpost. Maks fem forespørsler per time." });
  } catch {
    return NextResponse.json({ error: "Bekreftelseslenker er ikke tilgjengelige akkurat nå. Prøv igjen senere." }, { status: 503 });
  }
}

// A page GET never consumes the link: email scanners must not activate accounts.
export async function PATCH(request: Request) {
  try {
    const input = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).safeParse(await request.json());
    if (!input.success) return NextResponse.json({ error: "Ugyldig bekreftelseslenke." }, { status: 400 });
    const hash = tokenHash(input.data.token);
    const rows = await sqlClient`UPDATE users SET email_verified_at = now(), verification_token_hash = NULL, verification_expires_at = NULL, updated_at = now() WHERE verification_required = true AND email_verified_at IS NULL AND verification_token_hash = ${hash} AND verification_expires_at > now() RETURNING id`;
    if (!rows.length) return NextResponse.json({ error: "Lenken er brukt eller utløpt. Logg inn hvis du allerede har bekreftet, eller be om ny lenke." }, { status: 400 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Kunne ikke bekrefte e-postadressen. Prøv igjen senere." }, { status: 503 });
  }
}
