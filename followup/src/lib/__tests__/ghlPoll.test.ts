/**
 * GHL 2: what FollowUp does with each text and email it reads from the owner's GoHighLevel (src/lib/ghlPoll.ts).
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { findUnique: vi.fn(), update: vi.fn(async () => ({})) },
    message: { findUnique: vi.fn(), findFirst: vi.fn(), create: vi.fn(async () => ({})) },
    crmConnection: { findUnique: vi.fn(), findMany: vi.fn() },
    business: { findUnique: vi.fn(async () => ({ subscriptionStatus: "active" })) },
  },
}));
vi.mock("@/lib/billing", () => ({ hasActiveAccess: vi.fn(() => true) }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead: vi.fn(async () => {}) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn(async () => {}) }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn(async () => {}) }));
vi.mock("@/lib/instagram", () => ({ createInboundMessageIfNew: vi.fn(async () => true) }));
vi.mock("@/lib/crmSync", () => ({ upsertCrmLead: vi.fn(async () => "imported") }));
vi.mock("@/lib/crm/ghlThreads", () => ({ findOrCreateGhlConversation: vi.fn(async () => ({ id: "conv1" })) }));
vi.mock("@/lib/crm/gohighlevel", () => ({ ghlContact: vi.fn(), ghlConversationMessages: vi.fn(), ghlConversationsSince: vi.fn() }));

import { prisma } from "@/lib/db";
import { scoreAndDraftForLead } from "@/lib/scoring";
import { createInboundMessageIfNew } from "@/lib/instagram";
import { upsertCrmLead } from "@/lib/crmSync";
import { findOrCreateGhlConversation } from "@/lib/crm/ghlThreads";
import { ghlContact, ghlConversationMessages, ghlConversationsSince, type GhlMessage } from "@/lib/crm/gohighlevel";
import { ghlReadFrom, pollGoHighLevelForBusiness, processGhlMessage } from "@/lib/ghlPoll";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const KEY = "loc123ABC|pit-0000-1111-2222";
const LEAD = { id: "lead1", businessId: "biz1", lastContacted: null };
const msg = (over: Partial<GhlMessage> = {}): GhlMessage => ({
  id: "m1",
  conversationId: "gc1",
  contactId: "ct1",
  channel: "text",
  direction: "inbound",
  body: "Is it still for sale?",
  at: new Date("2026-10-16T20:00:00.000Z"),
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  p.lead.findUnique.mockResolvedValue(LEAD);
  p.message.findUnique.mockResolvedValue(null);
  (createInboundMessageIfNew as ReturnType<typeof vi.fn>).mockResolvedValue(true);
});

describe("a customer's message", () => {
  it("is stored once, in the GoHighLevel conversation, and drafted for", async () => {
    expect(await processGhlMessage("biz1", KEY, msg())).toBe("new_inbound");
    expect(findOrCreateGhlConversation).toHaveBeenCalledWith("lead1", "gc1", "text");
    expect(createInboundMessageIfNew).toHaveBeenCalledWith("conv1", "Is it still for sale?", msg().at, "m1");
    expect(scoreAndDraftForLead).toHaveBeenCalledWith("lead1");
  });

  it("read again, does nothing more", async () => {
    (createInboundMessageIfNew as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    expect(await processGhlMessage("biz1", KEY, msg())).toBe("already_had");
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
  });

  it("STOP by text stops texts, as on any text", async () => {
    await processGhlMessage("biz1", KEY, msg({ body: "STOP" }));
    expect(p.lead.update).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { optedOutAt: expect.any(Date) } });
  });

  it("STOP on WhatsApp stops them too", async () => {
    await processGhlMessage("biz1", KEY, msg({ body: "STOP", channel: "whatsapp" }));
    expect(p.lead.update).toHaveBeenCalledWith({ where: { id: "lead1" }, data: { optedOutAt: expect.any(Date) } });
  });

  it("STOP on Instagram is left to GoHighLevel's own do-not-contact", async () => {
    await processGhlMessage("biz1", KEY, msg({ body: "STOP", channel: "instagram" }));
    expect(p.lead.update).not.toHaveBeenCalledWith({ where: { id: "lead1" }, data: { optedOutAt: expect.any(Date) } });
  });

  it("from someone the contact sync hasn't brought in yet: brought in now", async () => {
    p.lead.findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce(LEAD);
    (ghlContact as ReturnType<typeof vi.fn>).mockResolvedValue({ externalId: "ct1", name: "Nadia Khan", email: null, phone: "+14165550199", createdAt: new Date() });
    expect(await processGhlMessage("biz1", KEY, msg())).toBe("new_inbound");
    expect(upsertCrmLead).toHaveBeenCalledWith("biz1", "gohighlevel", expect.objectContaining({ externalId: "ct1" }));
  });

  it("from a contact GoHighLevel won't show: skipped, nothing stored", async () => {
    p.lead.findUnique.mockResolvedValue(null);
    (ghlContact as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    expect(await processGhlMessage("biz1", KEY, msg())).toBe("no_customer");
    expect(createInboundMessageIfNew).not.toHaveBeenCalled();
  });
});

describe("a reply from the business", () => {
  it("typed in GoHighLevel: kept as a reply that didn't go through FollowUp, and not drafted for", async () => {
    expect(await processGhlMessage("biz1", KEY, msg({ direction: "outbound", body: "Yes, still available." }))).toBe("new_outbound");
    expect(p.message.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ conversationId: "conv1", direction: "outbound", source: "gohighlevel_direct", externalId: "m1" }),
    });
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
  });

  it("sent by FollowUp itself: already stored by the send, so nothing new", async () => {
    p.message.findUnique.mockResolvedValue({ id: "row1" });
    expect(await processGhlMessage("biz1", KEY, msg({ direction: "outbound" }))).toBe("already_had");
    expect(p.message.create).not.toHaveBeenCalled();
  });
});

describe("where reading starts", () => {
  const now = Date.parse("2026-10-16T21:00:00.000Z");

  it("first time: 15 minutes back, so connecting never answers old conversations", async () => {
    p.message.findFirst.mockResolvedValue(null);
    expect((await ghlReadFrom("biz1", now)).toISOString()).toBe("2026-10-16T20:45:00.000Z");
  });

  it("after that: a little before the newest message already stored", async () => {
    p.message.findFirst.mockResolvedValue({ sentAt: new Date("2026-10-16T20:50:00.000Z") });
    expect((await ghlReadFrom("biz1", now)).toISOString()).toBe("2026-10-16T20:48:00.000Z");
  });

  it("never more than a day back", async () => {
    p.message.findFirst.mockResolvedValue({ sentAt: new Date("2026-10-10T00:00:00.000Z") });
    expect((await ghlReadFrom("biz1", now)).toISOString()).toBe("2026-10-15T21:00:00.000Z");
  });
});

describe("a tick", () => {
  it("does nothing for a business on another CRM", async () => {
    p.crmConnection.findUnique.mockResolvedValue({ provider: "hubspot", apiKey: "x" });
    expect(await pollGoHighLevelForBusiness("biz1")).toEqual({ ok: true, inbound: 0, outbound: 0 });
    expect(ghlConversationsSince).not.toHaveBeenCalled();
  });

  it("handles a conversation's messages oldest first, and skips what came before the window", async () => {
    const now = Date.parse("2026-10-16T21:00:00.000Z");
    p.crmConnection.findUnique.mockResolvedValue({ provider: "gohighlevel", apiKey: KEY });
    p.message.findFirst.mockResolvedValue({ sentAt: new Date("2026-10-16T20:50:00.000Z") });
    (ghlConversationsSince as ReturnType<typeof vi.fn>).mockResolvedValue([{ id: "gc1", contactId: "ct1" }]);
    (ghlConversationMessages as ReturnType<typeof vi.fn>).mockResolvedValue([
      msg({ id: "late", at: new Date("2026-10-16T20:58:00.000Z") }),
      msg({ id: "early", at: new Date("2026-10-16T20:55:00.000Z") }),
      msg({ id: "old", at: new Date("2026-10-16T20:00:00.000Z") }),
    ]);
    const r = await pollGoHighLevelForBusiness("biz1", now);
    expect(r).toEqual({ ok: true, inbound: 2, outbound: 0 });
    const ids = (createInboundMessageIfNew as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[3]);
    expect(ids).toEqual(["early", "late"]);
  });
});
