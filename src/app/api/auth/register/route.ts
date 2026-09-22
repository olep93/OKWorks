import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword } from "@/lib/auth";
import { authEmailConfig, allowVerificationEmail, sendVerificationEmail } from "@/lib/auth-email";
import { sqlClient } from "@/lib/db/client";

const inputSchema = z.object({
  name: z.string().trim().min(2, "Skriv inn navnet ditt.").max(160),
  email: z.email("Skriv inn en gyldig e-postadresse."),
  companyName: z.string().trim().min(2, "Skriv inn firmanavnet.").max(200),
  organizationNumber: z.string().trim().max(20).optional(),
  password: z.string().min(10, "Passordet må ha minst 10 tegn.").max(200),
  confirmPassword: z.string().min(1, "Gjenta passordet."),
  acceptedTerms: z.literal(true, { error: "Du må bekrefte vilkårene." }),
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passordene er ikke like.",
  path: ["confirmPassword"],
});

export async function POST(request: Request) {
  const parsed = inputSchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Kontroller opplysningene." }, { status: 400 });
  const email = parsed.data.email.trim().toLowerCase();
  try {
    authEmailConfig();
    if (!(await allowVerificationEmail(email))) return NextResponse.json({ error: "For mange forsøk. Prøv igjen om en time." }, { status: 429 });
    const passwordHash = await hashPassword(parsed.data.password);
    await sqlClient.begin(async (tx) => {
      const existing = await tx`SELECT id FROM users WHERE lower(email) = ${email} LIMIT 1`;
      if (existing.length) throw new Error("EMAIL_EXISTS");
      const organizations = await tx`INSERT INTO organizations (name, organization_number, email, invoice_email) VALUES (${parsed.data.companyName}, ${parsed.data.organizationNumber || null}, ${email}, ${email}) RETURNING id`;
      const organizationId = String(organizations[0].id);
      const users = await tx`INSERT INTO users (email, name, password_hash, verification_required) VALUES (${email}, ${parsed.data.name}, ${passwordHash}, true) RETURNING id`;
      const userId = String(users[0].id);
      await tx`INSERT INTO organization_members (organization_id, user_id, role) VALUES (${organizationId}, ${userId}, 'OWNER')`;
      await tx`INSERT INTO organization_settings (organization_id) VALUES (${organizationId})`;
      await tx`INSERT INTO invoice_sequences (organization_id) VALUES (${organizationId}) ON CONFLICT DO NOTHING`;
      await tx`INSERT INTO audit_logs (organization_id, user_id, action, entity_type, entity_id, metadata) VALUES (${organizationId}, ${userId}, 'ORGANIZATION_REGISTERED', 'organization', ${organizationId}, ${JSON.stringify({ email })}::jsonb)`;
      return { userId };
    });
    try {
      await sendVerificationEmail(email);
      return NextResponse.json({ needsVerification: true, message: "Kontoen er opprettet. Bekreft e-postadressen via lenken vi har sendt før du logger inn." }, { status: 201 });
    } catch {
      return NextResponse.json({ needsVerification: true, message: "Kontoen er opprettet, men e-posten kunne ikke sendes. Bruk Send ny bekreftelseslenke." }, { status: 201 });
    }
  } catch (error) {
    if (error instanceof Error && error.message === "AUTH_EMAIL_NOT_CONFIGURED") return NextResponse.json({ error: "Registrering venter på at e-postoppsettet blir klart. Eksisterende brukere kan fortsatt logge inn." }, { status: 503 });
    if (error instanceof Error && (error.message === "EMAIL_EXISTS" || error.message.includes("users_email_unique"))) return NextResponse.json({ error: "E-postadressen er allerede registrert. Logg inn eller be om ny bekreftelseslenke." }, { status: 409 });
    return NextResponse.json({ error: "Kunne ikke opprette firmaet. Prøv igjen." }, { status: 500 });
  }
}
