/**
 * "What happens if I turn sending on?"
 *
 * The permission switch shipped on 2026-09-22 with no way to see what it
 * would do. An owner granted it and found out from their customers. This
 * answers the question from the queue they already have.
 *
 * ## The claim this must never make
 *
 * The obvious framing — "these would have been sent" — is a lie, and the
 * tests below exist mostly to stop it creeping back in.
 *
 * Both schedulers SKIP the risk classifier while the hold is on
 * (automation.ts and sequences.ts, the `if (holdAll)` branches: "it has
 * nothing to decide, so its cost is not worth paying"). Nothing has ever
 * judged whether these drafts are safe to send. The answer does not
 * exist.
 *
 * What does exist is the hold reason, built by automation.ts as an
 * ordered cascade — real risk finding, then backfilled, then untouched,
 * and only then the approval setting. So a HOLD_ALL_* reason means every
 * other check passed and the setting alone stopped it; anything else
 * means the draft has its own problem and waits either way. That split is
 * knowable, useful, and all this promises.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  HOLD_ALL_AUTOMATION_REASON,
  HOLD_ALL_SEQUENCE_REASON,
  HOLD_ALL_FIRST_REPLY_REASON,
  UNTOUCHED_LEAD_REASON,
  RISK_CHECK_FAILED_REASON,
  UNGROUNDED_DRAFT_REASONS,
} from "@/lib/holdReasons";

const { pending } = vi.hoisted(() => ({ pending: vi.fn() }));
vi.mock("@/lib/pendingApprovals", () => ({ getPendingApprovals: pending }));

import { getSendPreview, isHeldOnlyByApprovalSetting } from "@/lib/sendPreview";

type Row = { reason: string; leadName?: string; heldAt?: Date };
const approval = ({ reason, leadName = "Someone", heldAt = new Date("2026-09-22T06:00:00Z") }: Row) => ({
  leadId: `lead_${leadName}_${reason.slice(0, 6)}`,
  leadName,
  riskLevel: "low",
  reason,
  trigger: "silence",
  heldAt,
  draftSubject: null,
  draftMessage: "…",
  leadLastMessage: null,
  leadLastMessageChannel: null,
});

beforeEach(() => vi.clearAllMocks());

describe("which holds the approval setting is responsible for", () => {
  /**
   * Every hold-all constant, pinned individually. These are three
   * different strings for three different paths (the hourly check, a
   * workflow step, and a first reply to someone who just wrote in), and
   * missing one would silently undercount an owner's exposure.
   */
  it("recognises all three hold-all reasons", () => {
    for (const reason of [HOLD_ALL_AUTOMATION_REASON, HOLD_ALL_SEQUENCE_REASON, HOLD_ALL_FIRST_REPLY_REASON]) {
      expect(isHeldOnlyByApprovalSetting(reason), `${reason.slice(0, 40)}… is no longer counted`).toBe(true);
    }
  });

  /**
   * The other direction, and the one that matters more: a draft with a
   * problem of its own must never be counted as "only the setting". These
   * are the reasons that outrank the setting in automation.ts's cascade.
   */
  it("does not count a hold the draft earned on its own", () => {
    const earned = [
      UNTOUCHED_LEAD_REASON,
      RISK_CHECK_FAILED_REASON,
      UNGROUNDED_DRAFT_REASONS.currency,
      UNGROUNDED_DRAFT_REASONS.digits,
      "this conversation was already in your inbox before FollowUp started watching it, so it hasn't seen what you may have already done about it",
      "Sarah went quiet 5 days ago — reaching back out is your call",
    ];
    for (const reason of earned) {
      expect(isHeldOnlyByApprovalSetting(reason), `"${reason.slice(0, 40)}…" was counted as setting-only`).toBe(false);
    }
  });

  it("matches exactly, so a reworded constant fails loudly", () => {
    // These strings are customer-facing prose and have been reworded
    // before (all three, 2026-09-20, over a grammar bug). A substring or
    // keyword match would keep passing while counting the wrong leads.
    expect(isHeldOnlyByApprovalSetting(`${HOLD_ALL_AUTOMATION_REASON} and then some`)).toBe(false);
    expect(isHeldOnlyByApprovalSetting(HOLD_ALL_AUTOMATION_REASON.slice(0, -5))).toBe(false);
    expect(isHeldOnlyByApprovalSetting("your account holds")).toBe(false);
  });
});

describe("the summary an owner sees before deciding", () => {
  it("splits the queue and the two halves add up", async () => {
    pending.mockResolvedValue([
      approval({ reason: HOLD_ALL_AUTOMATION_REASON, leadName: "Sarah" }),
      approval({ reason: HOLD_ALL_SEQUENCE_REASON, leadName: "Mike" }),
      approval({ reason: HOLD_ALL_FIRST_REPLY_REASON, leadName: "Priya" }),
      approval({ reason: UNGROUNDED_DRAFT_REASONS.currency, leadName: "Devon" }),
      approval({ reason: UNTOUCHED_LEAD_REASON, leadName: "Alex" }),
    ]);

    const p = await getSendPreview("biz_1");
    expect(p.total).toBe(5);
    expect(p.heldOnlyBySetting).toBe(3);
    expect(p.wouldWaitAnyway).toBe(2);
    // Derived by subtraction on purpose — the halves cannot disagree
    // about a reason neither predicate recognised.
    expect(p.heldOnlyBySetting + p.wouldWaitAnyway).toBe(p.total);
  });

  it("counts an unrecognised reason as needing a human", async () => {
    // A reason this file has never seen — a new rule, or a reworded
    // constant — must fall on the cautious side: "you'd see it anyway",
    // never "the setting is all that's stopping it".
    pending.mockResolvedValue([approval({ reason: "some rule nobody has written yet" })]);
    const p = await getSendPreview("biz_1");
    expect(p.heldOnlyBySetting).toBe(0);
    expect(p.wouldWaitAnyway).toBe(1);
  });

  it("names the most recently held few, newest first", async () => {
    pending.mockResolvedValue([
      approval({ reason: HOLD_ALL_AUTOMATION_REASON, leadName: "Oldest", heldAt: new Date("2026-09-20T10:00:00Z") }),
      approval({ reason: HOLD_ALL_AUTOMATION_REASON, leadName: "Newest", heldAt: new Date("2026-09-22T10:00:00Z") }),
      approval({ reason: HOLD_ALL_AUTOMATION_REASON, leadName: "Middle", heldAt: new Date("2026-09-21T10:00:00Z") }),
      approval({ reason: HOLD_ALL_AUTOMATION_REASON, leadName: "Fourth", heldAt: new Date("2026-09-19T10:00:00Z") }),
    ]);
    const p = await getSendPreview("biz_1");
    expect(p.examples.map((e) => e.leadName)).toEqual(["Newest", "Middle", "Oldest"]);
  });

  it("never offers an example of something that waits anyway", async () => {
    // The examples sit under a sentence about what the setting is
    // holding. Naming a lead that needs a human regardless would say the
    // opposite of the sentence above it.
    pending.mockResolvedValue([
      approval({ reason: UNGROUNDED_DRAFT_REASONS.currency, leadName: "Devon" }),
      approval({ reason: HOLD_ALL_AUTOMATION_REASON, leadName: "Sarah" }),
    ]);
    const p = await getSendPreview("biz_1");
    expect(p.examples.map((e) => e.leadName)).toEqual(["Sarah"]);
  });

  it("reports an empty queue as empty rather than throwing", async () => {
    pending.mockResolvedValue([]);
    const p = await getSendPreview("biz_1");
    expect(p).toMatchObject({ total: 0, heldOnlyBySetting: 0, wouldWaitAnyway: 0, examples: [] });
  });
});
