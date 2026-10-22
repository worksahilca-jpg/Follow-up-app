/**
 * "Missed by your CRM" (A-315), the pure half: where they wrote in the owner's words, what Results shows, the name the
 * CRM gets, and the note that goes with them.
 */
import { describe, expect, it } from "vitest";
import { addedNote, checkedAgo, crmName, missedState, noteWords, placeLabel, placesOf, type MissedLead } from "@/lib/missedByCrm";

function lead(id: string, over: Partial<MissedLead> = {}): MissedLead {
  return {
    id,
    name: `Customer ${id}`,
    email: `${id}@example.com`,
    phone: null,
    source: "Gmail",
    createdAt: new Date("2026-10-15T15:00:00Z"),
    crmId: null,
    crmAddedAt: null,
    channel: "email",
    emailProvider: "gmail",
    firstWords: "Is the condo still available?",
    wroteAt: new Date("2026-10-15T15:00:00Z"),
    ...over,
  };
}

describe("where they wrote", () => {
  it("names the place the way the owner does", () => {
    expect(placeLabel("email", "gmail", "Gmail")).toBe("Gmail");
    expect(placeLabel("email", "outlook", "Outlook")).toBe("Outlook");
    expect(placeLabel("email", null, null)).toBe("Email");
    expect(placeLabel("instagram", null, "Instagram")).toBe("Instagram");
    expect(placeLabel("messenger", null, "Facebook Messenger")).toBe("Messenger");
    expect(placeLabel("whatsapp", null, null)).toBe("WhatsApp");
    expect(placeLabel("web", null, "Website form")).toBe("Website form");
    expect(placeLabel("web", null, "Facebook Lead Ad")).toBe("Facebook lead form");
  });

  it("reads the source when there is no conversation channel", () => {
    expect(placeLabel(null, null, "Instagram DM")).toBe("Instagram");
    expect(placeLabel(null, null, "Website widget")).toBe("Website form");
    expect(placeLabel(null, null, "Something else")).toBe("Other");
  });

  it("puts the place with the most first", () => {
    const places = placesOf([
      lead("a", { channel: "instagram", source: "Instagram" }),
      lead("b"),
      lead("c"),
      lead("d", { channel: "web", source: "Website form" }),
    ]);
    expect(places).toEqual([
      { label: "Gmail", count: 2 },
      { label: "Instagram", count: 1 },
      { label: "Website form", count: 1 },
    ]);
  });
});

describe("what Results shows", () => {
  it("shows nothing when nobody is missing and FollowUp added nobody", () => {
    expect(missedState([])).toEqual({ kind: "none" });
  });

  it("counts only the ones still missing while any are", () => {
    const s = missedState([lead("a"), lead("b", { crmId: "9", crmAddedAt: new Date() }), lead("c")]);
    expect(s.kind).toBe("missing");
    if (s.kind === "missing") {
      expect(s.missing.map((l) => l.id)).toEqual(["a", "c"]);
      expect(s.places).toEqual([{ label: "Gmail", count: 2 }]);
    }
  });

  it("says all are in once FollowUp added every one", () => {
    const s = missedState([lead("a", { crmId: "1", crmAddedAt: new Date() }), lead("b", { crmId: "2", crmAddedAt: new Date(), channel: "instagram" })]);
    expect(s).toEqual({ kind: "all_in", caught: 2, places: [{ label: "Gmail", count: 1 }, { label: "Instagram", count: 1 }] });
  });

  it("never counts someone the CRM had on its own", () => {
    expect(missedState([lead("a", { crmId: "1" })])).toEqual({ kind: "none" });
  });
});

describe("the name the CRM gets", () => {
  it("splits a real name into first and last", () => {
    expect(crmName("Priya Shah")).toEqual({ firstName: "Priya", lastName: "Shah" });
    expect(crmName("  Ana María de la Cruz ")).toEqual({ firstName: "Ana", lastName: "María de la Cruz" });
    expect(crmName("Daniel")).toEqual({ firstName: "Daniel", lastName: "" });
  });

  it("keeps an Instagram handle whole", () => {
    expect(crmName("@priya.homes")).toEqual({ firstName: "@priya.homes", lastName: "" });
  });

  it("never makes a name out of a placeholder, an email or a phone number", () => {
    expect(crmName("Instagram DM")).toEqual({ firstName: "", lastName: "" });
    expect(crmName("Facebook Messenger")).toEqual({ firstName: "", lastName: "" });
    expect(crmName("jo@example.com")).toEqual({ firstName: "", lastName: "" });
    expect(crmName("+14165550199")).toEqual({ firstName: "", lastName: "" });
    expect(crmName("")).toEqual({ firstName: "", lastName: "" });
  });
});

describe("the note on their new CRM record", () => {
  const messages = [
    { body: "Is Saturday ok?", sentAt: new Date("2026-10-20T16:00:00Z") },
    { body: "Looking for a 2-bed\n\ncondo near Square One", sentAt: new Date("2026-10-19T16:00:00Z") },
  ];

  it("says who, where, and their own words in order", () => {
    expect(addedNote({ name: "Priya Shah", place: "Instagram", crmLabel: "Follow Up Boss", messages }, "America/Toronto")).toBe(
      [
        "FollowUp added Priya Shah. They wrote on Instagram and weren't in Follow Up Boss.",
        'Oct 19: "Looking for a 2-bed condo near Square One"',
        'Oct 20: "Is Saturday ok?"',
      ].join("\n")
    );
  });

  it("calls a customer with only a placeholder name 'this customer'", () => {
    expect(addedNote({ name: "Instagram DM", place: "Instagram", crmLabel: "HubSpot", messages: [] })).toBe(
      "FollowUp added this customer. They wrote on Instagram and weren't in HubSpot."
    );
  });

  it("keeps the latest five and cuts a long message at a word", () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ body: `Message ${i}`, sentAt: new Date(Date.UTC(2026, 9, 10 + i, 16)) }));
    const note = addedNote({ name: "Jo Lee", place: "Gmail", crmLabel: "HubSpot", messages: many }, "UTC");
    expect(note.split("\n")).toHaveLength(6);
    expect(note).not.toContain("Message 1");
    expect(note).toContain("Message 6");
    const long = noteWords("word ".repeat(200), 50);
    expect(long.length).toBeLessThanOrEqual(51);
    expect(long.endsWith("…")).toBe(true);
    expect(long).not.toMatch(/wor…$/);
  });

  it("leaves out a message with no words", () => {
    const note = addedNote({ name: "Jo Lee", place: "Gmail", crmLabel: "HubSpot", messages: [{ body: "  \n ", sentAt: new Date() }] });
    expect(note.split("\n")).toHaveLength(1);
  });
});

describe("when FollowUp last checked", () => {
  const now = new Date("2026-10-22T18:00:00Z");
  it("says it plainly", () => {
    expect(checkedAgo(new Date("2026-10-22T17:59:40Z"), now)).toBe("just now");
    expect(checkedAgo(new Date("2026-10-22T17:58:00Z"), now)).toBe("2 min ago");
    expect(checkedAgo(new Date("2026-10-22T15:00:00Z"), now)).toBe("3 h ago");
    expect(checkedAgo(new Date("2026-10-19T15:00:00Z"), now, "America/Toronto")).toBe("Oct 19");
  });
});
