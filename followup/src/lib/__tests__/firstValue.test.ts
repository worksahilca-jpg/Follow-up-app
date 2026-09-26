import { describe, it, expect } from "vitest";
import { firstValueNote } from "@/lib/firstValue";

const tz = "America/Toronto";
// 2026-09-26 14:00 in Toronto.
const now = new Date("2026-09-26T18:00:00Z");

describe("firstValueNote", () => {
  it("says it on the day, by name, with the channel", () => {
    const note = firstValueNote({ sentAt: new Date("2026-09-26T13:30:00Z"), channel: "instagram", repliedAt: null, leadName: "Priya Shah" }, now, tz);
    expect(note).toEqual({
      title: "Your first reply went out through FollowUp.",
      body: "Priya Shah got it on Instagram this morning. From here FollowUp keeps watching, and tells you when Priya writes back.",
    });
  });

  it("is gone the next day", () => {
    const note = firstValueNote({ sentAt: new Date("2026-09-25T20:00:00Z"), channel: "email", repliedAt: null, leadName: "Priya" }, now, tz);
    expect(note).toBeNull();
  });

  it("says so when the customer has already written back", () => {
    const note = firstValueNote(
      { sentAt: new Date("2026-09-26T17:00:00Z"), channel: "email", repliedAt: new Date("2026-09-26T17:30:00Z"), leadName: "Omar Haddad" },
      now,
      tz
    );
    expect(note?.body).toBe("Omar Haddad got it by email this afternoon, and has already written back.");
  });

  it("never uses a pronoun", () => {
    const note = firstValueNote({ sentAt: new Date("2026-09-26T17:00:00Z"), channel: "call", repliedAt: null, leadName: "  " }, now, tz);
    expect(note?.body).toBe("Your customer got it this afternoon. From here FollowUp keeps watching, and tells you when the customer writes back.");
    expect(note?.body).not.toMatch(/\b(he|she|his|her|they)\b/i);
  });

  it("is null with no first value yet", () => {
    expect(firstValueNote(null, now, tz)).toBeNull();
  });
});
