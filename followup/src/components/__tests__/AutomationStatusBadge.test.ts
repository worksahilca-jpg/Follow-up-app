/**
 * The sentence on the lead's own page that answers "what is FollowUp
 * doing about this, and is anything waiting on me".
 *
 * ## Why this file exists
 *
 * AutomationStatusBadge was built for task #63, after a real test lead
 * qualified for an automated reply for hours with nothing visibly
 * happening and the reason only findable by querying the database. Its
 * whole purpose is that an owner never has to ask "why hasn't this sent".
 *
 * On 2026-09-21 `Business.holdAllForApproval` became `@default(true)`,
 * and this badge never learned about it. From that day, on every account,
 * a lead about to have its reply WRITTEN AND HELD showed:
 *
 *     "Following up soon — Next automation check will pick this up"
 *
 * The badge built to prevent an unexplained non-send became the thing
 * asserting the send. It is also the most-seen claim in the app: the
 * compact form is in every lead list row, the full form at the top of
 * every lead detail page.
 *
 * ## The distinction these tests protect
 *
 * holdAllForApproval is not a second `masterEnabled`. With the master
 * off, nothing happens at all. With hold on, EVERYTHING happens except
 * the send: the lead is picked up, a reply is written, and it waits in
 * approvals. So both easy answers are wrong —
 *
 *   - "Following up soon" claims a send that isn't coming;
 *   - "Paused" claims nothing is coming, and sends an owner off to fix
 *     a setting that isn't broken.
 *
 * The badge has to say the true third thing: a draft is coming, and it
 * needs you. Each test below pins one half of that.
 *
 * Asserted against the SHIPPED describeAutomationStatus, not a copy of
 * its strings — the defect was in the prose, so a test that restated the
 * prose would have passed throughout.
 */
import { describe, it, expect } from "vitest";
import { describeAutomationStatus } from "@/components/AutomationStatusBadge";

const held = { heldForApproval: true } as const;
const sends = { heldForApproval: false } as const;

describe("a lead that is due right now", () => {
  it("never claims a follow-up is going out while the account holds everything", () => {
    const { label, detail } = describeAutomationStatus({ kind: "due_soon", reason: "silence", ...held });
    // The exact shipped sentence, which said the opposite of what happens.
    expect(label).not.toBe("Following up soon");
    for (const text of [label, detail ?? ""]) {
      expect(text, `"${text}" promises a send on a holding account`).not.toMatch(/following up|will pick this up/i);
    }
  });

  it("says a draft is coming and that it waits for the owner", () => {
    const { label, detail } = describeAutomationStatus({ kind: "due_soon", reason: "unanswered", ...held });
    // Both halves matter. "A draft is coming" alone reads as busywork;
    // "it waits for you" alone doesn't say anything is happening.
    expect(`${label} ${detail}`).toMatch(/draft|writing/i);
    expect(detail, "the owner is not told the draft needs them").toMatch(/approv/i);
  });

  it("still describes the lead as due, not as stopped", () => {
    // The overcorrection. A held lead is NOT paused: a reply really is
    // being written for it. Saying "paused" would send an owner to
    // Settings to turn on something that is already on.
    const { label, detail } = describeAutomationStatus({ kind: "due_soon", reason: "dead_lead", ...held });
    for (const text of [label, detail ?? ""]) {
      expect(text, `"${text}" tells the owner nothing is happening`).not.toMatch(/paused|switched off|nothing/i);
    }
  });

  it("keeps the plain sending sentence once the owner has allowed sending", () => {
    // The other direction: an account that granted permission must not be
    // told its messages are waiting for an approval it already gave.
    const { label, detail } = describeAutomationStatus({ kind: "due_soon", reason: "silence", ...sends });
    expect(label).toBe("Following up soon");
    expect(detail ?? "", "an allowed account is told its send needs approval").not.toMatch(/approv/i);
  });

  it("names why, either way — the question the badge exists to answer", () => {
    for (const hold of [held, sends]) {
      const { detail } = describeAutomationStatus({ kind: "due_soon", reason: "unanswered", ...hold });
      expect(detail, "the reason disappeared").toMatch(/they wrote and haven't heard back/);
    }
  });
});

describe("a lead that is not due yet", () => {
  it("counts down to a draft, not to a send, on a holding account", () => {
    // "Next check in ~3h" is literally true either way — a check really
    // does run — but an owner reads it as "sending in 3h", which is the
    // inference the whole badge exists to prevent.
    const { label } = describeAutomationStatus({ kind: "waiting", etaHours: 3, ...held });
    expect(label).toMatch(/draft/i);
    expect(label).toMatch(/3h/);
  });

  it("says 'not due yet' with no ETA either way, without inventing a number", () => {
    for (const hold of [held, sends]) {
      expect(describeAutomationStatus({ kind: "waiting", etaHours: null, ...hold }).label).toBe("Not due yet");
    }
  });
});

describe("a lead the account's master switch is stopping", () => {
  it("does not promise that flipping the master switch sends anything", () => {
    // A half-instruction: with hold also on, turning on "Auto follow-up
    // on silence" gets a draft written, not a message sent. An owner who
    // followed the old sentence and watched for a reply to reach their
    // customer was told the wrong thing by the badge meant to stop that.
    const { detail } = describeAutomationStatus({ kind: "account_paused", reason: "silence", ...held });
    expect(detail).toMatch(/drafted for your approval/i);
    expect(detail, "still names the setting to change").toMatch(/Auto follow-up on silence/);
  });

  it("promises a real follow-up when sending is allowed and only the master switch is off", () => {
    const { detail } = describeAutomationStatus({ kind: "account_paused", reason: "silence", ...sends });
    expect(detail).toMatch(/would be followed up now/i);
    expect(detail).not.toMatch(/approval/i);
  });
});

describe("states the approval setting has no bearing on", () => {
  it("leaves a lead with nothing connected to send through alone", () => {
    // Ranked above the timing states on purpose: with no channel, no
    // draft is written either. Mentioning approvals here would bury the
    // one thing the owner has to fix.
    const { label, detail } = describeAutomationStatus({ kind: "no_send_channel" });
    expect(label).toBe("Nothing is connected to send with");
    expect(detail ?? "").not.toMatch(/approv/i);
  });

  it("leaves an opted-out lead alone", () => {
    // automationTier "off" means nobody but a human will ever message
    // this lead — true whatever the account-wide setting says.
    expect(describeAutomationStatus({ kind: "off" }).label).toBe("Automation off");
  });

  it("leaves a lead awaiting their reply alone", () => {
    expect(describeAutomationStatus({ kind: "sent" }).label).toBe("Waiting on their reply");
  });
});
