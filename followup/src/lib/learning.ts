import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

/**
 * The life of everything FollowUp is taught (milestone 1 of the founder's assistant brief, 2026-10-22, part 16:
 * "observe, propose, approve, test, activate, monitor, roll back"; "record the source and history of every learning
 * item"; "do not silently overwrite").
 *
 * A lesson (a rule, an example) has a status, and only an ACTIVE one reaches a reply. Every change is one
 * LearningEvent row with the words before and after it, so any change can be read back and undone. Today the
 * founder's own save on Admin → Train is the approval (A-297, A-294), so those lessons go straight to ACTIVE; the
 * statuses in between are for the review and test steps that come with milestone 3, and the moves between them are
 * fixed here so no caller can skip one.
 */

export const LEARNING_STATUSES = ["DRAFT", "AWAITING_APPROVAL", "APPROVED", "TESTING", "ACTIVE", "REJECTED", "ROLLED_BACK"] as const;
export type LearningStatus = (typeof LEARNING_STATUSES)[number];

export const LEARNING_KINDS = ["training_rule", "training_example", "training_conversation", "owner_example"] as const;
export type LearningKind = (typeof LEARNING_KINDS)[number];

export const LEARNING_ACTIONS = ["created", "edited", "rolled_back", "restored", "removed"] as const;
export type LearningAction = (typeof LEARNING_ACTIONS)[number];

/**
 * Where a lesson may go from each status. ACTIVE is reached only through approval (APPROVED, or TESTING once a test
 * applies), or by putting back one that was rolled back; nothing goes from DRAFT to ACTIVE in one step. A rejected
 * lesson can be reopened as a draft; a rolled-back one can be put back.
 */
const NEXT: Record<LearningStatus, readonly LearningStatus[]> = {
  DRAFT: ["AWAITING_APPROVAL", "REJECTED"],
  AWAITING_APPROVAL: ["APPROVED", "REJECTED", "DRAFT"],
  APPROVED: ["TESTING", "ACTIVE", "REJECTED"],
  TESTING: ["ACTIVE", "REJECTED"],
  ACTIVE: ["ROLLED_BACK"],
  REJECTED: ["DRAFT"],
  ROLLED_BACK: ["ACTIVE"],
};

export function isLearningStatus(v: unknown): v is LearningStatus {
  return typeof v === "string" && (LEARNING_STATUSES as readonly string[]).includes(v);
}

export function canMove(from: LearningStatus, to: LearningStatus): boolean {
  return NEXT[from].includes(to);
}

/** Only an active lesson is used. Anything else, including a status this code doesn't know, is not. */
export function isLive(status: unknown): boolean {
  return status === "ACTIVE";
}

/** The status a reply reads lessons with: one place, so a new status can never leak into replies by default. */
export const LIVE_STATUS: LearningStatus = "ACTIVE";

export type LearningEventInput = {
  businessId?: string | null;
  trade?: string | null;
  kind: LearningKind;
  targetId: string;
  action: LearningAction;
  fromStatus?: LearningStatus | null;
  toStatus?: LearningStatus | null;
  version?: number | null;
  before?: Prisma.InputJsonValue | null;
  after?: Prisma.InputJsonValue | null;
  byUserId?: string | null;
  note?: string | null;
};

type EventWriter = { learningEvent: { create: (args: { data: Prisma.LearningEventUncheckedCreateInput }) => Promise<unknown> } };

function eventData(e: LearningEventInput): Prisma.LearningEventUncheckedCreateInput {
  return {
    businessId: e.businessId ?? null,
    trade: e.trade ?? null,
    kind: e.kind,
    targetId: e.targetId,
    action: e.action,
    fromStatus: e.fromStatus ?? null,
    toStatus: e.toStatus ?? null,
    version: e.version ?? null,
    before: e.before ?? undefined,
    after: e.after ?? undefined,
    byUserId: e.byUserId ?? null,
    note: e.note ? e.note.slice(0, 500) : null,
  };
}

/** The write itself, for use inside a transaction, where a failure must undo the change it records. */
export function learningEventWrite(db: EventWriter, e: LearningEventInput) {
  return db.learningEvent.create({ data: eventData(e) });
}

/**
 * Records one change after it was made. Never throws: the change itself already happened, and a lesson must not fail
 * over its own bookkeeping. A failure is logged, like the other after-the-fact records (src/lib/audit.ts).
 */
export async function recordLearningEvent(e: LearningEventInput): Promise<void> {
  try {
    await learningEventWrite(prisma, e);
  } catch (err) {
    console.error(`Learning history not recorded for ${e.kind} ${e.targetId} (${e.action}):`, err);
  }
}

export type LearningHistoryRow = {
  action: string;
  fromStatus: string | null;
  toStatus: string | null;
  version: number | null;
  before: unknown;
  after: unknown;
  byUserId: string | null;
  note: string | null;
  createdAt: Date;
};

/**
 * One lesson's history, oldest first. A business's own lesson is read only with that business's id, so an id from
 * another business returns nothing; a lesson the founder set for a kind of business (no business) is read with null.
 */
export async function learningHistory(kind: LearningKind, targetId: string, businessId: string | null): Promise<LearningHistoryRow[]> {
  return prisma.learningEvent.findMany({
    where: { kind, targetId, businessId },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { action: true, fromStatus: true, toStatus: true, version: true, before: true, after: true, byUserId: true, note: true, createdAt: true },
  });
}
