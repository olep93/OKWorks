import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, tokenHash } from "@/lib/auth";
import { sqlClient } from "@/lib/db/client";

const requestInput = z.object({ email: z.email().max(320) });
const resetInput = z.object({ token: z.string().regex(/^[A-Za-z0-9_-]{43}$/), password: z.string().min(10).max(200) });
const generic = { message: "Hvis adressen har en konto, sender vi en lenke for å velge nytt passord. Sjekk også søppelpost." };

export async function POST(request: Request) {
  try {
    const parsed = requestInput.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Skriv en gyldig e-postadresse." }, { status: 400 });
    const apiKey = process.env.RESEND_API_KEY;
    const from = process.env.AUTH_FROM_EMAIL;
    const base = process.env.APP_URL;
    if (!apiKey || !from || !base) return NextResponse.json({ error: "Passordlenker er ikke aktivert ennå. E-postoppsettet må fullføres." }, { status: 503 });
    const url = new URL(base);
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("INVALID_APP_URL");
    const email = parsed.data.email.trim().toLowerCase();
    const scope = tokenHash(`password-reset:${email}`);
    const limits = await sqlClient`INSERT INTO auth_mail_limits (scope_hash) VALUES (${scope}) ON CONFLICT (scope_hash) DO UPDATE SET attempts = CASE WHEN auth_mail_limits.window_start < now() - interval '1 hour' THEN 1 ELSE auth_mail_limits.attempts + 1 END, window_start = CASE WHEN auth_mail_limits.window_start < now() - interval '1 hour' THEN now() ELSE auth_mail_limits.window_start END RETURNING attempts`;
    if (Number(limits[0].attempts) > 5) return NextResponse.json(generic);
    const token = randomBytes(32).toString("base64url");
    const hashed = tokenHash(token);
    const rows = await sqlClient`UPDATE users SET reset_token_hash = ${hashed}, reset_expires_at = now() + interval '30 minutes' WHERE lower(email) = ${email} AND password_hash IS NOT NULL RETURNING id`;
    if (rows.length) {
      // Fragment keeps the secret out of the server's page URL/access log.
      const link = new URL("/account/reset", url); link.hash = token;
      try {
        const response = await fetch("https://api.resend.com/emails", { method: "POST", signal: AbortSignal.timeout(15000), headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json", "Idempotency-Key": `reset-${hashed}` }, body: JSON.stringify({ from, to: [email], subject: "Velg nytt passord – OKFaktura", text: `Du har bedt om nytt passord til OKFaktura. Åpne lenken innen 30 minutter:\n\n${link.href}\n\nLenken kan bare brukes én gang. Hvis du ikke ba om dette, kan du ignorere e-posten. Ingen endring er gjort på passordet ditt.` }) });
        if (!response.ok) throw new Error("MAIL_FAILED");
      } catch {
        await sqlClient`UPDATE users SET reset_token_hash = NULL, reset_expires_at = NULL WHERE reset_token_hash = ${hashed}`;
        // Never reveal whether an address exists through provider errors.
        console.error("Password recovery email failed; no token or address logged.");
      }
    }
    return NextResponse.json(generic);
  } catch { return NextResponse.json({ error: "Kunne ikke behandle forespørselen. Prøv igjen senere." }, { status: 503 }); }
}

export async function PATCH(request: Request) {
  try {
    const parsed = resetInput.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: "Lenken er ugyldig, eller passordet må ha mellom 10 og 200 tegn." }, { status: 400 });
    const hashed = tokenHash(parsed.data.token);
    const matches = await sqlClient`SELECT id FROM users WHERE reset_token_hash = ${hashed} AND reset_expires_at > now() LIMIT 1`;
    if (!matches.length) return NextResponse.json({ error: "Lenken er brukt eller utløpt. Be om en ny lenke." }, { status: 400 });
    const passwordHash = await hashPassword(parsed.data.password);
    const changed = await sqlClient.begin(async (tx) => {
      const rows = await tx`UPDATE users SET password_hash = ${passwordHash}, reset_token_hash = NULL, reset_expires_at = NULL, updated_at = now() WHERE reset_token_hash = ${hashed} AND reset_expires_at > now() RETURNING id`;
      if (!rows.length) return false;
      await tx`DELETE FROM auth_sessions WHERE user_id = ${rows[0].id}`;
      return true;
    });
    return changed ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Lenken er brukt eller utløpt. Be om en ny lenke." }, { status: 400 });
  } catch { return NextResponse.json({ error: "Kunne ikke endre passordet." }, { status: 503 }); }
}
