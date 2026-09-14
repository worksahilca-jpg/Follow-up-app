/**
 * Prisma 7 moved connection URLs out of schema.prisma.
 *
 * The split that `url` / `directUrl` used to express in the datasource block
 * now lives in two different places, and the distinction still matters just
 * as much as it did:
 *
 *  - MIGRATIONS (this file) use DIRECT_URL — Supabase's port-5432 direct
 *    connection. `prisma migrate` cannot run through a pgbouncer pooler,
 *    which is the whole reason DIRECT_URL exists.
 *  - THE RUNNING APP (src/lib/db.ts) uses DATABASE_URL — the pooled
 *    port-6543 URL — handed to the pg driver adapter, because Prisma 7
 *    requires an adapter rather than resolving a URL from the schema.
 *
 * Neither variable changed name or meaning; only where they are read.
 */
import path from "node:path";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
  },
  datasource: {
    url: env("DIRECT_URL"),
  },
});
