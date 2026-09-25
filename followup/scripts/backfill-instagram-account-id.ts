/**
 * One-off: fill Business.instagramAccountId for Instagram accounts connected
 * before 2026-09-25 (audit research/audit/2026-09-24-app-review-path-audit.md,
 * F1/F2). The logic, and what it refuses to do, is in
 * src/lib/instagramAccountBackfill.ts; this file only runs it.
 *
 * NOT run automatically — not at build, not at deploy, not by cron. Run it
 * by hand, once, after both of these are true:
 *   1. migration 20260925010000_instagram_account_id is applied to the
 *      database you point it at (the column must exist), and
 *   2. the code that reads the column is deployed. (Running it earlier is
 *      harmless but pointless: nothing reads the column yet.)
 *
 * It needs two environment variables, and reads nothing else:
 *   DATABASE_URL          the database to backfill
 *   TOKEN_ENCRYPTION_KEY  the key the stored Instagram tokens are encrypted
 *                         with (src/lib/crypto.ts); without it the read fails
 *                         with "A stored credential is encrypted but
 *                         TOKEN_ENCRYPTION_KEY is not set" and nothing runs
 *
 * From the followup/ directory:
 *
 *   # 1. Dry run (the default). Reads, asks Meta /me?fields=user_id for each
 *   #    business, and prints what it WOULD write. Writes nothing.
 *   npx --yes tsx scripts/backfill-instagram-account-id.ts
 *
 *   # 2. Read the output. Then write:
 *   npx --yes tsx scripts/backfill-instagram-account-id.ts --apply
 *
 * If the variables live in an env file, Node's own flag loads it without
 * putting secrets in shell history (tsx passes it through to Node):
 *   npx --yes tsx --env-file=<file> scripts/backfill-instagram-account-id.ts
 *
 * Output, one line per business: `<businessId> @<handle>: <outcome> <accountId>`.
 * Outcomes are listed in src/lib/instagramAccountBackfill.ts. Anything
 * other than would_fill / filled is left untouched and makes the exit code
 * 1, so it gets looked at:
 *   - already_attached: another business already holds this Instagram
 *     account. The unique index on instagramAccountId refuses the second
 *     binding. A person decides which business keeps it.
 *   - refused: Meta refused the stored token (expired 60-day token,
 *     revoked). The owner reconnects in Settings, which fills the column.
 *   - no_user_id / different_account: see the module.
 * Safe to re-run: it only ever looks at rows still missing the value.
 *
 * Never prints a token. It prints business ids, handles and Instagram
 * account ids.
 */
import { prisma } from "@/lib/db";
import { backfillInstagramAccountIds, needsAttention } from "@/lib/instagramAccountBackfill";

const USAGE = "Usage: npx --yes tsx scripts/backfill-instagram-account-id.ts [--apply]\n" +
  "  (no flag)  dry run: calls Meta, prints what would change, writes nothing\n" +
  "  --apply    write instagramAccountId for each business that resolves cleanly";

async function main(): Promise<number> {
  const args = process.argv.slice(2);
  if (args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    return 0;
  }
  const unknown = args.filter((a) => a !== "--apply");
  if (unknown.length > 0) {
    console.error(`Unknown argument(s): ${unknown.join(" ")}\n${USAGE}`);
    return 2;
  }
  if (!process.env.DATABASE_URL) {
    console.error("DATABASE_URL is not set. See the header of this file for what the script needs.");
    return 2;
  }

  const apply = args.includes("--apply");
  const results = await backfillInstagramAccountIds({ apply, log: (line) => console.log(line) });

  const counts = new Map<string, number>();
  for (const r of results) counts.set(r.outcome, (counts.get(r.outcome) ?? 0) + 1);
  const summary = [...counts.entries()].map(([outcome, n]) => `${outcome}=${n}`).join(", ") || "nothing to do";
  console.log(`\n${apply ? "Applied" : "Dry run — nothing written"}. ${summary}`);
  if (!apply && counts.get("would_fill")) console.log("Re-run with --apply to write.");

  return results.some(needsAttention) ? 1 : 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    // A Prisma error's message can reprint query arguments, so those get
    // name and code only. Anything else (the missing-key error from
    // src/lib/crypto.ts is the likely one) is ours and safe to show.
    const name = err instanceof Error ? err.name : "UnknownError";
    const code = err && typeof err === "object" && "code" in err ? ` ${String(err.code)}` : "";
    const message = err instanceof Error && !name.startsWith("Prisma") ? `: ${err.message}` : "";
    console.error(`Backfill failed: ${name}${code}${message}`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
