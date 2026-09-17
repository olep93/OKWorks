import "server-only";

import { createHash, randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt, isNotNull, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { authSessions, organizationMembers, users } from "@/lib/db/schema";
import { db } from "@/lib/db/client";

const scrypt = promisify(scryptCallback);
const SESSION_COOKIE = "okworks_session";

export function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const derived = (await scrypt(password, salt, 64)) as Buffer;
  return `${salt}:${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, expectedHex] = stored.split(":");
  if (!salt || !expectedHex) return false;
  const actual = (await scrypt(password, salt, 64)) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  await db.insert(authSessions).values({ userId, tokenHash: tokenHash(token), expiresAt });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function clearSession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) await db.delete(authSessions).where(eq(authSessions.tokenHash, tokenHash(token)));
  store.delete(SESSION_COOKIE);
}

export async function getCurrentUser() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const rows = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    organizationId: organizationMembers.organizationId,
    role: organizationMembers.role,
  }).from(authSessions)
    .innerJoin(users, eq(authSessions.userId, users.id))
    .innerJoin(organizationMembers, eq(organizationMembers.userId, users.id))
    .where(and(eq(authSessions.tokenHash, tokenHash(token)), gt(authSessions.expiresAt, new Date()), eq(organizationMembers.active, true), or(eq(users.verificationRequired, false), isNotNull(users.emailVerifiedAt))))
    .limit(1);
  return rows[0] ?? null;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
