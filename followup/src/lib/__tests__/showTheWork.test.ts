/**
 * "Show the work, not the robot" (A-043): the rewrite and catch-up routes,
 * and the "sent as written" count.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { sessionCtx, getLead, rewrite, summarize, limited, billing, leadFind, leadUpdate, groupBy } = vi.hoisted(() => ({
  sessionCtx: vi.fn(),
  getLead: vi.fn(),
  rewrite: vi.fn(),
  summarize: vi.fn(),
  limited: vi.fn(),
  billing: vi.fn(),
  leadFind: vi.fn(),
  leadUpdate: vi.fn(),
  groupBy: vi.fn(),
}));
vi.mock("@/lib/session", () => ({ getSessionContext: sessionCtx }));
vi.mock("@/lib/leads-data", () => ({ getLeadById: getLead }));
vi.mock("@/lib/integrations/openai", () => ({ rewriteReply: rewrite, summarizeConversation: summarize }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: limited }));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: billing, billingLockedMessage: async () => "Billing is locked." }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findUnique: leadFind, update: leadUpdate }, followUp: { groupBy } } }));

import { POST as rewriteRoute } from "@/app/api/leads/[id]/rewrite/route";
import { GET as catchUpRoute } from "@/app/api/leads/[id]/catch-up/route";
import { sentAsWritten } from "@/lib/showTheWork";

const params = { params: Promise.resolve({ id: "l1" }) };
const msgs = (n: number) => Array.from({ length: n }, (_, i) => ({ id: String(i), direction: "inbound", channel: "email", body: "hi", date: new Date().toISOString() }));
const post = (body: unknown) =>
  rewriteRoute(new NextRequest("https://f.io/api/leads/l1/rewrite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }), params);

beforeEach(() => {
  vi.clearAllMocks();
  sessionCtx.mockResolvedValue({ userId: "u", businessId: "b" });
  limited.mockResolvedValue(false);
  billing.mockResolvedValue(true);
  getLead.mockResolvedValue({ id: "l1", name: "Priya Shah", conversation: msgs(3), languageRead: null });
});

describe("rewrite", () => {
  it("returns the rewritten text and saves nothing", async () => {
    rewrite.mockResolvedValue("Shorter.");
    const res = await post({ text: "A longer reply.", style: "shorter" });
    expect(await res.json()).toEqual({ success: true, text: "Shorter." });
    expect(rewrite).toHaveBeenCalledWith("A longer reply.", "shorter", expect.any(Array), null);
    expect(leadUpdate).not.toHaveBeenCalled();
  });
  it("refuses an unknown style", async () => {
    expect((await post({ text: "x", style: "funnier" })).status).toBe(400);
  });
  it("refuses another business's lead", async () => {
    getLead.mockResolvedValue(undefined);
    expect((await post({ text: "x", style: "warmer" })).status).toBe(404);
  });
  it("keeps the owner's reply when the rewrite fails", async () => {
    rewrite.mockRejectedValue(new Error("down"));
    const res = await post({ text: "x", style: "warmer" });
    expect(res.status).toBe(502);
    expect((await res.json()).message).toMatch(/unchanged/);
  });
});

describe("catching up", () => {
  it("says nothing for a short conversation, without a model call", async () => {
    const res = await catchUpRoute(new Request("https://f.io"), params);
    expect(await res.json()).toEqual({ success: true, text: null, count: 3 });
    expect(summarize).not.toHaveBeenCalled();
  });
  it("uses the cached summary while the conversation hasn't changed", async () => {
    getLead.mockResolvedValue({ id: "l1", name: "Priya", conversation: msgs(9), languageRead: null });
    leadFind.mockResolvedValue({ catchUpText: "Cached.", catchUpCount: 9 });
    expect((await (await catchUpRoute(new Request("https://f.io"), params)).json()).text).toBe("Cached.");
    expect(summarize).not.toHaveBeenCalled();
  });
  it("writes a new summary when new messages arrived", async () => {
    getLead.mockResolvedValue({ id: "l1", name: "Priya", conversation: msgs(10), languageRead: null });
    leadFind.mockResolvedValue({ catchUpText: "Old.", catchUpCount: 9 });
    summarize.mockResolvedValue("New.");
    expect((await (await catchUpRoute(new Request("https://f.io"), params)).json()).text).toBe("New.");
    expect(leadUpdate).toHaveBeenCalledWith({ where: { id: "l1" }, data: { catchUpText: "New.", catchUpCount: 10 } });
  });
});

describe("sentAsWritten", () => {
  it("counts a person's sends of a draft, split by whether they changed it", async () => {
    groupBy.mockResolvedValue([
      { draftEdited: false, _count: { _all: 18 } },
      { draftEdited: true, _count: { _all: 3 } },
    ]);
    expect(await sentAsWritten("b", new Date())).toEqual({ asWritten: 18, total: 21 });
    expect(groupBy.mock.calls[0][0].where).toEqual(expect.objectContaining({ automated: false, status: "sent", draftEdited: { not: null } }));
  });
});
