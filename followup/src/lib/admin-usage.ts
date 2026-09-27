import { prisma } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import { getPendingApprovals } from "@/lib/pendingApprovals";

/**
 * "How FollowUp is being used", for the founder's /admin page (founder's
 * call, 2026-09-26: "I want a page … where I can see the analytics of this
 * product so that I can work on it accordingly").
 *
 * Every number is counted from rows the app already writes, across all
 * businesses, for the last 7 days and the 7 before them, so a change reads
 * as a direction and not a lone figure. Counts only: no names, no message
 * text, nothing that identifies a customer.
 */

export interface UsageWeek {
  newCustomers: number; // leads created
  repliesWritten: number; // customers FollowUp wrote a reply for (held for OK, or sent on its own)
  sentByOwner: number; // replies a person sent from FollowUp
  sentAutomatically: number; // follow-ups FollowUp sent itself, not counting the "got it" reply
  instantAcks: number; // the quick "got your message" replies
  dismissed: number; // drafts the owner chose not to send
  cameBack: number; // distinct customers who replied to a message FollowUp sent
  accountsActive: number; // businesses where a person did something logged
}

export interface FeatureUse {
  label: string;
  accounts: number;
}

export interface ProductUsage {
  thisWeek: UsageWeek;
  lastWeek: UsageWeek;
  waitingNow: number; // written replies not yet sent or dismissed, right now
  totalAccounts: number;
  features: FeatureUse[];
}

const DAY = 24 * 60 * 60 * 1000;

async function usageBetween(from: Date, to: Date): Promise<UsageWeek> {
  const range = { gte: from, lt: to };
  const [newCustomers, repliesWrittenRows, sentByOwner, sentAutomatically, instantAcks, dismissed, cameBackRows, activeRows] =
    await Promise.all([
      prisma.lead.count({ where: { createdAt: range } }),
      // Customers, not events: a held draft is re-examined every hour and
      // each pass can log another hold for the same person.
      prisma.auditEvent.groupBy({ by: ["targetId"], where: { action: { in: ["ai.hold", "ai.send"] }, targetId: { not: null }, createdAt: range } }),
      prisma.followUp.count({ where: { status: "sent", automated: false, sentAt: range } }),
      prisma.followUp.count({
        where: { status: "sent", automated: true, sentAt: range, NOT: { trigger: "instant_ack" } },
      }),
      prisma.followUp.count({ where: { status: "sent", trigger: "instant_ack", sentAt: range } }),
      prisma.auditEvent.count({ where: { action: "ai.hold_dismissed", createdAt: range } }),
      // One row per customer, however many of FollowUp's messages they answered.
      prisma.followUp.groupBy({ by: ["leadId"], where: { repliedAt: range } }),
      // A person acting (userId set), not the scheduler; one row per business.
      prisma.auditEvent.groupBy({ by: ["businessId"], where: { userId: { not: null }, createdAt: range } }),
    ]);
  return {
    newCustomers,
    repliesWritten: repliesWrittenRows.length,
    sentByOwner,
    sentAutomatically,
    instantAcks,
    dismissed,
    cameBack: cameBackRows.length,
    accountsActive: activeRows.length,
  };
}

// How many drafts are waiting for an owner's OK right now, across every
// account: exactly what each owner sees in "Needs your OK". It used to
// re-derive that from the latest decision event alone, which missed the
// other ways a draft stops waiting: the owner answered some other way
// (a newer outbound message), marked "We talked", or the lead left the
// list. So it counted more than any owner was actually being asked.
// Reusing getPendingApprovals keeps the two from drifting apart again.
export async function countWaitingForOk(): Promise<number> {
  const accounts = await prisma.auditEvent.findMany({
    where: { action: "ai.hold" },
    distinct: ["businessId"],
    select: { businessId: true },
  });
  let total = 0;
  for (const { businessId } of accounts) total += (await getPendingApprovals(businessId)).length;
  return total;
}

export async function getProductUsage(now: Date = new Date()): Promise<ProductUsage> {
  await requirePlatformAdmin();

  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY);

  const [thisWeek, lastWeek, waitingNow, totalAccounts, stages, plans, savedLists, tasks, bookings] = await Promise.all([
    usageBetween(weekAgo, now),
    usageBetween(twoWeeksAgo, weekAgo),
    countWaitingForOk(),
    prisma.business.count(),
    // Which parts of the product anyone uses at all: one row per business.
    prisma.lead.groupBy({ by: ["businessId"], where: { NOT: { stage: "NEW" } } }),
    prisma.sequence.groupBy({ by: ["businessId"] }),
    prisma.savedFilter.groupBy({ by: ["businessId"] }),
    prisma.task.findMany({ select: { lead: { select: { businessId: true } } }, distinct: ["leadId"] }),
    prisma.booking.groupBy({ by: ["businessId"] }),
  ]);

  const taskAccounts = new Set(tasks.map((t) => t.lead.businessId)).size;

  return {
    thisWeek,
    lastWeek,
    waitingNow,
    totalAccounts,
    features: [
      { label: "Moved a customer to a pipeline stage", accounts: stages.length },
      { label: "Made a follow-up plan", accounts: plans.length },
      { label: "Saved a list", accounts: savedLists.length },
      { label: "Added a task", accounts: taskAccounts },
      { label: "Got a booking", accounts: bookings.length },
    ],
  };
}
