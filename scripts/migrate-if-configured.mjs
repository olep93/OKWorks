import { readFile } from "node:fs/promises";
import postgres from "postgres";

if (!process.env.DATABASE_URL) {
  console.log("DATABASE_URL is not set; skipping database migration.");
  process.exit(0);
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1 });
const migrations = ["0000_initial_portal", "0001_order_entries", "0002_invoices", "0003_invoice_finalization", "0004_order_entry_files", "0005_payment_reconciliation", "0006_bank_provider_session", "0007_invoice_deliveries", "0008_company_vehicle", "0009_password_recovery", "0010_email_verification", "0011_subscription_sandbox", "0012_audit_logs"];

try {
  await sql`CREATE TABLE IF NOT EXISTS okworks_migrations (
    name text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )`;
  for (const migrationName of migrations) {
    const applied = await sql`SELECT name FROM okworks_migrations WHERE name = ${migrationName}`;
    if (!applied.length) {
      const migration = await readFile(new URL(`../drizzle/${migrationName}.sql`, import.meta.url), "utf8");
      await sql.begin(async (transaction) => {
        await transaction.unsafe(migration);
        await transaction`INSERT INTO okworks_migrations (name) VALUES (${migrationName})`;
      });
      console.log(`Applied database migration ${migrationName}.`);
    } else {
      console.log(`Database migration ${migrationName} is already applied.`);
    }
  }
} finally {
  await sql.end();
}
