/**
 * "Who do I deal with first?" — the shape the approval queue takes when
 * an owner has more drafts than anyone will read.
 *
 * Founder, 2026-09-23: "it should sort according to the sources then
 * scores and let them know what is the priority and whom to focus on
 * rather than reading all 600 drafts… for those who need less attention
 * he should let them know that we can follow up in one click only if they
 * want and they are safe to send."
 *
 * ## The test that matters most is the one about "safe"
 *
 * Everything else here is ordering, and wrong ordering wastes someone's
 * afternoon. `isSafeToSendInBulk` is different: it is the single decision
 * that lets a message reach a customer, in the owner's name, without any
 * human reading it. It has exactly one way to fail badly — saying yes too
 * often — and two independent guards against that, neither of which
 * implies the other.
 *
 * The second guard exists because of a real hole. Until 2026-09-23 the
 * risk classifier was SKIPPED on any account holding messages for
 * approval, on the reasoning that it decides what may send unreviewed and
 * nothing was sending. Every held draft therefore carried a hardcoded
 * "low" that nothing had assessed. Had the one-click pile been built on
 * the hold reason alone, its first act would have been to send every
 * unjudged draft in the account — including the one quoting a price
 * nobody mentioned — because the reason says only "your account holds
 * everything", which is true of all of them.
 *
 * Hence: null is not safe. An unjudged draft is not a safe draft, it is
 * one nobody has looked at.
 */
import { describe, it, expect } from "vitest";
import { groupApprovalsBySource, isSafeToSendInBulk, summariseGroups, UNKNOWN_SOURCE_LABEL } from "@/lib/approvalGroups";
import type { PendingApproval } from "@/lib/pendingApprovals";
import { HOLD_ALL_AUTOMATION_REASON, BACKLOG_BEFORE_PERMISSION_REASON, UNGROUNDED_DRAFT_REASONS, UNTOUCHED_LEAD_REASON } from "@/lib/holdReasons";

let seq = 0;
function approval(over: Partial<PendingApproval> = {}): PendingApproval {
  seq += 1;
  return {
    leadId: `lead${seq}`,
    leadName: `Lead ${seq}`,
    source: "Gmail",
    score: 50,
    draftRiskLevel: "low",
    riskLevel: "low",
    reason: HOLD_ALL_AUTOMATION_REASON,
    trigger: "silence",
    heldAt: new Date("2026-09-23T01:00:00Z"),
    draftSubject: null,
    draftMessage: "…",
    leadLastMessage: null,
    leadLastMessageChannel: null,
    leadLastMessageAt: null,
    ...over,
  };
}

describe("what may be sent without anyone reading it", () => {
  it("says yes only when the setting is the one thing stopping it AND it was judged low", () => {
    expect(isSafeToSendInBulk({ reason: HOLD_ALL_AUTOMATION_REASON, draftRiskLevel: "low" })).toBe(true);
  });

  it("refuses a draft nobody has judged", () => {
    // The hole this guard exists for. Before 2026-09-23 every held draft
    // looked exactly like this: held only by the setting, and never
    // assessed. Treating that as safe would send the whole back
    // catalogue unread.
    expect(isSafeToSendInBulk({ reason: HOLD_ALL_AUTOMATION_REASON, draftRiskLevel: null })).toBe(false);
  });

  it("refuses anything the classifier did not call low", () => {
    for (const level of ["medium", "high", "unknown", ""]) {
      expect(isSafeToSendInBulk({ reason: HOLD_ALL_AUTOMATION_REASON, draftRiskLevel: level }), `"${level}" was treated as safe`).toBe(false);
    }
  });

  it("refuses a draft that is held for a reason of its own, however low the verdict", () => {
    // A low verdict is about the WORDING of the message. It says nothing
    // about whether FollowUp has seen the history (untouched) or whether
    // the draft invented a number (ungrounded) — those hold the draft on
    // their own and a human still has to look.
    for (const reason of [UNTOUCHED_LEAD_REASON, UNGROUNDED_DRAFT_REASONS.currency, UNGROUNDED_DRAFT_REASONS.digits]) {
      expect(isSafeToSendInBulk({ reason, draftRiskLevel: "low" }), `"${reason.slice(0, 40)}…" was treated as safe`).toBe(false);
    }
  });

  it("keeps a backlog draft releasable in one press", () => {
    // Load-bearing, not incidental. A backlog draft is held because the
    // owner had not granted permission when that conversation happened —
    // it has no problem of its own. If it did not count as safe, the
    // entire back catalogue would sit in the queue with no way out but
    // one lead at a time, and the backlog guard would be a trap rather
    // than a courtesy.
    expect(isSafeToSendInBulk({ reason: BACKLOG_BEFORE_PERMISSION_REASON, draftRiskLevel: "low" })).toBe(true);
  });

  it("still refuses a backlog draft the classifier did not clear", () => {
    // Being old does not make it safe. Both guards still apply.
    expect(isSafeToSendInBulk({ reason: BACKLOG_BEFORE_PERMISSION_REASON, draftRiskLevel: null })).toBe(false);
    expect(isSafeToSendInBulk({ reason: BACKLOG_BEFORE_PERMISSION_REASON, draftRiskLevel: "high" })).toBe(false);
  });

  it("refuses a reason it has never seen", () => {
    // A new rule, or a reworded constant. Unknown provenance must land on
    // the cautious side.
    expect(isSafeToSendInBulk({ reason: "some rule nobody has written yet", draftRiskLevel: "low" })).toBe(false);
  });
});

describe("splitting a source's queue into read-these and send-these", () => {
  it("puts each draft in exactly one pile, and loses none", () => {
    const rows = [
      approval({ draftRiskLevel: "low" }),
      approval({ draftRiskLevel: null }),
      approval({ reason: UNGROUNDED_DRAFT_REASONS.currency }),
      approval({ draftRiskLevel: "high" }),
    ];
    const [g] = groupApprovalsBySource(rows);
    expect(g.safeToSend).toHaveLength(1);
    expect(g.needsYou).toHaveLength(3);
    expect(g.needsYou.length + g.safeToSend.length).toBe(rows.length);
  });

  it("orders both piles by score, highest first", () => {
    const [g] = groupApprovalsBySource([
      approval({ leadName: "Low", score: 10 }),
      approval({ leadName: "High", score: 90 }),
      approval({ leadName: "Mid", score: 50 }),
    ]);
    expect(g.safeToSend.map((a) => a.leadName)).toEqual(["High", "Mid", "Low"]);
  });

  it("breaks a score tie on recency, so the order is stable and not arbitrary", () => {
    // Most leads on a fresh account are unscored, so this is the common
    // path rather than an edge case.
    const [g] = groupApprovalsBySource([
      approval({ leadName: "Older", score: 0, heldAt: new Date("2026-09-20T10:00:00Z") }),
      approval({ leadName: "Newer", score: 0, heldAt: new Date("2026-09-22T10:00:00Z") }),
    ]);
    expect(g.safeToSend.map((a) => a.leadName)).toEqual(["Newer", "Older"]);
  });
});

describe("which source an owner should look at first", () => {
  it("puts a source that needs a human above one that is only routine, however big", () => {
    // Forty safe drafts is not where anyone should look first.
    const groups = groupApprovalsBySource([
      ...Array.from({ length: 40 }, () => approval({ source: "WhatsApp", score: 99 })),
      approval({ source: "Instagram", score: 20, draftRiskLevel: null }),
    ]);
    expect(groups[0].source).toBe("Instagram");
  });

  it("ranks by the best lead that needs a human, not by pile size", () => {
    const groups = groupApprovalsBySource([
      approval({ source: "Gmail", score: 30, draftRiskLevel: null }),
      approval({ source: "Gmail", score: 25, draftRiskLevel: null }),
      approval({ source: "WhatsApp", score: 88, draftRiskLevel: null }),
    ]);
    expect(groups[0].source).toBe("WhatsApp");
    expect(groups[0].topNeedsYouScore).toBe(88);
  });

  it("reports no focus score for an all-routine source", () => {
    const [g] = groupApprovalsBySource([approval({ draftRiskLevel: "low" })]);
    expect(g.topNeedsYouScore).toBeNull();
  });

  it("keeps a stable order between renders when groups tie", () => {
    // Two all-routine sources of the same size. Something has to decide,
    // and it must be the same something every load — a queue that
    // reshuffles under the cursor is its own bug.
    const rows = [approval({ source: "WhatsApp" }), approval({ source: "Gmail" })];
    const first = groupApprovalsBySource(rows).map((g) => g.source);
    const second = groupApprovalsBySource([...rows].reverse()).map((g) => g.source);
    expect(first).toEqual(second);
  });

  it("names a lead with no source rather than dropping it", () => {
    // Lead.source is nullable and really is null sometimes — five such
    // leads were found in the founder's own database. Grouping under
    // `undefined` would hide them.
    const groups = groupApprovalsBySource([approval({ source: null })]);
    expect(groups[0].source).toBe(UNKNOWN_SOURCE_LABEL);
  });
});

describe("the line that sits above the queue", () => {
  it("counts both piles across every source", () => {
    const s = summariseGroups(
      groupApprovalsBySource([
        approval({ source: "Gmail" }),
        approval({ source: "Gmail", draftRiskLevel: null }),
        approval({ source: "WhatsApp" }),
      ])
    );
    expect(s).toMatchObject({ needsYou: 1, safeToSend: 2 });
  });

  it("names the single lead to open first", () => {
    const s = summariseGroups(
      groupApprovalsBySource([
        approval({ source: "Gmail", leadName: "Devon", score: 40, draftRiskLevel: null }),
        approval({ source: "WhatsApp", leadName: "Sarah", score: 91, draftRiskLevel: null }),
      ])
    );
    expect(s.focusOn).toMatchObject({ leadName: "Sarah", source: "WhatsApp", score: 91 });
  });

  it("never names a lead the queue does not actually show first", () => {
    // The sentence and the list have to agree. Derived from the ordered
    // groups rather than re-scanned, so they cannot disagree.
    const groups = groupApprovalsBySource([
      approval({ source: "Gmail", leadName: "A", score: 10, draftRiskLevel: null }),
      approval({ source: "WhatsApp", leadName: "B", score: 70, draftRiskLevel: null }),
      approval({ source: "Instagram", leadName: "C", score: 55, draftRiskLevel: null }),
    ]);
    expect(summariseGroups(groups).focusOn?.leadName).toBe(groups[0].needsYou[0].leadName);
  });

  it("says there is nobody to focus on when everything is routine", () => {
    const s = summariseGroups(groupApprovalsBySource([approval(), approval()]));
    expect(s.focusOn).toBeNull();
    expect(s.needsYou).toBe(0);
  });

  it("puts the routine-only group holding the better lead first, not the earlier name", () => {
    // Both groups are all-routine and the same size, so this used to fall
    // through to source.localeCompare — "Added by hand" above "Gmail"
    // regardless of who was in them. Alphabetical order is not an answer
    // to "whom do I focus on".
    const groups = groupApprovalsBySource([
      approval({ leadId: "hand", leadName: "Sam", source: null, score: 40, reason: HOLD_ALL_AUTOMATION_REASON, draftRiskLevel: "low" }),
      approval({ leadId: "mail", leadName: "Dana", source: "Gmail", score: 66, reason: HOLD_ALL_AUTOMATION_REASON, draftRiskLevel: "low" }),
    ]);
    expect(groups.map((g) => g.source)).toEqual(["Gmail", UNKNOWN_SOURCE_LABEL]);
  });

  it("still puts a group that needs you above a higher-scoring routine one", () => {
    // Score only breaks ties. A group with something to decide outranks
    // one with nothing to decide however valuable the routine lead is —
    // otherwise the tie-break quietly becomes the sort.
    const groups = groupApprovalsBySource([
      approval({ leadId: "routine", source: "Gmail", score: 99, reason: HOLD_ALL_AUTOMATION_REASON, draftRiskLevel: "low" }),
      approval({ leadId: "urgent", source: "WhatsApp", score: 12, reason: UNGROUNDED_DRAFT_REASONS.currency }),
    ]);
    expect(groups.map((g) => g.source)).toEqual(["WhatsApp", "Gmail"]);
  });

  it("counts how many predate the permission, for the line above the queue", () => {
    // Said once, not 48 times. Each card carries its own sentence
    // already; an owner who reads the first two identical ones concludes
    // the product is repeating itself rather than that 48 are old.
    const s = summariseGroups(
      groupApprovalsBySource([
        approval({ reason: BACKLOG_BEFORE_PERMISSION_REASON }),
        approval({ reason: BACKLOG_BEFORE_PERMISSION_REASON }),
        approval({ reason: HOLD_ALL_AUTOMATION_REASON }),
        approval({ reason: UNGROUNDED_DRAFT_REASONS.currency }),
      ])
    );
    expect(s.fromBeforePermission).toBe(2);
  });

  it("counts backlog in both piles, not just the routine one", () => {
    // A backlog draft the classifier flagged sits in "needs you" and is
    // still backlog. Counting only the safe pile would undercount the
    // thing the line exists to explain.
    const s = summariseGroups(
      groupApprovalsBySource([
        approval({ reason: BACKLOG_BEFORE_PERMISSION_REASON, draftRiskLevel: "low" }),
        approval({ reason: BACKLOG_BEFORE_PERMISSION_REASON, draftRiskLevel: "high" }),
      ])
    );
    expect(s.safeToSend).toBe(1);
    expect(s.needsYou).toBe(1);
    expect(s.fromBeforePermission).toBe(2);
  });

  it("reports no backlog when there is none, so the line stays hidden", () => {
    const s = summariseGroups(groupApprovalsBySource([approval(), approval()]));
    expect(s.fromBeforePermission).toBe(0);
  });

  it("reports an empty queue as empty rather than throwing", () => {
    expect(summariseGroups(groupApprovalsBySource([]))).toEqual({ needsYou: 0, safeToSend: 0, fromBeforePermission: 0, focusOn: null });
  });
});
