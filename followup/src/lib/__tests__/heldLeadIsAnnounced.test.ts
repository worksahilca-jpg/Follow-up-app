/**
 * A held lead that nobody is told about is a lead going cold.
 *
 * Found by auditing production on 2026-09-21, not by reading code:
 * twenty-three leads sat in the approval queue, the oldest waiting **175
 * hours** — seven days. Nine more past 55 hours. Nothing was broken. The
 * hold was doing exactly what it was built to do, and the queue was
 * simply invisible: it renders on the dashboard for whoever opens it, and
 * the weekly digest reports what FollowUp DID ("2 came back, 3 answered
 * for you") and never what is waiting.
 *
 * acknowledge.ts's own header already named this failure from the other
 * side: *"Five days of a stranger waiting is the exact failure this
 * product exists to stop, arrived at by way of the safeguard meant to
 * prevent a worse one."* Holding the message was right. Holding it in
 * silence was not.
 *
 * It matters more from today. Holding is now the default for every
 * account (Business.holdAllForApproval, 2026-09-21), so ten arriving
 * testers would each have had every message held with nobody told — they
 * would open FollowUp, see nothing happen, and conclude it does not work.
 *
 * Two paths put a lead in that queue and both were silent:
 *
 *   1. acknowledgeNewLead — the first reply to a brand-new lead.
 *   2. runAutomationForBusiness — every later follow-up. It notified only
 *      for a NEGLECTED lead; the silence nudge, the dead-lead
 *      reactivation and the hold-everything rule all went unannounced.
 *
 * These are source assertions rather than behavioural ones, and that is a
 * deliberate trade. Driving either path to a hold takes a mocked Prisma,
 * OpenAI and four capture channels — the existing suites that do it
 * (acknowledge.test.ts, automation.test.ts) each run hundreds of lines of
 * setup to reach one branch. What is worth pinning here is narrow: that
 * the branch which holds also tells somebody. A future edit that removes
 * the call fails this.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const read = (f: string) => readFileSync(join(__dirname, "..", f), "utf8");

describe("the first reply, when it is held instead of sent", () => {
  const source = read("acknowledge.ts");

  it("tells someone, in the same branch that holds it", () => {
    const branch = source.slice(source.indexOf("if (ackBusiness?.holdAllForApproval)"));
    const body = branch.slice(0, branch.indexOf('return { sent: false, reason: "held for approval" };'));
    // `notifyAckHeld(` with the paren, not the bare name: the comment
    // above the call names it too, so matching the name alone passed
    // even with the call deleted. Caught by removing it and seeing this
    // test stay green, which is the entire reason to try removing it.
    expect(body, "the hold-all branch no longer notifies anyone — see notifyAckHeld").toMatch(
      /await notifyAckHeld\(/
    );
  });

  it("still records the audit event the queue is derived from", () => {
    // Belt and braces. getPendingApprovals reads leads whose most recent
    // AuditEvent is "ai.hold"; the notification is how a human hears
    // about it. Losing either leaves the lead waiting — one invisibly,
    // one unmentioned.
    const branch = source.slice(source.indexOf("if (ackBusiness?.holdAllForApproval)"));
    expect(branch.slice(0, 600)).toContain('"ai.hold"');
  });

  it("does not put the whole draft in the notification", () => {
    // The owner is about to read it in full in Approvals. A notification
    // carrying the entire message invites approving without opening it,
    // which defeats the point of holding.
    const fn = source.slice(source.indexOf("async function notifyAckHeld"));
    expect(fn.slice(0, fn.indexOf("\n}"))).not.toContain("quote");
  });
});

describe("a later follow-up, when it is held instead of sent", () => {
  const source = read("automation.ts");
  const holdBranch = () => {
    const at = source.indexOf('if (unansweredIds.has(lead.id)) {');
    expect(at, "the held-draft notification branch is gone from automation.ts").toBeGreaterThan(-1);
    return source.slice(at, at + 900);
  };

  it("tells someone even when the lead was not neglected", () => {
    // The regression this fixes: `if (unansweredIds.has(lead.id))` with no
    // else, so only a neglected lead was ever announced.
    //
    // The call moved on 2026-09-21 from an immediate notifyLeadOwners() to
    // a push onto the run's collector, flushed once the run knows how many
    // leads were held (src/lib/holdNotices.ts) — a fresh Gmail connect
    // holds up to a hundred at once, and a hundred rows in the bell is its
    // own failure. The GUARANTEE is unchanged: this branch still tells
    // somebody. Only the mechanism moved, so the assertion follows it.
    expect(holdBranch(), "a held draft on a non-neglected lead notifies nobody again").toMatch(
      /heldNotices\.push\(/
    );
  });

  it("actually flushes what it collected", () => {
    // Collecting without flushing would satisfy the assertion above and
    // notify nobody at all — a worse silence than the one this file was
    // written for, because it would look handled.
    expect(source, "held notices are gathered but never written").toMatch(/await flushHoldNotices\(heldNotices\)/);
  });

  it("keeps the neglect wording for the neglect case", () => {
    // notifyNeglect says something the general sentence cannot: that the
    // lead wrote and was left waiting, and for how long.
    expect(holdBranch()).toMatch(/await notifyNeglect\(/);
  });
});

/**
 * The same burst, in the two places it was left.
 *
 * `holdAllForApproval` became the default for every account on
 * 2026-09-21 (#299). That changed the volume of two loops nobody
 * revisited:
 *
 *   1. runSequencesForBusiness — EVERY workflow step is now held, so a
 *      business with forty enrolled leads got forty notifications on one
 *      tick. The hold itself is fine: the lead is unenrolled and handed
 *      to the owner, so it does not re-nag hourly. The announcing was the
 *      problem.
 *   2. draftDmHandoffs — an unbounded query over every Instagram and
 *      Messenger lead whose 24-hour window shut unanswered. Each of those
 *      notifications carries a deadline, which is exactly the kind that
 *      stops being read when it arrives twelve times.
 *
 * Neither query has a `take`. Both were fixed the same way as
 * automation.ts's held-draft branch, and this pins all three to the one
 * batching path so the next person to add a notify loop finds a pattern
 * rather than a fourth copy.
 */
describe("a workflow step held for approval", () => {
  const source = read("sequences.ts");

  it("is collected for the batch, not written one row at a time", () => {
    const branch = source.slice(source.indexOf('if (holdAll || risk.riskLevel !== "low")'));
    expect(branch.slice(0, 1800), "workflow holds notify one row per lead again").toMatch(/heldNotices\.push\(/);
  });

  it("flushes what it collected", () => {
    expect(source, "workflow hold notices are gathered but never written").toMatch(
      /await flushHoldNotices\(heldNotices\)/
    );
  });

  it("keeps the genuine faults individual", () => {
    // "No reachable channel" and "the send failed" are faults, not a
    // queue: rare, and a count would strip the only thing that makes them
    // actionable — which lead, and what went wrong.
    expect(source).toMatch(/await notifySequenceIssue\(/);
  });
});

describe("a day-2-7 DM handoff", () => {
  const source = read("automation.ts");

  it("is collected for the batch too", () => {
    const fn = source.slice(source.indexOf("export async function draftDmHandoffs"));
    expect(fn, "DM handoffs notify one row per lead again").toMatch(/handoffNotices\.push\(/);
    expect(fn).toMatch(/await flushHoldNotices\(handoffNotices\)/);
  });

  it("has no un-batched notify helper left to reach for", () => {
    // notifyLeadOwners was deleted rather than left unused: a second,
    // un-batched way to write the same notification is how this burst got
    // into two places to begin with.
    expect(source, "an un-batched per-lead notify helper is back").not.toMatch(
      /^async function notifyLeadOwners\(/m
    );
  });
});
