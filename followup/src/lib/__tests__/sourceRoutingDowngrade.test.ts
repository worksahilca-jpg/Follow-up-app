/**
 * The downgrade nobody was told about.
 *
 * A SourceRule can say "every new Instagram lead starts on Autonomous".
 * If the account has not permitted unreviewed sending,
 * `applySourceRouting` starts the lead on ASSISTED instead — which is
 * correct, and was completely silent. The rule row in Settings went on
 * reading "Autonomous" indefinitely, every lead it made ran on Assisted,
 * and nothing in the product knew both facts.
 *
 * Three sibling paths can put a lead on Auto. Two refused without the
 * permission, loudly, with a 403. This one accepted and then disagreed
 * with itself, which is worse than either refusing or obeying: the owner
 * picked a mode, was told nothing, and got a different one.
 *
 * `POST /api/source-rules` now refuses to save such a rule, so the
 * ordinary way in is closed. These tests pin the way in that remains and
 * always will — a rule saved legitimately while the permission was on,
 * and the permission later revoked — because that is the case the
 * downgrade exists for and the case where the trail has to be there.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { ruleFindUnique, leadUpdate, businessFindUnique, recordAudit, enrollLead } = vi.hoisted(() => ({
  ruleFindUnique: vi.fn(),
  leadUpdate: vi.fn(),
  businessFindUnique: vi.fn(),
  recordAudit: vi.fn(),
  enrollLead: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    sourceRule: { findUnique: ruleFindUnique },
    lead: { update: leadUpdate },
    business: { findUnique: businessFindUnique },
  },
}));
vi.mock("@/lib/audit", () => ({ recordAudit }));
vi.mock("@/lib/sequences", () => ({ enrollLead }));

import { applySourceRouting } from "@/lib/sourceRouting";

const rule = (over: Record<string, unknown> = {}) => ({
  routeToPool: false,
  sequenceId: null,
  automationTierDefault: null,
  ...over,
});

/** What tier the lead was actually written with. */
const tierWritten = () => leadUpdate.mock.calls[0]?.[0]?.data?.automationTier;

beforeEach(() => vi.clearAllMocks());

describe("a rule asking for Auto on an account that has not permitted it", () => {
  beforeEach(() => {
    ruleFindUnique.mockResolvedValue(rule({ automationTierDefault: "AUTONOMOUS" }));
    businessFindUnique.mockResolvedValue({ autonomousAllowed: false });
  });

  it("starts the lead on Assisted, not Autonomous", async () => {
    // The behaviour itself is right and stays. A revoked permission must
    // not leave new leads stranded on a mode the owner has taken back.
    await applySourceRouting("biz1", "lead1", "Instagram");
    expect(tierWritten()).toBe("ASSISTED");
  });

  it("records that it happened, with what was asked for and what was done", async () => {
    // The actual defect. Before this the downgrade left no trace
    // anywhere, so "why is this lead waiting for me when the rule says
    // Auto" had no answer in the product at all — not in the audit
    // trail, not on the lead, not on the rule.
    await applySourceRouting("biz1", "lead1", "Instagram");
    expect(recordAudit).toHaveBeenCalledTimes(1);
    const [ctx, action, details] = recordAudit.mock.calls[0];
    expect(ctx).toEqual({ businessId: "biz1" });
    expect(action).toBe("automation.downgraded");
    expect(details.targetId).toBe("lead1");
    // Both halves, or the entry cannot be read back months later: what
    // the rule wanted, and what the lead actually got.
    expect(details.meta).toMatchObject({ source: "Instagram", requested: "AUTONOMOUS", applied: "ASSISTED" });
    expect(String(details.meta.reason)).toMatch(/permitted/i);
  });

  it("writes the lead before it writes the audit line", async () => {
    // Order matters for a reason that is easy to lose: the audit entry
    // asserts something about the lead. If the update throws, no line
    // should exist claiming a downgrade that never landed.
    await applySourceRouting("biz1", "lead1", "Instagram");
    expect(leadUpdate.mock.invocationCallOrder[0]).toBeLessThan(recordAudit.mock.invocationCallOrder[0]);
  });
});

describe("what must NOT be recorded", () => {
  it("says nothing when the account has permitted Auto", async () => {
    // No downgrade happened, so there is nothing to explain. An event
    // here would put a "downgraded" line on a lead that got exactly what
    // the rule asked for.
    ruleFindUnique.mockResolvedValue(rule({ automationTierDefault: "AUTONOMOUS" }));
    businessFindUnique.mockResolvedValue({ autonomousAllowed: true });
    await applySourceRouting("biz1", "lead1", "Instagram");
    expect(tierWritten()).toBe("AUTONOMOUS");
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("says nothing for a rule that never asked for Auto", async () => {
    // The overwhelming majority — all eighteen rules in production today
    // are ASSISTED. A downgrade event on any of them would be a lie
    // about a rule that got precisely what it asked for.
    ruleFindUnique.mockResolvedValue(rule({ automationTierDefault: "ASSISTED" }));
    businessFindUnique.mockResolvedValue({ autonomousAllowed: false });
    await applySourceRouting("biz1", "lead1", "Gmail");
    expect(tierWritten()).toBe("ASSISTED");
    expect(recordAudit).not.toHaveBeenCalled();
    // And it must not even ask about the permission — an ASSISTED rule
    // has nothing to be permitted.
    expect(businessFindUnique).not.toHaveBeenCalled();
  });

  it("says nothing for an OFF rule", async () => {
    ruleFindUnique.mockResolvedValue(rule({ automationTierDefault: "OFF" }));
    businessFindUnique.mockResolvedValue({ autonomousAllowed: false });
    await applySourceRouting("biz1", "lead1", "Gmail");
    expect(tierWritten()).toBe("OFF");
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("leaves the pool and workflow branches completely alone", async () => {
    // Both return before the tier branch. An audit event reaching them
    // would attach a downgrade explanation to leads whose rule never
    // mentioned a tier.
    ruleFindUnique.mockResolvedValue(rule({ routeToPool: true }));
    await applySourceRouting("biz1", "lead1", "Gmail");
    expect(recordAudit).not.toHaveBeenCalled();

    vi.clearAllMocks();
    ruleFindUnique.mockResolvedValue(rule({ sequenceId: "seq1" }));
    await applySourceRouting("biz1", "lead2", "Gmail");
    expect(enrollLead).toHaveBeenCalledWith("lead2", "biz1", "seq1");
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("does nothing at all when there is no rule, or no source", async () => {
    ruleFindUnique.mockResolvedValue(null);
    await applySourceRouting("biz1", "lead1", "Gmail");
    await applySourceRouting("biz1", "lead1", null);
    expect(leadUpdate).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });
});

/**
 * The approval queue is derived from audit events, and this file now
 * writes one.
 *
 * `getPendingApprovals` treats a lead as pending when its MOST RECENT
 * AuditEvent is `ai.hold`. So an event written at the wrong moment on a
 * held lead would drop it out of the queue silently — a whole business's
 * approvals gone, with nothing thrown and nothing logged. That failure
 * shape has bitten this codebase before.
 *
 * It is safe because `applySourceRouting` runs exactly once, immediately
 * after a lead is created, which is strictly before anything can have
 * drafted or held a reply for it. That ordering is an assumption about
 * the CALLERS, not something this function can enforce, so it is written
 * down here where a future change to it would be read.
 */
describe("the assumption this safety rests on", () => {
  it("only ever writes an event for a lead it is also creating the tier for", async () => {
    ruleFindUnique.mockResolvedValue(rule({ automationTierDefault: "AUTONOMOUS" }));
    businessFindUnique.mockResolvedValue({ autonomousAllowed: false });
    await applySourceRouting("biz1", "lead1", "Instagram");
    // One event, for one lead, in one call. Not a sweep over existing
    // leads — if this ever grew into one it would be writing events onto
    // leads that may already be held, and the queue would empty.
    expect(recordAudit).toHaveBeenCalledTimes(1);
    expect(recordAudit.mock.calls[0][2].targetId).toBe("lead1");
    expect(leadUpdate).toHaveBeenCalledTimes(1);
  });
});
