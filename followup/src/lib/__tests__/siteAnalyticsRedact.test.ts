import { describe, it, expect, vi } from "vitest";

vi.mock("@vercel/analytics/next", () => ({ Analytics: () => null }));

import { redact } from "@/components/SiteAnalytics";

describe("site analytics redaction", () => {
  it("sends only the path, never the query string", () => {
    const out = redact({ type: "pageview", url: "https://followupbase.io/onboarding?gmail=connected&email=a%40b.com" });
    expect(out).toEqual({ type: "pageview", url: "https://followupbase.io/onboarding" });
  });

  it("drops the founder's own admin pages entirely", () => {
    expect(redact({ type: "pageview", url: "https://followupbase.io/admin" })).toBeNull();
    expect(redact({ type: "pageview", url: "https://followupbase.io/admin/office?x=1" })).toBeNull();
  });

  it("keeps ordinary pages as they are", () => {
    expect(redact({ type: "pageview", url: "https://followupbase.io/" })).toEqual({ type: "pageview", url: "https://followupbase.io/" });
  });
});
