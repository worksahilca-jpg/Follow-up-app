/**
 * Reply truth (audit 2026-09-28): the owner approves a reactivation batch
 * having read three drafts. The other forty went out with no check of any
 * kind. A draft that invents something is now held for the owner instead.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const generateFollowUpMessage = vi.fn();
vi.mock("@/lib/integrations/openai", () => ({
  generateFollowUpMessage: (...a: unknown[]) => generateFollowUpMessage(...a),
}));

const sendFollowUpToLead = vi.fn();
vi.mock("@/lib/sending", () => ({
  sendFollowUpToLead: (...a: unknown[]) => sendFollowUpToLead(...a),
}));

vi.mock("@/lib/sender", () => ({
  composeFollowUpEmail: async (_n: string, _b: string, body: string) => `Hi,\n\n${body}\n\nThanks`,
  latestInboundText: () => "",
}));

vi.mock("@/lib/voice", () => ({ getVoiceSamples: async () => [] }));

const checkSendCap = vi.fn();
vi.mock("@/lib/sendCaps", () => ({
  checkSendCap: (...a: unknown[]) => checkSendCap(...a),
}));

const leadFindFirst = vi.fn();
const leadUpdateMany = vi.fn();
const leadUpdate = vi.fn();
const leadCount = vi.fn();
const runFindFirst = vi.fn();
const runFindUnique = vi.fn();
const runCreate = vi.fn();
const runUpdate = vi.fn();
const runUpdateMany = vi.fn();
const automationFindFirst = vi.fn();
const auditCreate = vi.fn();

vi.mock("@/lib/db", () => ({
  prisma: {
    lead: {
      findFirst: (...a: unknown[]) => leadFindFirst(...a),
      findMany: vi.fn(),
      updateMany: (...a: unknown[]) => leadUpdateMany(...a),
      update: (...a: unknown[]) => leadUpdate(...a),
      count: (...a: unknown[]) => leadCount(...a),
    },
    reactivationRun: {
      findFirst: (...a: unknown[]) => runFindFirst(...a),
      findUnique: (...a: unknown[]) => runFindUnique(...a),
      create: (...a: unknown[]) => runCreate(...a),
      update: (...a: unknown[]) => runUpdate(...a),
      updateMany: (...a: unknown[]) => runUpdateMany(...a),
    },
    business: { findUnique: vi.fn() },
    automation: { findFirst: (...a: unknown[]) => automationFindFirst(...a) },
    auditEvent: { create: (...a: unknown[]) => auditCreate(...a) },
  },
}));

import { runReactivationSend } from "@/lib/reactivationSend";

function coldLead(id: string) {
  return {
    id,
    name: "Ana Reyes",
    businessId: "biz-1",
    lastContacted: new Date("2026-06-01T10:00:00.000Z"),
    createdAt: new Date("2026-05-01T10:00:00.000Z"),
    quietOutcomeReason: "Quote was never answered.",
    conversations: [
      {
        channel: "email",
        messages: [
          { id: "m1", direction: "inbound", body: "What would a refit cost?", sentAt: new Date("2026-06-01T09:00:00.000Z"), opened: false },
          { id: "m2", direction: "outbound", body: "About $12k.", sentAt: new Date("2026-06-01T10:00:00.000Z"), opened: false },
        ],
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  automationFindFirst.mockResolvedValue(null);
  generateFollowUpMessage.mockResolvedValue({ subject: "Your kitchen quote", body: "Still thinking it over?" });
  sendFollowUpToLead.mockResolvedValue({ success: true });
  leadUpdateMany.mockResolvedValue({ count: 1 });
  runUpdate.mockResolvedValue({});
  runUpdateMany.mockResolvedValue({ count: 1 });
  leadCount.mockResolvedValue(0);
  checkSendCap.mockResolvedValue({ allowed: true, used: 0, cap: 250 });
});

describe("a reactivation draft nobody read", () => {
  it("is held, not sent, when it tells the customer something only the owner knows", async () => {
    runFindFirst.mockResolvedValue({ id: "run-1", status: "RUNNING", sent: 0, failed: 0, skipped: 0 });
    let checks = 0;
    runFindUnique.mockImplementation(async () => ({ status: ++checks <= 1 ? "RUNNING" : "STOPPED" }));
    leadFindFirst.mockResolvedValue(coldLead("lead-1"));
    leadUpdate.mockResolvedValue({});
    auditCreate.mockResolvedValue({});
    generateFollowUpMessage.mockResolvedValue({
      subject: "Your kitchen refit",
      body: "It's been a few months since you asked about the refit. Good news, we're still able to fit you in before the holidays, and the design visit is free.",
    });

    const result = await runReactivationSend("biz-1", "run-1", { spacingMs: 0 });

    expect(sendFollowUpToLead).not.toHaveBeenCalled();
    expect(result.skipped).toBe(1);
    expect(leadUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ suggestedDraftKind: "reactivation" }) }));
  });

  it("still sends an ordinary draft", async () => {
    runFindFirst.mockResolvedValue({ id: "run-1", status: "RUNNING", sent: 0, failed: 0, skipped: 0 });
    let checks = 0;
    runFindUnique.mockImplementation(async () => ({ status: ++checks <= 1 ? "RUNNING" : "STOPPED" }));
    leadFindFirst.mockResolvedValue(coldLead("lead-1"));
    const result = await runReactivationSend("biz-1", "run-1", { spacingMs: 0 });
    expect(sendFollowUpToLead).toHaveBeenCalledTimes(1);
    expect(result.sent).toBe(1);
  });
});
