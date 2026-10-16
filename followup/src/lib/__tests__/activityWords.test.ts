import { describe, expect, it } from "vitest";
import { activityLine, namesLine } from "@/lib/activityWords";

// Activity says what FollowUp did on its own, one plain sentence a row (A-270).
describe("Activity's words", () => {
  it("names the people a folded line is about", () => {
    expect(namesLine(["Nina Petrova"])).toBe("Nina");
    expect(namesLine(["Nina Petrova", "Kofi Mensah"])).toBe("Nina and Kofi");
    expect(namesLine(["Nina Petrova", "Kofi Mensah", "Ava Thompson"])).toBe("Nina, Kofi and Ava");
    expect(namesLine(["Nina Petrova", "Kofi Mensah", "Ava Thompson", "Omar Haddad"])).toBe("Nina, Kofi and 2 more");
  });

  it("says each kind of thing plainly, never as a log line", () => {
    expect(activityLine({ type: "sequence_paused", message: "x" })).toBe("Wrote back, so FollowUp stopped the check-ins.");
    expect(activityLine({ type: "sequence_completed", message: "x" })).toBe("FollowUp finished the check-ins. No reply yet.");
    expect(activityLine({ type: "notice", message: "FollowUp lost access to your Outlook inbox, so new emails there aren't being picked up. Reconnect Outlook." })).toBe(
      "FollowUp lost access to your Outlook inbox, so new emails there aren't being picked up."
    );
    for (const t of ["automated_send", "sequence_paused", "sequence_completed", "rapid_engagement", "notice"] as const) {
      expect(activityLine({ type: t, message: "Something happened." })).not.toMatch(/—|Because/);
    }
  });
});
