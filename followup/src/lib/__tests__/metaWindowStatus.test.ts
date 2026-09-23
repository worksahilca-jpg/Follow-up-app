/**
 * The badge must not promise a follow-up Meta will refuse to carry.
 *
 * ## The lead this was found on
 *
 * 2026-09-23, the founder's own account, an Instagram lead who last
 * wrote 64.5 hours earlier. The lead page said:
 *
 *   "Writing a reply for you to approve — Next automation check drafts
 *    this. They wrote and haven't heard back. It waits in your approvals
 *    until you send it."
 *
 * Every clause false. Past 24 hours Meta refuses an automated send
 * outright; the manual one needs an app permission this app does not
 * have yet. The draft was real and had nowhere to go. The founder found
 * out by pressing Send and reading a Facebook developer-docs link.
 *
 * This is the same defect as "Following up soon" on a held account,
 * fixed the same morning: the badge built so nobody has to ask "why
 * hasn't this sent" became the thing asserting the send.
 *
 * ## What these pin
 *
 * Three boundaries, because the states either side of each are the ones
 * a careless edit collapses: inside the window (say nothing — the badge
 * is right), past it (say the truth, with the clock), past seven days
 * (a different truth, no clock left).
 *
 * The hour figures are the real ones from that lead where it matters.
 */
import { describe, it, expect } from "vitest";
import { computeAutomationStatus, type AutomationStatusLead, type BusinessAutomationRules } from "@/lib/automationStatus";
import type { Message } from "@/lib/types";

const NOW = new Date("2026-09-23T05:43:48Z");

const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const inbound = (channel: Message["channel"], h: number): Message => ({
  id: `in-${channel}-${h}`,
  direction: "inbound",
  channel,
  body: "What do you mean",
  date: hoursAgo(h),
});

const rules: BusinessAutomationRules = {
  canSend: true,
  masterEnabled: true,
  unansweredEnabled: true,
  unansweredHours: 4,
  deadLeadEnabled: true,
  deadLeadDays: 60,
  holdAllForApproval: true,
} as BusinessAutomationRules;

const lead = (conversation: Message[]): AutomationStatusLead => ({
  stage: "new",
  automationTier: "assisted",
  lastContacted: hoursAgo(64.5),
  conversation,
  sequence: null,
  aiPausedReason: null,
});

describe("an Instagram lead past Meta's 24-hour window", () => {
  it("says the window has closed rather than promising a draft", () => {
    // 64.5 hours: the real figure from the lead that exposed this.
    const status = computeAutomationStatus(lead([inbound("instagram", 64.5)]), rules, NOW);
    expect(status.kind).toBe("meta_window_closed");
  });

  it("counts down what is left of the seven days, in whole hours", () => {
    const status = computeAutomationStatus(lead([inbound("instagram", 64.5)]), rules, NOW);
    if (status.kind !== "meta_window_closed") throw new Error("wrong state");
    // 168 - 64.5 = 103.5, floored. A ceil here would promise an hour
    // that has already gone.
    expect(status.hoursLeftForPerson).toBe(103);
    expect(status.channel).toBe("Instagram");
  });

  it("leaves the badge alone while the window is still open", () => {
    // 23 hours: still repliable, and the ordinary timing states are the
    // correct thing to show. A check that fired here would put a coral
    // warning on every healthy DM lead in the account.
    const status = computeAutomationStatus(lead([inbound("instagram", 23)]), rules, NOW);
    expect(status.kind).not.toBe("meta_window_closed");
  });

  it("drops the clock once seven days have gone", () => {
    const status = computeAutomationStatus(lead([inbound("instagram", 169)]), rules, NOW);
    if (status.kind !== "meta_window_closed") throw new Error("wrong state");
    // null, not 0 or a negative. There is no time left to report, and
    // "0 hours left" reads as a countdown still running.
    expect(status.hoursLeftForPerson).toBeNull();
  });

  it("names Messenger as Messenger", () => {
    const status = computeAutomationStatus(lead([inbound("messenger", 64.5)]), rules, NOW);
    if (status.kind !== "meta_window_closed") throw new Error("wrong state");
    expect(status.channel).toBe("Messenger");
  });
});

describe("what the window must NOT swallow", () => {
  it("ignores channels Meta's window does not govern", () => {
    // Email and SMS have no such window. WhatsApp has one but also has
    // approved templates as a sanctioned way through, which is why
    // metaWindow.ts deliberately excludes it — warning here would tell
    // an owner a send is impossible when the template path is expected
    // to work.
    for (const channel of ["email", "text", "whatsapp", "call", "web"] as const) {
      const status = computeAutomationStatus(lead([inbound(channel, 200)]), rules, NOW);
      expect(status.kind, `${channel} was treated as a Meta DM`).not.toBe("meta_window_closed");
    }
  });

  it("follows the newest inbound, so a lead who moved to email is not blocked", () => {
    // Wrote on Instagram days ago, emailed an hour ago. Reachable by
    // email, and the Instagram clock is irrelevant.
    const status = computeAutomationStatus(lead([inbound("instagram", 64.5), inbound("email", 1)]), rules, NOW);
    expect(status.kind).not.toBe("meta_window_closed");
  });

  it("still blocks when the newest inbound is the DM and an email exists too", () => {
    // The reverse, and it must NOT fall through to email: R-003 says
    // there is no email fallback for a shut DM window. A badge that
    // implied one would promise a send the sender refuses to make.
    const status = computeAutomationStatus(lead([inbound("email", 100), inbound("instagram", 64.5)]), rules, NOW);
    expect(status.kind).toBe("meta_window_closed");
  });

  it("says nothing on a lead who has never written", () => {
    const status = computeAutomationStatus(lead([]), rules, NOW);
    expect(status.kind).not.toBe("meta_window_closed");
  });
});
