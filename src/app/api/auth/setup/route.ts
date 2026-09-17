import { and, eq, gt, isNull } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, hashPassword, tokenHash } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const inputSchema = z.object({
  email: z.email(),
  setupCode: z.string().min(20),
  password: z.string().min(10, "Passordet må ha minst 10 tegn."),
});

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Ugyldig informasjon." }, { status: 400 });
  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(and(
    eq(users.email, email),
    isNull(users.passwordHash),
    eq(users.setupTokenHash, tokenHash(parsed.data.setupCode)),
    gt(users.setupExpiresAt, new Date()),
  )).limit(1);
  if (!user) return NextResponse.json({ error: "Oppstartskoden er ugyldig eller utløpt." }, { status: 401 });
  const changed = await db.update(users).set({
    passwordHash: await hashPassword(parsed.data.password),
    setupTokenHash: null,
    setupExpiresAt: null,
    emailVerifiedAt: new Date(),
    updatedAt: new Date(),
  }).where(and(eq(users.id, user.id), isNull(users.passwordHash), eq(users.setupTokenHash, tokenHash(parsed.data.setupCode)), gt(users.setupExpiresAt, new Date()))).returning({ id: users.id });
  if (!changed.length) return NextResponse.json({ error: "Oppstartskoden er allerede brukt eller utløpt." }, { status: 401 });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
