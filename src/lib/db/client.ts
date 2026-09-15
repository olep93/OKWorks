import "server-only";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

// postgres.js opens connections lazily, so a non-routable build-time value lets
// Next.js inspect route modules without requiring production secrets locally.
const connectionString = process.env.DATABASE_URL ?? "postgresql://build:build@127.0.0.1:5432/build";
const client = postgres(connectionString, { prepare: false, max: 5 });

export const db = drizzle(client, { schema });
