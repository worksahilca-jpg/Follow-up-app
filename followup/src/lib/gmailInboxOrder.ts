import type { Prisma } from "@prisma/client";

/**
 * The order a business's connected Gmail inboxes are read in whenever one
 * has to be picked without knowing which (bug b015): the oldest connection
 * first, then the row id so two connected in the same instant still sort
 * the same way every time. A null `connectedAt` is a connection from before
 * that column was recorded, so it counts as the oldest.
 *
 * Before this, every "the business's inbox" lookup was an unordered
 * findFirst, and on a business with two inboxes Postgres was free to return
 * either one: a reply, "Sync now", a push sync and the push watch could each
 * land on a different inbox from one call to the next.
 *
 * A leaf module on purpose: gmailSync.ts and gmailSyncNotices.ts need the
 * same order, and their tests mock @/lib/integrations/gmail wholesale.
 */
export const GMAIL_INBOX_ORDER: Prisma.IntegrationOrderByWithRelationInput[] = [
  { connectedAt: { sort: "asc", nulls: "first" } },
  { id: "asc" },
];
