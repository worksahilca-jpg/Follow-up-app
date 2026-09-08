/**
 * task #87 (third-pass audit): a repeat submission from an email the
 * business already has a lead for used to hit the Lead
 * businessId_email unique constraint, get caught, and just return
 * { success: true } with nothing else happening — the visitor's new
 * message was silently discarded while their browser showed a normal
 * "thanks, we'll be in touch" confirmation. Both the embed widget and the
 * generic Zapier/Make webhook shared this bug; this covers both routes'
 * P2002 branch directly.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUniqueBusiness, findUniqueLead, create, conversationFindFirst, conversationCreate, messageCreate } = vi.hoisted(() => ({
  findUniqueBusiness: vi.fn(),
  findUniqueLead: vi.fn(),
  create: vi.fn(),
  conversationFindFirst: vi.fn(),
  conversationCreate: vi.fn(),
  messageCreate: vi.fn(),
}));
const { scoreAndDraftForLead } = vi.hoisted(() => ({ scoreAndDraftForLead: vi.fn(async () => {}) }));
const { acknowledgeNewLead } = vi.hoisted(() => ({ acknowledgeNewLead: vi.fn(async () => ({ sent: false, reason: "already acknowledged" })) }));

vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: findUniqueBusiness },
    lead: { create, findUnique: findUniqueLead },
    conversation: { findFirst: conversationFindFirst, create: conversationCreate },
    message: { create: messageCreate },
  },
}));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true) }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/scoring", () => ({ scoreAndDraftForLead }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn(async () => {}) }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentLeads: vi.fn(async () => false) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure: vi.fn() }));

const p2002 = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

function ctxBusiness(businessId: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { params: Promise.resolve({ businessId }) } as any;
}
function ctxSecret(secret: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { params: Promise.resolve({ secret }) } as any;
}

function jsonRequest(url: string, body: Record<string, unknown>): NextRequest {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  findUniqueBusiness.mockResolvedValue({ id: "biz1" });
  create.mockRejectedValue(p2002);
  findUniqueLead.mockResolvedValue({ id: "existingLead1" });
  conversationFindFirst.mockResolvedValue(null);
  conversationCreate.mockResolvedValue({ id: "conv1" });
  messageCreate.mockResolvedValue({});
});

describe("POST /api/embed/[businessId]/lead — duplicate-email resubmission", () => {
  it("appends the new message to the existing lead and re-scores, instead of silently discarding it", async () => {
    const { POST } = await import("@/app/api/embed/[businessId]/lead/route");
    const res = await POST(
      jsonRequest("https://followupbase.io/api/embed/biz1/lead", {
        hp: "",
        name: "Jamie",
        email: "jamie@example.com",
        phone: "",
        message: "actually, can you also quote me for the upstairs unit?",
      }),
      ctxBusiness("biz1")
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true });

    expect(findUniqueLead).toHaveBeenCalledWith({ where: { businessId_email: { businessId: "biz1", email: "jamie@example.com" } } });
    expect(messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ conversationId: "conv1", direction: "inbound", body: "actually, can you also quote me for the upstairs unit?" }) })
    );
    expect(scoreAndDraftForLead).toHaveBeenCalledWith("existingLead1");
    expect(acknowledgeNewLead).toHaveBeenCalledWith("existingLead1", expect.objectContaining({ channel: "email" }));
  });

  it("does nothing beyond returning success when the resubmission carries no message", async () => {
    const { POST } = await import("@/app/api/embed/[businessId]/lead/route");
    const res = await POST(
      jsonRequest("https://followupbase.io/api/embed/biz1/lead", { hp: "", name: "Jamie", email: "jamie@example.com", phone: "", message: "" }),
      ctxBusiness("biz1")
    );
    expect(res.status).toBe(200);
    expect(messageCreate).not.toHaveBeenCalled();
    expect(scoreAndDraftForLead).not.toHaveBeenCalled();
  });
});

describe("POST /api/webhooks/lead/[secret] — duplicate-email resubmission", () => {
  beforeEach(() => {
    findUniqueBusiness.mockResolvedValue({ id: "biz1", webhookSecret: "sec_123" });
  });

  it("appends the new message to the existing lead and returns its id, instead of silently discarding it", async () => {
    const { POST } = await import("@/app/api/webhooks/lead/[secret]/route");
    const res = await POST(
      jsonRequest("https://followupbase.io/api/webhooks/lead/sec_123", {
        name: "Jamie",
        email: "jamie@example.com",
        phone: "",
        message: "edited response: also interested in financing",
      }),
      ctxSecret("sec_123")
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ success: true, leadId: "existingLead1" });
    expect(messageCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ body: "edited response: also interested in financing" }) })
    );
    expect(scoreAndDraftForLead).toHaveBeenCalledWith("existingLead1");
  });
});
