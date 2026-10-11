/**
 * A Reel, post, story mention or sticker sent with no words is not a
 * customer asking for something (founder, 2026-10-11: "why should we pick
 * it up? ... We'll be picking up only those who are actually customers or
 * leads"). From someone new it is not picked up at all; from an existing
 * customer it stays in the thread and asks for nothing.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique, leadFindFirst } = vi.hoisted(() => ({ businessFindUnique: vi.fn(), leadFindFirst: vi.fn() }));
vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: businessFindUnique },
    lead: { findFirst: leadFindFirst },
    user: { findMany: async () => [] },
    notification: { create: async () => ({}) },
  },
}));
const { createInboundMessageIfNew, findOrCreateLeadByInstagram, captureDirectReply } = vi.hoisted(() => ({
  createInboundMessageIfNew: vi.fn(async () => true),
  findOrCreateLeadByInstagram: vi.fn(async () => ({ id: "lead1", name: "Lead", assignedToId: null })),
  captureDirectReply: vi.fn(async () => {}),
}));
vi.mock("@/lib/instagram", () => ({ createInboundMessageIfNew, findOrCreateLeadByInstagram, captureDirectReply }));
const { findOrCreateLeadByMessenger } = vi.hoisted(() => ({ findOrCreateLeadByMessenger: vi.fn(async () => ({ id: "lead2", name: "Lead", assignedToId: null })) }));
vi.mock("@/lib/facebook", () => ({ findOrCreateLeadByMessenger, fetchLeadgenLead: vi.fn(), upsertLeadFromLeadgen: vi.fn() }));
const { acknowledgeNewLead, scoreAndDraftForLead } = vi.hoisted(() => ({
  acknowledgeNewLead: vi.fn(async () => ({ sent: false })),
  scoreAndDraftForLead: vi.fn(async () => true),
}));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead }));
vi.mock("@/lib/conversations", () => ({ findOrCreateConversation: vi.fn(async () => ({ id: "conv1" })) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/suppression", () => ({ suppress: vi.fn(), unsuppress: vi.fn() }));
// Whether the sender is a customer comes from the lead lookup below; the
// "is this a customer?" judge itself is covered in dmContactGate.test.ts.
vi.mock("@/lib/inbound/dmContactGate", () => ({
  isDmLead: vi.fn(async () => !!(await leadFindFirst())),
  judgeNewDmContact: vi.fn(async () => ({ admit: true, prior: [] })),
  dmContextLoader: () => async () => ({ classifier: undefined, aiAllowed: true }),
  writeDmThread: vi.fn(async () => {}),
  takeDmSetAside: vi.fn(async () => {}),
}));

import { isSharedContentOnly, isSharedContentType } from "@/lib/sharedContent";
import { messageContent, processMetaEnvelope } from "@/lib/inbound/meta";

const IG = "ig-account";
const PAGE = "fb-page";
const igEvent = (message: Record<string, unknown>) => ({
  object: "instagram",
  entry: [{ id: IG, messaging: [{ sender: { id: "someone" }, recipient: { id: IG }, timestamp: Date.now(), message: { mid: "m1", ...message } }] }],
});
const fbEvent = (message: Record<string, unknown>) => ({
  object: "page",
  entry: [{ id: PAGE, messaging: [{ sender: { id: "someone" }, recipient: { id: PAGE }, timestamp: Date.now(), message: { mid: "m2", ...message } }] }],
});

beforeEach(() => {
  vi.clearAllMocks();
  businessFindUnique.mockResolvedValue({ id: "biz1" });
  leadFindFirst.mockResolvedValue(null);
});

describe("what counts as shared content", () => {
  it("is a Reel, a post, a story mention, a sticker or a like, with no words", () => {
    for (const t of ["ig_reel", "share", "story_mention", "animated_image", "sticker", "like_heart"]) expect(isSharedContentType(t)).toBe(true);
    expect(isSharedContentOnly("[Sent ig_reel with no message text]")).toBe(true);
    expect(isSharedContentOnly("[Sent 2 share/ig_reel attachments with no message text]")).toBe(true);
  });

  it("is never a photo, video, voice note or file they sent themselves, or anything with words", () => {
    for (const t of ["image", "video", "audio", "file"]) expect(isSharedContentType(t)).toBe(false);
    expect(isSharedContentOnly("[Sent image with no message text]")).toBe(false);
    expect(isSharedContentOnly("[Sent 2 image/ig_reel attachments with no message text]")).toBe(false);
    expect(isSharedContentOnly("[Sent 1 media attachment with no message text]")).toBe(false);
    expect(isSharedContentOnly("Is this one still available?")).toBe(false);
    expect(isSharedContentOnly(null)).toBe(false);
  });

  it("is flagged when the DM is read", () => {
    expect(messageContent({ attachments: [{ type: "ig_reel" }] })).toMatchObject({ sharedOnly: true });
    expect(messageContent({ attachments: [{ type: "image" }] })).not.toHaveProperty("sharedOnly");
    expect(messageContent({ text: "how much?", attachments: [{ type: "ig_reel" }] })).not.toHaveProperty("sharedOnly");
  });
});

describe("on Instagram", () => {
  it("does not pick up someone new who only sends a Reel", async () => {
    await processMetaEnvelope(igEvent({ attachments: [{ type: "ig_reel" }] }));
    expect(findOrCreateLeadByInstagram).not.toHaveBeenCalled();
    expect(createInboundMessageIfNew).not.toHaveBeenCalled();
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
  });

  it("keeps it in an existing customer's thread, and asks for nothing", async () => {
    leadFindFirst.mockResolvedValue({ id: "lead1" });
    await processMetaEnvelope(igEvent({ attachments: [{ type: "ig_reel" }] }));
    expect(createInboundMessageIfNew).toHaveBeenCalledWith("conv1", "[Sent ig_reel with no message text]", expect.any(Date), "m1", undefined);
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
  });

  it("still picks up a Reel that comes with a question, and a photo they took", async () => {
    await processMetaEnvelope(igEvent({ text: "is this one still available?", attachments: [{ type: "ig_reel" }] }));
    expect(findOrCreateLeadByInstagram).toHaveBeenCalledTimes(1);
    expect(scoreAndDraftForLead).toHaveBeenCalledTimes(1);
    vi.clearAllMocks();
    await processMetaEnvelope(igEvent({ attachments: [{ type: "image" }] }));
    expect(findOrCreateLeadByInstagram).toHaveBeenCalledTimes(1);
    expect(scoreAndDraftForLead).toHaveBeenCalledTimes(1);
  });
});

describe("on Messenger", () => {
  it("does not pick up someone new who only sends a sticker", async () => {
    businessFindUnique.mockResolvedValue({ id: "biz1" });
    await processMetaEnvelope(fbEvent({ attachments: [{ type: "sticker" }] }));
    expect(findOrCreateLeadByMessenger).not.toHaveBeenCalled();
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
  });
});
