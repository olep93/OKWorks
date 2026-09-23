import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession, verifyPassword } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { users } from "@/lib/db/schema";
import { checkLoginLimit } from "@/lib/login-limit";

const inputSchema = z.object({ email: z.string().trim().email().max(320), password: z.string().min(1).max(200) });

export async function POST(request: Request) {
  try {
    const parsed = inputSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "Ugyldig e-post eller passord." }, { status: 400 });
    const email = parsed.data.email.trim().toLowerCase();
    // Consume before checking account existence or doing expensive password work.
    const limit = await checkLoginLimit(email);
    if (!limit.allowed) return NextResponse.json({ error: "For mange innloggingsforsøk. Vent litt før du prøver igjen.", retryAfter: limit.retryAfter }, { status: 429, headers: { "Retry-After": String(limit.retryAfter), "Cache-Control": "no-store" } });
    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (!user) return NextResponse.json({ error: "Ugyldig e-post eller passord." }, { status: 401 });
    if (!user.passwordHash) return NextResponse.json({ needsSetup: true });
    if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return NextResponse.json({ error: "Ugyldig e-post eller passord." }, { status: 401 });
    }
    if (user.verificationRequired && !user.emailVerifiedAt) return NextResponse.json({ needsVerification: true, message: "Bekreft e-postadressen før du logger inn. Du kan be om en ny lenke." });
    await createSession(user.id);
    return NextResponse.json({ ok: true });
  } catch {
    // Fail closed if the shared limit or authentication database is unavailable.
    return NextResponse.json({ error: "Innlogging er midlertidig utilgjengelig. Prøv igjen senere." }, { status: 503 });
  }
}
