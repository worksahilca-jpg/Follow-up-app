/**
 * A STOP has to land even when its first delivery failed.
 *
 * Found 2026-09-20 by the security pass. All three DM channels recorded
 * the inbound message, then bailed on `if (!isNew) continue` BEFORE
 * applying the opt-out the message carried. So a STOP whose first
 * processing died in between — a database blip, a timeout, a cold start
 * that ran out of time — was skipped on every redelivery after it:
 * "already recorded", consent never applied, and someone who had asked to
 * be left alone kept getting messages.
 *
 * This is the one failure in the inbound path an owner cannot notice and
 * cannot undo. Everything else this codebase gets wrong costs a lead or a
 * confusing screen; this one messages a person who said stop.
 *
 * The fix is ordering, not new machinery: consent is applied before the
 * redelivery guard, and repeating it is a no-op.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { leadUpdate, recordAudit } = vi.hoisted(() => ({
  leadUpdate: vi.fn(async () => ({})),
  recordAudit: vi.fn(),
}));
const { createInboundMessageIfNew } = vi.hoisted(() => ({
  // Every message in this file is a REDELIVERY: already recorded, which
  // is exactly the state that used to skip the opt-out.
  createInboundMessageIfNew: vi.fn(async () => false),
}));
const { acknowledgeNewLead, scoreAndDraftForLead } = vi.hoisted(() => ({
  acknowledgeNewLead: vi.fn(async () => {}),
  scoreAndDraftForLead: vi.fn(async () => {}),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: { update: leadUpdate },
    business: { findUnique: vi.fn(async () => ({ id: "biz1" })) },
  },
}));
vi.mock("@/lib/instagram", () => ({
  createInboundMessageIfNew,
  captureDirectReply: vi.fn(),
}));
vi.mock("@/lib/twilio", () => ({
  findOrCreateLeadByPhone: vi.fn(async () => ({ id: "lead1", name: "Priya", businessId: "biz1" })),
}));
vi.mock("@/lib/conversations", () => ({ findOrCreateConversation: vi.fn(async () => ({ id: "conv1" })) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/inbound/whatsappHistoryFilter", () => ({
  judgeHistoryThread: vi.fn(async () => ({ import: true })),
  knownOnAnotherChannel: vi.fn(async () => false),
}));

import { processWhatsAppCloudEnvelope } from "@/lib/inbound/whatsappCloud";

function envelope(text: string) {
  return {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "waba1",
        changes: [
          {
            field: "messages",
            value: {
              metadata: { phone_number_id: "pn1" },
              contacts: [{ wa_id: "14165550100", profile: { name: "Priya" } }],
              messages: [
                { id: "wamid.redelivered", from: "14165550100", timestamp: "1789000000", type: "text", text: { body: text } },
              ],
            },
          },
        ],
      },
    ],
  };
}

beforeEach(() => {
  leadUpdate.mockClear();
  recordAudit.mockClear();
  acknowledgeNewLead.mockClear();
  scoreAndDraftForLead.mockClear();
  createInboundMessageIfNew.mockClear().mockResolvedValue(false);
});

describe("a STOP that Meta redelivers", () => {
  it("still opts the person out, even though the message was already recorded", async () => {
    await processWhatsAppCloudEnvelope(envelope("STOP"));
    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "lead1" },
        data: expect.objectContaining({ optedOutAt: expect.any(Date) }),
      })
    );
  });

  it("records it in the audit trail like any other opt-out", async () => {
    await processWhatsAppCloudEnvelope(envelope("STOP"));
    expect(recordAudit).toHaveBeenCalledWith(expect.anything(), "lead.opt_out", expect.anything());
  });

  // The guard still does its job for everything downstream — the point of
  // the fix is that consent moved above it, not that it went away.
  it("does not acknowledge or re-score the redelivered message", async () => {
    await processWhatsAppCloudEnvelope(envelope("STOP"));
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
  });

  it("leaves an ordinary redelivered message alone", async () => {
    await processWhatsAppCloudEnvelope(envelope("is tomorrow still ok?"));
    expect(leadUpdate).not.toHaveBeenCalled();
    expect(acknowledgeNewLead).not.toHaveBeenCalled();
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
  });

  it("lets a redelivered START put them back too", async () => {
    await processWhatsAppCloudEnvelope(envelope("START"));
    expect(leadUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ optedOutAt: null }) })
    );
  });
});
