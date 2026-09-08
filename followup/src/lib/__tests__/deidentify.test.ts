/**
 * Guarantees of the de-identification boundary (src/lib/deidentify.ts,
 * task #74): a business that hasn't opted in never has its conversations
 * read for this purpose at all, and one that has never gets a raw name,
 * email, phone number, or address back — reformatted or not.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: vi.fn() },
    lead: { findMany: vi.fn() },
  },
}));

import { prisma } from "@/lib/db";
import { deidentifyText, leadIdentifiers, agentIdentifiers, buildDeidentifiedTrainingSet } from "@/lib/deidentify";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

beforeEach(() => {
  p.business.findUnique.mockReset();
  p.lead.findMany.mockReset();
});

describe("deidentifyText", () => {
  const identifiers = [
    ...leadIdentifiers({ name: "Priya Sharma", email: "priya.sharma@example.com", phone: "8609358202", company: "Sharma Realty" }),
    ...agentIdentifiers({ name: "Jordan Lee", email: "jordan@followupbase.io" }),
  ];

  it("replaces the lead's name, email, and company with role-tagged placeholders", () => {
    const text = "Hi, this is Priya Sharma from Sharma Realty — reach me at priya.sharma@example.com.";
    const result = deidentifyText(text, identifiers);
    expect(result).not.toMatch(/Priya Sharma|Sharma Realty|priya\.sharma@example\.com/i);
    expect(result).toContain("[LEAD_NAME]");
    expect(result).toContain("[LEAD_COMPANY]");
    expect(result).toContain("[LEAD_EMAIL]");
  });

  it("catches the lead's phone number even reformatted differently than how it's stored", () => {
    const result = deidentifyText("Call me at (860) 935-8202 anytime.", identifiers);
    expect(result).not.toMatch(/860.*935.*8202/);
    expect(result).toContain("[LEAD_PHONE]");
  });

  it("tags the assigned agent separately from the lead", () => {
    const result = deidentifyText("Jordan Lee will follow up with you.", identifiers);
    expect(result).toContain("[AGENT_NAME]");
    expect(result).not.toContain("Jordan Lee");
  });

  it("falls back to a generic tag for PII the structured data doesn't know about", () => {
    const result = deidentifyText("You should also call my husband at 555-201-9988.", identifiers);
    expect(result).not.toMatch(/555.*201.*9988/);
    expect(result).toContain("[PHONE]");
  });

  it("catches a street address with the generic backstop", () => {
    const result = deidentifyText("The property is at 742 Evergreen Terrace.", identifiers);
    expect(result).toContain("[ADDRESS]");
    expect(result).not.toContain("742 Evergreen Terrace");
  });

  it("is a no-op on text with nothing identifying in it", () => {
    const result = deidentifyText("Sounds good, see you Thursday at 3pm.", identifiers);
    expect(result).toBe("Sounds good, see you Thursday at 3pm.");
  });

  it("never throws on an empty or missing identifier value", () => {
    expect(() => deidentifyText("hello", [{ value: "", placeholder: "[X]" }])).not.toThrow();
  });
});

describe("buildDeidentifiedTrainingSet", () => {
  it("returns nothing — and never even reads leads — for a business that hasn't opted in", async () => {
    p.business.findUnique.mockResolvedValueOnce({ allowModelTraining: false, industry: "Real estate" });
    const result = await buildDeidentifiedTrainingSet("biz1");
    expect(result).toEqual([]);
    expect(p.lead.findMany).not.toHaveBeenCalled();
  });

  it("returns nothing for a business that doesn't exist", async () => {
    p.business.findUnique.mockResolvedValueOnce(null);
    const result = await buildDeidentifiedTrainingSet("ghost");
    expect(result).toEqual([]);
    expect(p.lead.findMany).not.toHaveBeenCalled();
  });

  it("de-identifies every message for an opted-in business, and skips leads with no messages", async () => {
    p.business.findUnique.mockResolvedValueOnce({ allowModelTraining: true, industry: "Real estate" });
    p.lead.findMany.mockResolvedValueOnce([
      {
        id: "lead1",
        name: "Priya Sharma",
        email: "priya.sharma@example.com",
        phone: "8609358202",
        company: null,
        assignedTo: { name: "Jordan Lee", email: "jordan@followupbase.io" },
        conversations: [
          {
            channel: "email",
            messages: [
              { direction: "inbound", body: "Hi, I'm Priya Sharma, call me at 860-935-8202.", sentAt: new Date("2026-01-01T00:00:00Z") },
              { direction: "outbound", body: "Thanks Priya, Jordan Lee here — I'll call you shortly.", sentAt: new Date("2026-01-01T01:00:00Z") },
            ],
          },
        ],
      },
      {
        id: "lead2",
        name: "No Conversation",
        email: null,
        phone: null,
        company: null,
        assignedTo: null,
        conversations: [],
      },
    ]);

    const result = await buildDeidentifiedTrainingSet("biz1");
    expect(result).toHaveLength(1);
    expect(result[0].leadId).toBe("lead1");
    expect(result[0].businessId).toBe("biz1");
    expect(result[0].industry).toBe("Real estate");
    expect(result[0].messages).toHaveLength(2);
    expect(result[0].messages[0].role).toBe("lead");
    expect(result[0].messages[1].role).toBe("business");

    const serialized = JSON.stringify(result);
    expect(serialized).not.toMatch(/Priya Sharma|priya\.sharma@example\.com|860.*935.*8202|Jordan Lee/i);
  });
});
