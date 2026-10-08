import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));

import { META_TEST_LEAD_NAME, parseLeadgenFields } from "@/lib/facebook";

describe("Facebook Lead Ad field parsing", () => {
  it("lifts name, email and phone out of Meta's field_data and keeps every other answer", () => {
    const r = parseLeadgenFields([
      { name: "full_name", values: ["Harpreet Kaur"] },
      { name: "email", values: ["HARPS@EXAMPLE.COM"] },
      { name: "phone_number", values: ["+14372270697"] },
      { name: "when_are_you_looking_to_buy?", values: ["1-3 months"] },
      { name: "budget", values: ["$800k-1M"] },
    ]);
    expect(r.name).toBe("Harpreet Kaur");
    expect(r.email).toBe("harps@example.com");
    expect(r.phone).toBe("+14372270697");
    // Meta keys a custom question by its words: they come back readable.
    expect(r.details).toBe("When are you looking to buy? 1-3 months\nBudget: $800k-1M");
  });

  it("builds a name from first/last, and falls back to email when there is no name", () => {
    expect(parseLeadgenFields([{ name: "first_name", values: ["Young"] }, { name: "last_name", values: ["Son"] }]).name).toBe("Young Son");
    expect(parseLeadgenFields([{ name: "email", values: ["y@x.com"] }]).name).toBe("y@x.com");
  });

  it("ignores empty answers", () => {
    const r = parseLeadgenFields([{ name: "email", values: [] }, { name: "notes", values: [""] }]);
    expect(r.email).toBeNull();
    expect(r.details).toBe("");
    expect(r.name).toBe("Facebook lead");
  });
  // The founder's first test lead (2026-10-07): Meta's testing tool fills
  // each field with "<test lead: dummy data for …>". It showed as the name
  // ("Hi <test,") and sat behind the Call button as a phone number.
  it("reads Meta's test placeholders as a test lead, never as a name or a number", () => {
    const r = parseLeadgenFields([
      { name: "full_name", values: ["<test lead: dummy data for full_name>"] },
      { name: "email", values: ["test@meta.com"] },
      { name: "phone_number", values: ["<test lead: dummy data for phone_number>"] },
      { name: "what_are_you_looking_for?", values: ["<test lead: dummy data for what_are_you_looking_for?>"] },
    ]);
    expect(r.name).toBe(META_TEST_LEAD_NAME);
    expect(r.email).toBe("test@meta.com");
    expect(r.phone).toBeNull();
    expect(r.details).toBe("What are you looking for? (test answer)");
  });

  it("keeps a phone only when it is a number someone can dial; anything else stays as an answer", () => {
    expect(parseLeadgenFields([{ name: "email", values: ["a@b.co"] }, { name: "phone_number", values: ["+1 (437) 227-0697"] }]).phone).toBe("+1 (437) 227-0697");
    const r = parseLeadgenFields([{ name: "email", values: ["a@b.co"] }, { name: "phone_number", values: ["call me after 5"] }]);
    expect(r.phone).toBeNull();
    expect(r.details).toBe("Phone number: call me after 5");
  });

  it("keeps a second email or phone in the answers instead of dropping it", () => {
    const r = parseLeadgenFields([
      { name: "email", values: ["home@x.com"] },
      { name: "work_email", values: ["work@x.com"] },
      { name: "phone_number", values: ["4165550101"] },
      { name: "work_phone_number", values: ["4165550199"] },
    ]);
    expect(r.email).toBe("home@x.com");
    expect(r.phone).toBe("4165550101");
    expect(r.details).toBe("Work email: work@x.com\nWork phone number: 4165550199");
  });
});
