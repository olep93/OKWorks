import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

const inputSchema = z.object({ email: z.email(), password: z.string().min(1) });

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Ugyldig e-post eller passord." }, { status: 400 });
  const email = parsed.data.email.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) return NextResponse.json({ error: "Ugyldig e-post eller passord." }, { status: 401 });
  if (!user.passwordHash) return NextResponse.json({ needsSetup: true });
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return NextResponse.json({ error: "Ugyldig e-post eller passord." }, { status: 401 });
  }
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
