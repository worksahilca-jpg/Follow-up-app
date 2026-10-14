/**
 * "What FollowUp wrote in Follow Up Boss" (A-252): each write said the way the owner would say it.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));

import { describeWrite } from "@/lib/crm/record";

describe("describeWrite", () => {
  it("names the customer and quotes the reply that was sent", () => {
    expect(describeWrite("note", "FollowUp sent:\n\nYes, the Maple St condo is still available. Saturday at 10?", "Nadia Khan")).toEqual({
      title: "Note on Nadia Khan",
      quote: 'Sent: "Yes, the Maple St condo is still available. Saturday at 10?"',
    });
  });

  it("says when the note was the ready card, with what FollowUp learned", () => {
    const text = ["FollowUp: Raj Malhotra looks ready to talk.", 'Area: Elm St ("the 3 bed on Elm St")', "Money: Pre-approved up to $900k"].join("\n");
    expect(describeWrite("note", text, "Raj Malhotra")).toEqual({
      title: "Note on Raj Malhotra: ready to talk",
      quote: 'Area: Elm St ("the 3 bed on Elm St") · Money: Pre-approved up to $900k',
    });
  });

  it("keeps a long reply to one short line", () => {
    const { quote } = describeWrite("note", `FollowUp sent:\n\n${"word ".repeat(60)}`, "Ava Thompson");
    expect(quote!.length).toBeLessThanOrEqual(100);
    expect(quote!.endsWith('…"')).toBe(true);
  });
});
