/**
 * The four things FollowUp writes on its own (A-253: one line each on the
 * Follow-up plans page, no numbers). Each switch must turn only its own rule
 * on or off, and keep the number the owner saved before the numbers left the
 * screen: a check-in switch that reset "14 days" to a default would quietly
 * change who gets written to.
 */
import { describe, it, expect } from "vitest";
import { saveBody, type Rules } from "@/components/app/FollowUpSwitches";

const saved: Rules = {
  instantAck: true,
  unanswered: { enabled: true, hours: 36 },
  checkIn: { enabled: true, days: 14 },
  welcomeBack: { enabled: false, days: 90 },
};

describe("a switch on the Follow-up plans page", () => {
  it("turns the instant thank-you on or off, and nothing else", () => {
    expect(saveBody(saved, "instantAck", false)).toEqual({ instantAck: false });
  });

  it("keeps the saved hours when the reply rule is turned off", () => {
    expect(saveBody(saved, "unanswered", false)).toEqual({ unansweredReply: { enabled: false, hours: 36 } });
  });

  it("keeps the saved days when check-ins are turned off", () => {
    expect(saveBody(saved, "checkIn", false)).toEqual({ enabled: false, triggerDays: 14 });
  });

  it("keeps the saved days when welcome-back is turned on", () => {
    expect(saveBody(saved, "welcomeBack", true)).toEqual({ deadLeadReactivation: { enabled: true, days: 90 } });
  });
});
