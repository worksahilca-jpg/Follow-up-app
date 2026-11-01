/** The line under every email FollowUp sends on its own (A-341, src/lib/emailFooter.ts). */
import { describe, expect, it } from "vitest";
import { automaticEmailFooter, STOP_LINE } from "@/lib/emailFooter";

describe("the automatic-email footer", () => {
  it("says who sent it, where, and how to stop, as drawn", () => {
    expect(automaticEmailFooter({ name: "Harbour Homes", mailingAddress: "100 King St W, Suite 500, Toronto ON M5X 1A9" })).toBe(
      '\n\n—\nHarbour Homes · 100 King St W, Suite 500, Toronto ON M5X 1A9\nNot looking any more? Reply "stop" and I won\'t follow up again.'
    );
  });

  it("puts an address typed on several lines on one", () => {
    expect(automaticEmailFooter({ name: "Harbour Homes", mailingAddress: "100 King St W,\n  Suite 500\nToronto ON M5X 1A9\n" })).toContain(
      "Harbour Homes · 100 King St W, Suite 500, Toronto ON M5X 1A9\n"
    );
  });

  it("keeps the stop line when there's no address yet, or no real name", () => {
    expect(automaticEmailFooter({ name: "Harbour Homes", mailingAddress: null })).toBe(`\n\n—\nHarbour Homes\n${STOP_LINE}`);
    expect(automaticEmailFooter({ name: "My Business", mailingAddress: "  " })).toBe(`\n\n—\n${STOP_LINE}`);
  });

  it("promises only what a reply of \"stop\" really does", () => {
    // src/lib/emailOptOut.ts records exactly this word on email.
    expect(STOP_LINE).toMatch(/Reply "stop"/);
  });
});
