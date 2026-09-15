import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";

export async function POST(request: Request) {
  const parsed = z.object({ email: z.email() }).safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: "Skriv inn en gyldig e-postadresse." }, { status: 400 });
  const [user] = await db.select({ passwordHash: users.passwordHash }).from(users).where(eq(users.email, parsed.data.email.trim().toLowerCase())).limit(1);
  if (!user) return NextResponse.json({ error: "Brukeren finnes ikke." }, { status: 404 });
  return NextResponse.json({ needsSetup: !user.passwordHash });
}
