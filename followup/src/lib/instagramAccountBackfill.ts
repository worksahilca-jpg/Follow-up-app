import { prisma } from "@/lib/db";
import { resolveInstagramUserId } from "@/lib/instagram";

/**
 * Fills Business.instagramAccountId for accounts connected before the
 * column existed (2026-09-25), by asking Meta's /me for `user_id` with the
 * token each business already holds.
 *
 * Run by hand, never on a schedule or at deploy — see
 * scripts/backfill-instagram-account-id.ts for how. Until it runs, an
 * account connected earlier keeps today's behaviour exactly: webhooks
 * still do not route to it, and the poller still cannot recognise the
 * account's own messages (audit 2026-09-24 F1/F2). Reconnecting the
 * account in Settings fills the column too.
 *
 * What it will not do:
 *  - Write anything unless `apply` is true. The default is a dry run
 *    that calls Meta and reports what it would write.
 *  - Overwrite a value. Only rows whose instagramAccountId is still null
 *    are read, and the write is conditional on that still being true (and
 *    on the stored app-scoped id being unchanged), so a reconnect that
 *    lands mid-run wins.
 *  - Attach one Instagram account to two businesses. The column is
 *    unique; a second business holding the same account is reported as
 *    `already_attached` and left alone for a person to resolve.
 *  - Trust a token that now resolves to a different account than the one
 *    stored beside it (`different_account`). That is a question for a
 *    person, not something to paper over with a new id.
 *
 * Output is identifiers only: business ids, handles and account ids, all
 * of which are public or internal. Never a token — resolveInstagramUserId
 * returns Meta's sentence on failure, which does not contain one.
 */

export type BackfillOutcome =
  | "filled" // written
  | "would_fill" // dry run: would be written
  | "no_user_id" // Meta answered but returned no usable user_id
  | "refused" // Meta refused the token (expired, revoked, unreachable)
  | "different_account" // the token resolves to a different app-scoped id than the one stored
  | "already_attached" // another business already holds this account id
  | "changed_meanwhile" // the row changed (reconnect/disconnect) between read and write
  | "error"; // anything else; name and code only

export type BackfillResult = {
  businessId: string;
  username: string | null;
  outcome: BackfillOutcome;
  accountId?: string;
  detail?: string;
};

function isUniqueViolation(err: unknown): boolean {
  return !!err && typeof err === "object" && "code" in err && err.code === "P2002";
}

export async function backfillInstagramAccountIds(options: {
  apply: boolean;
  log?: (line: string) => void;
}): Promise<BackfillResult[]> {
  const log = options.log ?? (() => {});
  const mode = options.apply ? "apply" : "dry run";

  const businesses = await prisma.business.findMany({
    where: { instagramAccessToken: { not: null }, instagramAccountId: null },
    select: { id: true, instagramUserId: true, instagramUsername: true, instagramAccessToken: true },
    orderBy: { createdAt: "asc" },
  });
  log(`[${mode}] ${businesses.length} business(es) with an Instagram token and no instagramAccountId.`);

  const results: BackfillResult[] = [];
  const record = (result: BackfillResult) => {
    results.push(result);
    const who = `${result.businessId}${result.username ? ` @${result.username}` : ""}`;
    log(`[${mode}] ${who}: ${result.outcome}${result.accountId ? ` ${result.accountId}` : ""}${result.detail ? ` (${result.detail})` : ""}`);
  };

  for (const business of businesses) {
    const base = { businessId: business.id, username: business.instagramUsername };
    // The findMany filter already excludes a null token; this narrows the type.
    if (!business.instagramAccessToken) continue;

    const resolved = await resolveInstagramUserId(business.instagramAccessToken);
    if ("error" in resolved) {
      record({ ...base, outcome: "refused", detail: resolved.error });
      continue;
    }
    if (business.instagramUserId && resolved.id !== business.instagramUserId) {
      record({ ...base, outcome: "different_account", detail: `token resolves to ${resolved.id}, stored ${business.instagramUserId}` });
      continue;
    }
    if (!resolved.accountId) {
      record({ ...base, outcome: "no_user_id" });
      continue;
    }
    const accountId = resolved.accountId;

    // Reported in the dry run too, so the conflict is visible before any
    // write. The unique index is still what actually prevents it — this
    // read can be raced; the constraint cannot.
    // Either column: the same account can sit in another business's
    // instagramUserId, which the per-column unique index would not catch
    // (pr324-review P4).
    const holder = await prisma.business.findFirst({
      where: { id: { not: business.id }, OR: [{ instagramAccountId: accountId }, { instagramUserId: accountId }] },
      select: { id: true },
    });
    if (holder) {
      record({ ...base, outcome: "already_attached", accountId, detail: `held by business ${holder.id}` });
      continue;
    }

    if (!options.apply) {
      record({ ...base, outcome: "would_fill", accountId });
      continue;
    }

    try {
      const { count } = await prisma.business.updateMany({
        where: { id: business.id, instagramAccountId: null, instagramUserId: business.instagramUserId },
        data: { instagramAccountId: accountId },
      });
      record({ ...base, outcome: count === 1 ? "filled" : "changed_meanwhile", accountId });
    } catch (err) {
      if (isUniqueViolation(err)) {
        record({ ...base, outcome: "already_attached", accountId });
        continue;
      }
      // Name and code only: a Prisma error message can reprint arguments.
      const code = err && typeof err === "object" && "code" in err ? ` ${String(err.code)}` : "";
      record({ ...base, outcome: "error", accountId, detail: `${err instanceof Error ? err.name : "UnknownError"}${code}` });
    }
  }

  return results;
}

/** Outcomes a person should look at before calling the backfill done. */
export function needsAttention(result: BackfillResult): boolean {
  return result.outcome !== "filled" && result.outcome !== "would_fill";
}
