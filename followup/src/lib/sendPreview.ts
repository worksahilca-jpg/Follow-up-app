/**
 * "What happens if I turn sending on?" — answered from the queue the
 * owner already has, before they decide.
 *
 * The permission switch (Settings → Automation, added 2026-09-22) lets a
 * business let FollowUp send without asking. Granting it is a decision
 * about strangers receiving machine-written messages signed as that
 * business, and until now it was made completely blind: the panel
 * described the rules in the abstract and the owner found out what that
 * meant in practice afterwards, from their customers.
 *
 * ## What this can honestly say, and what it cannot
 *
 * It is tempting to label the queue "these would have been sent". That
 * would be a lie, and the reason is worth writing down because it is not
 * obvious from the outside.
 *
 * Both schedulers SKIP the risk classifier while the hold is on
 * (`automation.ts` and `sequences.ts`, the `if (holdAll)` branches: "on
 * an account where nothing sends without review, it has nothing to
 * decide, so its cost is not worth paying"). So for every lead currently
 * waiting, FollowUp has never assessed whether that draft was safe to
 * send. The answer does not exist to report.
 *
 * What DOES exist is the hold reason, and it is precise. `automation.ts`
 * builds it as an ordered cascade — a real risk finding first, then
 * backfilled, then untouched, and only then the approval setting — so a
 * reason of HOLD_ALL_* means every other check passed and the setting is
 * the ONLY thing that stopped it. Any other reason means the draft has a
 * problem of its own and would have waited either way.
 *
 * That is the split below, and it is the useful one: it tells an owner
 * how much of their queue is their own choice and how much is FollowUp
 * genuinely needing them. It does not promise what the risk gate will
 * decide, because nothing knows that yet.
 */
import { getPendingApprovals, type PendingApproval } from "@/lib/pendingApprovals";
import {
  HOLD_ALL_AUTOMATION_REASON,
  HOLD_ALL_SEQUENCE_REASON,
  HOLD_ALL_FIRST_REPLY_REASON,
} from "@/lib/holdReasons";

/**
 * The three reasons that mean "nothing was wrong with this one — your
 * approval setting is what stopped it".
 *
 * Matched exactly rather than by a substring or a keyword. These strings
 * are customer-facing prose that gets reworded (all three were rewritten
 * on 2026-09-20 over a grammar bug), and a fuzzy match would quietly
 * start counting the wrong leads after an edit nobody connected to this
 * file. An exact match fails loudly instead — see the test that pins
 * every constant.
 */
const HELD_ONLY_BY_SETTING: ReadonlySet<string> = new Set([
  HOLD_ALL_AUTOMATION_REASON,
  HOLD_ALL_SEQUENCE_REASON,
  HOLD_ALL_FIRST_REPLY_REASON,
]);

export function isHeldOnlyByApprovalSetting(reason: string): boolean {
  return HELD_ONLY_BY_SETTING.has(reason);
}

export type SendPreview = {
  /** Everything currently waiting. */
  total: number;
  /**
   * Held for no reason but the approval setting. Turning sending on
   * puts these in front of the risk gate for the first time — some will
   * go, some will come back held.
   */
  heldOnlyBySetting: number;
  /**
   * Held because of the draft or the lead itself. Unchanged by the
   * setting: these wait for a human either way.
   */
  wouldWaitAnyway: number;
  /**
   * A few names, most recently held first, so the number is not an
   * abstraction. Deliberately small — this is a sentence in a
   * confirmation box, not a list view; the queue itself is where you
   * read them all.
   */
  examples: { leadName: string; heldAt: Date }[];
};

const EXAMPLE_LIMIT = 3;

export async function getSendPreview(businessId: string): Promise<SendPreview> {
  const approvals: PendingApproval[] = await getPendingApprovals(businessId);

  const bySetting = approvals.filter((a) => isHeldOnlyByApprovalSetting(a.reason));

  return {
    total: approvals.length,
    heldOnlyBySetting: bySetting.length,
    // Derived by subtraction rather than a second filter, so the two can
    // never disagree about a reason neither predicate recognised.
    wouldWaitAnyway: approvals.length - bySetting.length,
    examples: bySetting
      .slice()
      .sort((a, b) => b.heldAt.getTime() - a.heldAt.getTime())
      .slice(0, EXAMPLE_LIMIT)
      .map(({ leadName, heldAt }) => ({ leadName, heldAt })),
  };
}
