import "server-only";
import { createHash } from "node:crypto";
import { sqlClient } from "@/lib/db/client";

// Separate namespace from verification/recovery limits, reusing durable storage.
// Do not store passwords, raw email addresses or caller-supplied IP headers.
export async function checkLoginLimit(email: string) {
  const scope = createHash("sha256").update(`login:${email.trim().toLowerCase()}`).digest("hex");
  const rows = await sqlClient`INSERT INTO auth_mail_limits (scope_hash) VALUES (${scope})
    ON CONFLICT (scope_hash) DO UPDATE SET
      attempts = CASE WHEN auth_mail_limits.window_start <= now() - interval '15 minutes' THEN 1 ELSE LEAST(auth_mail_limits.attempts, 20) + 1 END,
      window_start = CASE WHEN auth_mail_limits.window_start <= now() - interval '15 minutes' THEN now() ELSE auth_mail_limits.window_start END
    RETURNING attempts, GREATEST(1, CEIL(EXTRACT(EPOCH FROM (window_start + interval '15 minutes' - now()))))::int AS retry_after`;
  return { allowed: Number(rows[0].attempts) <= 20, retryAfter: Number(rows[0].retry_after) };
}
