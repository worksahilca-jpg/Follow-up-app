/**
 * "Nothing connected, no drafting" (src/lib/sendChannels.ts). The case
 * behind it: an owner disconnected Gmail on day two and the hourly
 * automation kept drafting and holding follow-ups for him for twelve days
 * — 97 OpenAI-backed holds that could never be sent.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique, integrationFindFirst } = vi.hoisted(() => ({
  businessFindUnique: vi.fn(),
  integrationFindFirst: vi.fn(),
}));
vi.mock("@/lib/db", () => ({
  prisma: { business: { findUnique: businessFindUnique }, integration: { findFirst: integrationFindFirst } },
}));

import { hasAnySendChannel } from "@/lib/sendChannels";

const nothing = {
  instagramUserId: null,
  instagramAccessToken: null,
  facebookPageId: null,
  facebookPageAccessToken: null,
  whatsappPhoneNumberId: null,
  whatsappAccessToken: null,
  twilioAccountSid: null,
  twilioAuthToken: null,
  twilioPhoneNumber: null,
  whatsappPhoneNumber: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  businessFindUnique.mockResolvedValue(nothing);
  integrationFindFirst.mockResolvedValue(null);
});

describe("hasAnySendChannel", () => {
  it("is false for a business with an inbox disconnected and nothing else", async () => {
    expect(await hasAnySendChannel("biz1")).toBe(false);
    // Only a CONNECTED Gmail/Outlook counts — "needs_reconnect" and
    // "disconnected" rows are exactly the case this exists for.
    expect(integrationFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { status: "connected", provider: { in: ["gmail", "outlook"] }, user: { businessId: "biz1" } } })
    );
  });

  it("is true the moment an inbox is connected again", async () => {
    integrationFindFirst.mockResolvedValueOnce({ id: "int1" });
    expect(await hasAnySendChannel("biz1")).toBe(true);
  });

  it.each([
    ["Instagram", { instagramUserId: "ig", instagramAccessToken: "tok" }],
    ["Facebook", { facebookPageId: "pg", facebookPageAccessToken: "tok" }],
    ["WhatsApp through Meta", { whatsappPhoneNumberId: "pn", whatsappAccessToken: "tok" }],
    ["Twilio", { twilioAccountSid: "AC", twilioAuthToken: "tok", twilioPhoneNumber: "+1" }],
  ])("is true with %s connected", async (_label, fields) => {
    businessFindUnique.mockResolvedValueOnce({ ...nothing, ...fields });
    expect(await hasAnySendChannel("biz1")).toBe(true);
  });

  it("is false for a half-connected channel (an id without its token)", async () => {
    businessFindUnique.mockResolvedValueOnce({ ...nothing, instagramUserId: "ig" });
    expect(await hasAnySendChannel("biz1")).toBe(false);
  });
});
