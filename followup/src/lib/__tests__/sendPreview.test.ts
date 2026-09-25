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
// getPendingApprovals is mocked for the counting tests; compareApprovals
// is the real export, which is the whole point of the ordering ones.
vi.mock("@/lib/pendingApprovals", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/pendingApprovals")>()),
  getPendingApprovals: pending,
}));

import { compareApprovals } from "@/lib/pendingApprovals";

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
  leadLastMessageAt: null,
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

/**
 * The same predicate, doing a second job: ordering the queue.
 *
 * `getPendingApprovals` sorted by recency alone, and on a holding
 * account that buries the only cards worth reading. Nine say the same
 * generic sentence — "your account holds every automated message for you
 * to approve" — and somewhere among them, in whatever order they
 * happened to be held, is one saying "the draft quotes a price nobody in
 * this conversation mentioned". That one is about to send a made-up
 * number to a customer in the owner's name. The other nine need a
 * glance.
 *
 * An owner scanning twelve near-identical cards cannot tell which is
 * which — the product's own thesis, "which one am I about to lose?",
 * failing on the product's own screen.
 *
 * Asserted on the comparator rather than by mounting the queue: the
 * defect is entirely an ordering one, and the component renders whatever
 * order it is handed.
 */
describe("what order the approval queue puts things in", () => {
  // The SHIPPED comparator, not a copy of it. The first draft here
  // reimplemented the sort inline, which tests the copy: it would keep
  // passing while the real order drifted away from it.
  const order = (rows: { reason: string; heldAt: Date }[]) => rows.slice().sort(compareApprovals);

  const at = (iso: string) => new Date(iso);

  it("puts a draft that needs judgement above newer routine ones", () => {
    // The failure this exists to prevent: the made-up price is the
    // OLDEST card, so recency alone buried it under three others.
    const rows = [
      { reason: HOLD_ALL_AUTOMATION_REASON, heldAt: at("2026-09-22T12:00:00Z") },
      { reason: HOLD_ALL_AUTOMATION_REASON, heldAt: at("2026-09-22T11:00:00Z") },
      { reason: HOLD_ALL_SEQUENCE_REASON, heldAt: at("2026-09-22T10:00:00Z") },
      { reason: UNGROUNDED_DRAFT_REASONS.currency, heldAt: at("2026-09-20T08:00:00Z") },
    ];
    expect(order(rows)[0].reason).toBe(UNGROUNDED_DRAFT_REASONS.currency);
  });

  it("keeps newest-first inside each group", () => {
    const rows = [
      { reason: HOLD_ALL_AUTOMATION_REASON, heldAt: at("2026-09-20T10:00:00Z") },
      { reason: UNGROUNDED_DRAFT_REASONS.digits, heldAt: at("2026-09-21T10:00:00Z") },
      { reason: HOLD_ALL_AUTOMATION_REASON, heldAt: at("2026-09-22T10:00:00Z") },
      { reason: UNTOUCHED_LEAD_REASON, heldAt: at("2026-09-22T09:00:00Z") },
    ];
    expect(order(rows).map((r) => r.heldAt.toISOString())).toEqual([
      "2026-09-22T09:00:00.000Z", // needs you, newest of its group
      "2026-09-21T10:00:00.000Z", // needs you, older
      "2026-09-22T10:00:00.000Z", // routine, newest of its group
      "2026-09-20T10:00:00.000Z", // routine, older
    ]);
  });

  it("leaves an all-routine queue in plain recency order", () => {
    // No boundary to draw, so nothing should move — the reorder must not
    // shuffle a queue it has no opinion about.
    const rows = [
      { reason: HOLD_ALL_AUTOMATION_REASON, heldAt: at("2026-09-22T10:00:00Z") },
      { reason: HOLD_ALL_SEQUENCE_REASON, heldAt: at("2026-09-21T10:00:00Z") },
      { reason: HOLD_ALL_FIRST_REPLY_REASON, heldAt: at("2026-09-20T10:00:00Z") },
    ];
    expect(order(rows).map((r) => r.heldAt.getTime())).toEqual(rows.map((r) => r.heldAt.getTime()));
  });

  it("treats an empty reason as needing a human", () => {
    // pendingApprovals falls back to "" when the audit meta has no
    // reason. Unknown provenance belongs at the top, not buried.
    const rows = [
      { reason: HOLD_ALL_AUTOMATION_REASON, heldAt: at("2026-09-22T12:00:00Z") },
      { reason: "", heldAt: at("2026-09-19T12:00:00Z") },
    ];
    expect(order(rows)[0].reason).toBe("");
  });
});
