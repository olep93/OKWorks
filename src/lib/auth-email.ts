import "server-only";
import { randomBytes } from "node:crypto";
import { tokenHash } from "@/lib/auth";
import { sqlClient } from "@/lib/db/client";

export function authEmailConfig() {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.AUTH_FROM_EMAIL;
  const base = process.env.APP_URL;
  if (!key || !from || !base) throw new Error("AUTH_EMAIL_NOT_CONFIGURED");
  const url = new URL(base);
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) throw new Error("AUTH_EMAIL_NOT_CONFIGURED");
  return { key, from, url };
}

export async function allowVerificationEmail(email: string) {
  const scope = tokenHash(`email-verification:${email}`);
  const rows = await sqlClient`INSERT INTO auth_mail_limits (scope_hash) VALUES (${scope}) ON CONFLICT (scope_hash) DO UPDATE SET attempts = CASE WHEN auth_mail_limits.window_start < now() - interval '1 hour' THEN 1 ELSE auth_mail_limits.attempts + 1 END, window_start = CASE WHEN auth_mail_limits.window_start < now() - interval '1 hour' THEN now() ELSE auth_mail_limits.window_start END RETURNING attempts`;
  return Number(rows[0].attempts) <= 5;
}

export async function sendVerificationEmail(email: string) {
  const { key, from, url } = authEmailConfig();
  const token = randomBytes(32).toString("base64url");
  const hashed = tokenHash(token);
  const rows = await sqlClient`UPDATE users SET verification_token_hash = ${hashed}, verification_expires_at = now() + interval '24 hours' WHERE email = ${email} AND verification_required = true AND email_verified_at IS NULL RETURNING id`;
  if (!rows.length) return;
  const link = new URL("/account/verify", url);
  link.hash = token;
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(15000),
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": `verify-${hashed}` },
      body: JSON.stringify({ from, to: [email], subject: "Bekreft e-postadressen din – OKFaktura", text: `Bekreft e-postadressen for kontoen din ved å åpne lenken og trykke Bekreft:\n\n${link.href}\n\nLenken er gyldig i 24 timer og kan brukes én gang. Hvis du ikke opprettet kontoen, kan du ignorere denne meldingen. Det er ikke opprettet noe betalt abonnement.` }),
    });
    if (!response.ok) throw new Error("AUTH_EMAIL_FAILED");
  } catch {
    await sqlClient`UPDATE users SET verification_token_hash = NULL, verification_expires_at = NULL WHERE verification_token_hash = ${hashed}`;
    throw new Error("AUTH_EMAIL_FAILED");
  }
}
