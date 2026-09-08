import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));

import { parseLeadgenFields } from "@/lib/facebook";

describe("Facebook Lead Ad field parsing", () => {
  it("lifts name, email and phone out of Meta's field_data and keeps everything else verbatim", () => {
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
    expect(r.details).toBe("when_are_you_looking_to_buy?: 1-3 months\nbudget: $800k-1M");
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
});
