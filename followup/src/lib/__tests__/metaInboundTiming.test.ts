/**
 * A DM is timed from when the lead WROTE it, not from when FollowUp
 * noticed it (src/lib/inbound/meta.ts, eventSentAt).
 *
 * These were the same thing while a webhook was the only way a message
 * arrived. Now that src/lib/instagramPoll.ts also asks Meta every few
 * minutes — because Meta's push proved unreliable on 2026-09-19 — a
 * message can be noticed minutes after it was sent, and the two delays
 * used to stack: the acknowledgement holds for DM_ACK_GRACE_PERIOD_MS to
 * give the owner first go, and starting that hold at the moment of
 * noticing made a lead who wrote three minutes ago wait another two.
 * Five minutes is not a business that looks awake.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { businessFindUnique } = vi.hoisted(() => ({ businessFindUnique: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: businessFindUnique }, user: { findMany: async () => [] }, notification: { create: async () => ({}) } } }));

type CreateInboundMessageIfNew = (conversationId: string, body: string, sentAt: Date, externalId?: string) => Promise<boolean>;
type CaptureDirectReply = (
  leadId: string,
  channel: string,
  body: string,
  source: string,
  externalId: string | undefined,
  sentAt: Date
) => Promise<void>;
type AcknowledgeNewLead = (leadId: string, input: { channel: string; inboundText?: string; inboundAt?: Date }) => Promise<unknown>;

const { createInboundMessageIfNew, findOrCreateLeadByInstagram, captureDirectReply } = vi.hoisted(() => ({
  createInboundMessageIfNew: vi.fn<CreateInboundMessageIfNew>(async () => true),
  findOrCreateLeadByInstagram: vi.fn(async () => ({ id: "lead1", name: "Lead", assignedToId: null })),
  captureDirectReply: vi.fn<CaptureDirectReply>(async () => {}),
}));
vi.mock("@/lib/instagram", () => ({ createInboundMessageIfNew, findOrCreateLeadByInstagram, captureDirectReply }));
vi.mock("@/lib/facebook", () => ({
  findOrCreateLeadByMessenger: vi.fn(async () => ({ id: "lead2", name: "Lead", assignedToId: null })),
  fetchLeadgenLead: vi.fn(),
  upsertLeadFromLeadgen: vi.fn(),
}));

const { acknowledgeNewLead } = vi.hoisted(() => ({ acknowledgeNewLead: vi.fn<AcknowledgeNewLead>(async () => ({ sent: true })) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead: vi.fn(async () => true) }));
vi.mock("@/lib/conversations", () => ({ findOrCreateConversation: vi.fn(async () => ({ id: "conv1" })) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/suppression", () => ({ suppress: vi.fn(), unsuppress: vi.fn() }));

import { processMetaEnvelope } from "@/lib/inbound/meta";

const IG = "ig-account";
const LEAD = "lead-igsid";

function envelope(event: Record<string, unknown>) {
  return { object: "instagram", entry: [{ id: IG, messaging: [event] }] };
}
const dm = (timestamp: unknown, text = "is this available?") => ({
  sender: { id: LEAD },
  recipient: { id: IG },
  timestamp,
  message: { mid: `m-${String(timestamp)}`, text },
});

beforeEach(() => {
  vi.clearAllMocks();
  businessFindUnique.mockResolvedValue({ id: "biz1" });
});

describe("a DM is timed from when it was written", () => {
  it("starts the owner's head start when the lead wrote, not when a late poll found it", async () => {
    const wroteAt = Date.now() - 3 * 60_000;
    await processMetaEnvelope(envelope(dm(wroteAt)));

    const [, input] = acknowledgeNewLead.mock.calls[0];
    expect(input.inboundAt?.getTime()).toBe(wroteAt);
    // The whole point: three minutes have already elapsed, so the
    // two-minute head start is spent — not restarted from now.
    expect(Date.now() - input.inboundAt!.getTime()).toBeGreaterThan(2 * 60_000);
  });

  it("stores the message at the time it was sent, so the thread reads in order", async () => {
    const wroteAt = Date.now() - 90_000;
    await processMetaEnvelope(envelope(dm(wroteAt)));
    expect(createInboundMessageIfNew.mock.calls[0][2].getTime()).toBe(wroteAt);
  });

  it("never parks an acknowledgement in the future when Meta's clock runs ahead", async () => {
    const before = Date.now();
    await processMetaEnvelope(envelope(dm(Date.now() + 10 * 60_000)));
    const [, input] = acknowledgeNewLead.mock.calls[0];
    expect(input.inboundAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(input.inboundAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it.each([
    ["missing", undefined],
    ["not a number", "1789837113"],
    ["zero", 0],
  ])("falls back to now when the timestamp is %s", async (_label, timestamp) => {
    const before = Date.now();
    await processMetaEnvelope(envelope(dm(timestamp)));
    const [, input] = acknowledgeNewLead.mock.calls[0];
    expect(input.inboundAt!.getTime()).toBeGreaterThanOrEqual(before);
    expect(input.inboundAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("times the owner's own reply from the Instagram app the same way", async () => {
    const sentAt = Date.now() - 45_000;
    await processMetaEnvelope(
      envelope({
        sender: { id: IG },
        recipient: { id: LEAD },
        timestamp: sentAt,
        message: { mid: "echo1", text: "on my way", is_echo: true },
      })
    );
    expect(captureDirectReply.mock.calls[0][5].getTime()).toBe(sentAt);
  });
});
