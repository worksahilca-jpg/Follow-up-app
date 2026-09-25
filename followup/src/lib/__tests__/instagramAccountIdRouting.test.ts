/**
 * A real Instagram webhook has to find its business (audit 2026-09-24 F1).
 *
 * Meta posts `entry.id` as the professional-account id (1784…). FollowUp
 * looked that up only against instagramUserId, the app-scoped id from /me
 * (2869…), so every real webhook fell through to "no business has
 * connected this account", was marked processed, and vanished with no
 * error anywhere. The poller builds its envelopes with the app-scoped id,
 * so both have to route.
 *
 * Also pinned here: a message FROM the account itself is never filed as a
 * lead, even when the event does not say is_echo — the production failure
 * was a lead whose phone was ig:17841427527466039, the business's own id.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const APP_SCOPED = "28693476873589439";
const PROFESSIONAL = "17841427527466039";
const LEAD = "lead-igsid";

type Where = { instagramUserId?: string; instagramAccountId?: string };
const { businessFindUnique } = vi.hoisted(() => ({ businessFindUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: { business: { findUnique: businessFindUnique }, user: { findMany: async () => [] }, notification: { create: async () => ({}) } },
}));

const { createInboundMessageIfNew, findOrCreateLeadByInstagram, captureDirectReply } = vi.hoisted(() => ({
  createInboundMessageIfNew: vi.fn(async () => true),
  findOrCreateLeadByInstagram: vi.fn(async (_businessId: string, senderId: string) => ({ id: `lead-for-${senderId}`, name: "Lead", assignedToId: null })),
  captureDirectReply: vi.fn(async () => {}),
}));
vi.mock("@/lib/instagram", () => ({ createInboundMessageIfNew, findOrCreateLeadByInstagram, captureDirectReply }));
vi.mock("@/lib/facebook", () => ({ findOrCreateLeadByMessenger: vi.fn(), fetchLeadgenLead: vi.fn(), upsertLeadFromLeadgen: vi.fn() }));
const { acknowledgeNewLead } = vi.hoisted(() => ({ acknowledgeNewLead: vi.fn(async () => ({ sent: true })) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead: vi.fn(async () => true) }));
vi.mock("@/lib/conversations", () => ({ findOrCreateConversation: vi.fn(async () => ({ id: "conv1" })) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/suppression", () => ({ suppress: vi.fn(), unsuppress: vi.fn() }));

import { processMetaEnvelope } from "@/lib/inbound/meta";

/** One connected business, findable by whichever of its ids the lookup asks for. */
function connected(business: { instagramUserId: string; instagramAccountId: string | null }) {
  businessFindUnique.mockImplementation(async ({ where }: { where: Where }) => {
    const hit =
      (where.instagramUserId !== undefined && where.instagramUserId === business.instagramUserId) ||
      (where.instagramAccountId !== undefined && where.instagramAccountId === business.instagramAccountId);
    return hit ? { id: "biz1", ...business } : null;
  });
}

const envelope = (entryId: string, event: Record<string, unknown>) => ({ object: "instagram", entry: [{ id: entryId, messaging: [event] }] });
const dmFrom = (senderId: string, recipientId: string, extra: Record<string, unknown> = {}) => ({
  sender: { id: senderId },
  recipient: { id: recipientId },
  timestamp: Date.now() - 1000,
  message: { mid: `m-${senderId}`, text: "is this still available?", ...extra },
});

beforeEach(() => {
  vi.clearAllMocks();
  connected({ instagramUserId: APP_SCOPED, instagramAccountId: PROFESSIONAL });
});

describe("routing an Instagram webhook", () => {
  it("routes a real webhook, whose entry.id is the professional-account id, to its business", async () => {
    await processMetaEnvelope(envelope(PROFESSIONAL, dmFrom(LEAD, PROFESSIONAL)));
    expect(findOrCreateLeadByInstagram).toHaveBeenCalledWith("biz1", LEAD, undefined);
    expect(createInboundMessageIfNew).toHaveBeenCalledTimes(1);
    expect(acknowledgeNewLead).toHaveBeenCalledTimes(1);
  });

  it("still routes the poller's envelopes, which carry the app-scoped id", async () => {
    await processMetaEnvelope(envelope(APP_SCOPED, dmFrom(LEAD, APP_SCOPED)));
    expect(findOrCreateLeadByInstagram).toHaveBeenCalledWith("biz1", LEAD, undefined);
  });

  it("matches each column by its own unique lookup, the existing one first", async () => {
    await processMetaEnvelope(envelope(PROFESSIONAL, dmFrom(LEAD, PROFESSIONAL)));
    const wheres = businessFindUnique.mock.calls.map(([args]) => (args as { where: Where }).where);
    expect(wheres).toEqual([{ instagramUserId: PROFESSIONAL }, { instagramAccountId: PROFESSIONAL }]);
  });

  it("still drops an event for an account nobody here has connected", async () => {
    await processMetaEnvelope(envelope("17841400000009999", dmFrom(LEAD, "17841400000009999")));
    expect(findOrCreateLeadByInstagram).not.toHaveBeenCalled();
    expect(createInboundMessageIfNew).not.toHaveBeenCalled();
  });

  it("does not route by the professional-account id for a business that has none stored yet", async () => {
    connected({ instagramUserId: APP_SCOPED, instagramAccountId: null });
    await processMetaEnvelope(envelope(PROFESSIONAL, dmFrom(LEAD, PROFESSIONAL)));
    expect(findOrCreateLeadByInstagram).not.toHaveBeenCalled();
  });
});

describe("a message from the account itself", () => {
  it("is recorded on the lead it was sent to, never as a lead from the business, even without is_echo", async () => {
    await processMetaEnvelope(envelope(PROFESSIONAL, dmFrom(PROFESSIONAL, LEAD)));
    expect(findOrCreateLeadByInstagram).not.toHaveBeenCalledWith("biz1", PROFESSIONAL, expect.anything());
    expect(findOrCreateLeadByInstagram).not.toHaveBeenCalledWith("biz1", PROFESSIONAL);
    expect(findOrCreateLeadByInstagram).toHaveBeenCalledWith("biz1", LEAD);
    expect(captureDirectReply).toHaveBeenCalledWith(`lead-for-${LEAD}`, "instagram", "is this still available?", "instagram_direct", `m-${PROFESSIONAL}`, expect.any(Date));
    expect(createInboundMessageIfNew).not.toHaveBeenCalled();
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
  });

  it("recognises the app-scoped id as the account too, whichever id the envelope was routed by", async () => {
    await processMetaEnvelope(envelope(PROFESSIONAL, dmFrom(APP_SCOPED, LEAD)));
    expect(findOrCreateLeadByInstagram).toHaveBeenCalledWith("biz1", LEAD);
    expect(createInboundMessageIfNew).not.toHaveBeenCalled();
  });

  it("is dropped, not filed, when it claims to be addressed to the account itself", async () => {
    await processMetaEnvelope(envelope(APP_SCOPED, dmFrom(APP_SCOPED, PROFESSIONAL, { is_echo: true })));
    expect(findOrCreateLeadByInstagram).not.toHaveBeenCalled();
    expect(captureDirectReply).not.toHaveBeenCalled();
  });
});
