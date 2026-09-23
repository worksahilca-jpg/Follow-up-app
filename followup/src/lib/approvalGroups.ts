/**
 * Turning an approval queue into an answer to "who do I deal with first?"
 *
 * Founder, 2026-09-23:
 *
 * > "it should sort according to the sources then scores and let them
 * > know what is the priority and whom to focus on rather than reading
 * > all 600 drafts… for those who need less attention he should let them
 * > know that we can follow up in one click only if they want and they
 * > are safe to send."
 *
 * A flat list answers none of that. Ordered by urgency it still asks the
 * owner to work down 600 rows; ordered by recency it asks them to work
 * down 600 rows in a worse order. What an owner with a full queue
 * actually needs is a shape: these are the few that need you, here is the
 * best one to open first, and the rest are routine and can go together.
 *
 * ## What "safe" is allowed to mean here
 *
 * This file is the only place that decides a draft may be sent without
 * being read, so the bar is deliberately narrow and stated in one place
 * (`isSafeToSendInBulk`). Two independent things must BOTH be true, and
 * neither implies the other:
 *
 *   1. The only thing stopping it is the account's approval setting.
 *      Any other hold reason — a risk finding, an untouched lead, a
 *      backfilled thread — means the draft has a problem of its own and
 *      waits either way.
 *   2. The risk classifier looked at THIS draft and said low.
 *
 * Point 2 is not a restatement of point 1. Until 2026-09-23 the
 * classifier was skipped entirely on a holding account, so every held
 * draft carried a hardcoded "low" that nothing had ever assessed — which
 * is exactly why the verdict now lives on the draft
 * (Lead.suggestedRiskLevel) and why **null is not safe**. An unjudged
 * draft is not a safe draft; it is one nobody has looked at, and putting
 * it behind a button that says "these are fine" is how a made-up price
 * reaches a customer in the owner's name.
 */
import { isHeldOnlyByApprovalSetting } from "@/lib/holdReasons";
import type { PendingApproval } from "@/lib/pendingApprovals";

/**
 * What a group is called when the lead carries no source at all — a lead
 * typed in by hand, or imported from a CSV that had no channel column.
 * A real case, not a defensive default: the founder's own database had
 * five of them.
 */
export const UNKNOWN_SOURCE_LABEL = "Added by hand";

/** Everything the UI needs about one source's share of the queue. */
export type ApprovalGroup = {
  source: string;
  /** Read these. Ordered by score, highest first — the focus order. */
  needsYou: PendingApproval[];
  /** Routine. Offered as one action, never as 40 things to read. */
  safeToSend: PendingApproval[];
  /**
   * The highest score in `needsYou`, or null when nothing here needs a
   * human. What the group is ranked on, and what "whom to focus on"
   * resolves to: the first card of the first group.
   */
  topNeedsYouScore: number | null;
};

/**
 * May this draft go out in a batch the owner has not read?
 *
 * The narrow bar described in this file's header. Exported because it is
 * the one definition of "safe" in the product: the queue uses it to build
 * the pile, and the send endpoint must re-check it per draft rather than
 * trusting a list of ids posted by a browser.
 */
export function isSafeToSendInBulk(approval: Pick<PendingApproval, "reason" | "draftRiskLevel">): boolean {
  // Held for a reason of its own → needs a human, whatever the verdict.
  if (!isHeldOnlyByApprovalSetting(approval.reason)) return false;
  // Judged, and judged low. `null` is unjudged and fails here, which is
  // the whole point — see the header.
  return approval.draftRiskLevel === "low";
}

/**
 * Group a queue by source, ordered so the first thing on screen is the
 * thing to deal with first.
 *
 * Ordering, in the founder's own terms ("sources then scores"):
 *
 *   - Groups with something that needs a human come before groups that
 *     are entirely routine. A source with 40 safe drafts and nothing to
 *     read is not where anyone should look first, however large it is.
 *   - Among those, the group holding the highest-scoring lead wins. That
 *     lead is the answer to "whom to focus on", so it belongs at the top
 *     of the top group rather than somewhere down a list.
 *   - Ties, and all-routine groups, fall back to the bigger queue first,
 *     then the source name, so the order is stable between renders
 *     rather than reshuffling on every load.
 */
export function groupApprovalsBySource(approvals: PendingApproval[]): ApprovalGroup[] {
  const bySource = new Map<string, PendingApproval[]>();
  for (const a of approvals) {
    const key = a.source ?? UNKNOWN_SOURCE_LABEL;
    const existing = bySource.get(key);
    if (existing) existing.push(a);
    else bySource.set(key, [a]);
  }

  const groups: ApprovalGroup[] = [];
  for (const [source, items] of bySource) {
    const needsYou: PendingApproval[] = [];
    const safeToSend: PendingApproval[] = [];
    for (const a of items) (isSafeToSendInBulk(a) ? safeToSend : needsYou).push(a);

    // Highest score first inside both piles. The safe pile is sorted too
    // even though it is offered as one action: an owner who opens it to
    // spot-check reads the most valuable one first, and a partial send
    // (a daily cap, a closed messaging window) then spends what it has
    // on the leads worth the most rather than on whichever came back
    // from the database first.
    needsYou.sort(byScoreThenRecency);
    safeToSend.sort(byScoreThenRecency);

    groups.push({
      source,
      needsYou,
      safeToSend,
      topNeedsYouScore: needsYou.length > 0 ? needsYou[0].score : null,
    });
  }

  groups.sort((a, b) => {
    const aHas = a.topNeedsYouScore !== null;
    const bHas = b.topNeedsYouScore !== null;
    if (aHas !== bHas) return aHas ? -1 : 1;
    if (aHas && bHas && a.topNeedsYouScore !== b.topNeedsYouScore) {
      return (b.topNeedsYouScore as number) - (a.topNeedsYouScore as number);
    }
    const aSize = a.needsYou.length + a.safeToSend.length;
    const bSize = b.needsYou.length + b.safeToSend.length;
    if (aSize !== bSize) return bSize - aSize;
    return a.source.localeCompare(b.source);
  });

  return groups;
}

/**
 * Newest first among equal scores. Score is the product's own answer to
 * "who matters" and leads with it; recency only decides between leads it
 * rates the same, which on a fresh account is most of them (an unscored
 * lead is 0).
 */
function byScoreThenRecency(a: PendingApproval, b: PendingApproval): number {
  if (a.score !== b.score) return b.score - a.score;
  return b.heldAt.getTime() - a.heldAt.getTime();
}

/** Totals for the one line that sits above the groups. */
export function summariseGroups(groups: ApprovalGroup[]): {
  needsYou: number;
  safeToSend: number;
  /** The single lead to open first, or null when nothing needs a human. */
  focusOn: { leadId: string; leadName: string; source: string; score: number } | null;
} {
  let needsYou = 0;
  let safeToSend = 0;
  for (const g of groups) {
    needsYou += g.needsYou.length;
    safeToSend += g.safeToSend.length;
  }
  // The groups are already ordered so this is the first card of the first
  // group — derived from the order rather than re-scanned, so the
  // sentence above the queue can never name a lead the queue does not
  // show first.
  const lead = groups.find((g) => g.needsYou.length > 0)?.needsYou[0] ?? null;
  return {
    needsYou,
    safeToSend,
    focusOn: lead ? { leadId: lead.leadId, leadName: lead.leadName, source: lead.source ?? UNKNOWN_SOURCE_LABEL, score: lead.score } : null,
  };
}
