/**
 * An account has to be told it may send unreviewed, not told to be safe.
 *
 * `Business.holdAllForApproval` decides whether FollowUp may put a message
 * in front of a stranger without a human reading it first. The founder
 * ruled that out in those words on 2026-09-20: *"They'll put us on spam,
 * or they might report us."*
 *
 * It defaulted to `false`, with `grantBetaPlan` switching it on for every
 * tester it creates. That covers an account made the one expected way and
 * silently misses every other — a teammate signing in, or an account
 * carrying a stale `"active"` subscriptionStatus from earlier billing
 * work. Such an account passes `hasActiveAccess`, so a lead arriving by
 * email or website form would have had an instant reply sent unread.
 *
 * Six accounts were in that state when it was found on 2026-09-21. None
 * had sent anything and none had real leads, which is luck rather than
 * design — and luck is not a safeguard.
 *
 * These assertions read the schema and the grant/revoke pair as text,
 * which is blunt on purpose: the thing worth pinning is the *direction* of
 * a one-word default, and a unit test around a Prisma default would be
 * testing Prisma. A wrong value here is silent everywhere else.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (p: string) => readFileSync(join(__dirname, "..", "..", "..", p), "utf8");

describe("holding every message for approval is the default", () => {
  it("defaults the column to true in the schema", () => {
    const schema = read("prisma/schema.prisma");
    const line = schema.split("\n").find((l) => l.includes("holdAllForApproval") && l.includes("Boolean"));
    expect(line, "holdAllForApproval is missing from the schema").toBeTruthy();
    expect(
      line,
      "holdAllForApproval must default to true — a new account that nobody has configured must not be able to message a stranger unread"
    ).toContain("@default(true)");
  });

  it("has a migration that closed the gap on the accounts already created", () => {
    // The default alone protects new rows only. Six existing accounts were
    // sitting unheld when this was found.
    const sql = read("prisma/migrations/20260921090000_hold_all_by_default/migration.sql");
    expect(sql).toMatch(/ALTER COLUMN "holdAllForApproval" SET DEFAULT true/);
    expect(sql).toMatch(/UPDATE "Business" SET "holdAllForApproval" = true/);
  });

  it("still switches the hold ON when a tester is granted the beta plan", () => {
    // Belt and braces: the default covers accounts grantBetaPlan never
    // touches, and this covers the ones it does. Neither replaces the
    // other, and removing either reopens half the gap.
    const billing = read("src/lib/billing.ts");
    const grant = billing.slice(billing.indexOf("export async function grantBetaPlan"));
    expect(grant.slice(0, grant.indexOf("}\n\n"))).toContain("holdAllForApproval: true");
  });

  it("only ever turns the hold OFF where that is the deliberate meaning", () => {
    /*
     * revokeBetaPlan sets it false, and that is correct: it drops the
     * account back to Free, where automation.ts refuses to send anyway.
     *
     * This asserts nothing ELSE in the codebase writes `false` to it. The
     * owner's own switch in Settings posts a value rather than a literal,
     * so it does not appear here — which is the point. A literal `false`
     * anywhere new is a decision to let something send unread, and it
     * should have to be argued for rather than typed in passing.
     */
    const offenders: string[] = [];
    for (const file of ["src/lib/billing.ts", "src/lib/auth.ts", "src/app/api/onboarding/route.ts"]) {
      let source: string;
      try {
        source = read(file);
      } catch {
        continue;
      }
      for (const [i, line] of source.split("\n").entries()) {
        if (!/holdAllForApproval\s*:\s*false/.test(line)) continue;
        // The one sanctioned case.
        if (file === "src/lib/billing.ts" && source.slice(0, source.indexOf(line)).includes("revokeBetaPlan")) continue;
        offenders.push(`${file}:${i + 1}`);
      }
    }
    expect(offenders, `these turn the approval hold off: ${offenders.join(", ")}`).toEqual([]);
  });
});
