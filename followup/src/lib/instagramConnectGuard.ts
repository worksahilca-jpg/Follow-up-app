import { prisma } from "@/lib/db";

/**
 * What a connect (the OAuth callback or a pasted token) may write for the
 * two Instagram ids — or that it must refuse.
 *
 * Shared by both connect paths so they cannot drift apart again; each
 * used to decide this inline (research/audit/2026-09-25-pr324-review.md
 * P4 and P5).
 *
 * P5 — a reconnect must not blank a good professional-account id.
 *   resolveInstagramUserId retries without `user_id` on any 400, and it
 *   cannot tell "Meta doesn't know that field" from any other 400. A
 *   retry that succeeds returns the same app-scoped `id` and no
 *   `accountId`. Writing `accountId ?? null` then cleared the id webhooks
 *   route on, silently. When the token resolves to the SAME app-scoped id
 *   already stored, it is the same account, so the stored professional id
 *   is still true and is kept. A DIFFERENT account still gets null: a
 *   previous account's id beside a new account's token would route the
 *   old account's DMs here.
 *
 * P4 — one Instagram account on one business, checked across columns.
 *   `instagramUserId` and `instagramAccountId` are each unique, but only
 *   within their own column. A token from a different Meta app gives a
 *   different app-scoped id for the same account, and a business whose
 *   professional id is still null clashes with nothing — so the same
 *   account could be saved on two businesses. This refuses when any other
 *   business holds either id in either column. The unique indexes remain
 *   the real guarantee (this read can be raced); this closes the gap they
 *   leave between columns.
 */
export async function planInstagramIdWrite(
  businessId: string,
  resolved: { id: string; accountId?: string }
): Promise<{ ok: true; instagramAccountId: string | null } | { ok: false }> {
  const current = await prisma.business.findUnique({
    where: { id: businessId },
    select: { instagramUserId: true, instagramAccountId: true },
  });
  const sameAccount = !!current?.instagramUserId && current.instagramUserId === resolved.id;
  const instagramAccountId = resolved.accountId ?? (sameAccount ? current?.instagramAccountId ?? null : null);

  const ids = [resolved.id, ...(instagramAccountId ? [instagramAccountId] : [])];
  if (await instagramIdsHeldElsewhere(businessId, ids)) return { ok: false };
  return { ok: true, instagramAccountId };
}

/** Does any OTHER business hold any of these ids, in either Instagram id column? */
export async function instagramIdsHeldElsewhere(businessId: string, ids: string[]): Promise<boolean> {
  if (ids.length === 0) return false;
  const holder = await prisma.business.findFirst({
    where: {
      id: { not: businessId },
      OR: [{ instagramUserId: { in: ids } }, { instagramAccountId: { in: ids } }],
    },
    select: { id: true },
  });
  return holder !== null;
}
