/**
 * Every table a migration creates has row-level security on.
 *
 * Supabase serves the public schema through its Data API to the `anon` /
 * `authenticated` roles; RLS with no policies is what shuts that door
 * (docs/least-privilege-db-role.md). Twelve tables created after the
 * 2026-09-08 sweep never got it, until the blanket migration
 * 20260926090000_enable_rls_all_public_tables. That migration only covers
 * tables that exist when it runs — so a table created by any LATER
 * migration must enable RLS itself, and this test fails CI when one
 * doesn't.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join } from "path";

const migrationsDir = join(__dirname, "..", "..", "..", "prisma", "migrations");
const BLANKET = "20260926090000_enable_rls_all_public_tables";

const migrations = readdirSync(migrationsDir)
  .filter((d) => /^\d{14}_/.test(d) && existsSync(join(migrationsDir, d, "migration.sql")))
  .sort();

const sql = (dir: string) => readFileSync(join(migrationsDir, dir, "migration.sql"), "utf8");

describe("row-level security on migrated tables", () => {
  it("the blanket migration exists and only touches tables the migrating role owns", () => {
    expect(migrations).toContain(BLANKET);
    const text = sql(BLANKET);
    expect(text).toMatch(/ENABLE ROW LEVEL SECURITY/);
    expect(text).toMatch(/tableowner\s*=\s*current_user/);
    expect(text).toMatch(/rowsecurity\s*=\s*false/);
  });

  it("every table created after it enables RLS in some migration", () => {
    const later = migrations.filter((d) => d > BLANKET);
    const created = later.flatMap((d) =>
      [...sql(d).matchAll(/CREATE TABLE (?:IF NOT EXISTS )?"?([A-Za-z_][A-Za-z0-9_]*)"?/g)].map((m) => m[1])
    );
    const all = migrations.map(sql).join("\n");
    const missing = created.filter(
      (t) => !new RegExp(`ALTER TABLE (?:IF EXISTS )?(?:"?public"?\\.)?"?${t}"? ENABLE ROW LEVEL SECURITY`).test(all)
    );
    expect(missing).toEqual([]);
  });
});
