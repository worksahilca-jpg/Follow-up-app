/**
 * /api/business/tell/read — FollowUp reads the owner's own website and Instagram posts (A-328). Admins only, limited
 * per hour and day and counted toward the AI ceiling, a bad link refused before anything is fetched, only word-for-word
 * values for the meeting's own questions kept, and nothing but counts in the audit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({ prisma: { business: { update: vi.fn(), findUnique: vi.fn() } } }));
vi.mock("@/lib/session", () => ({ getSessionContext: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions: vi.fn() }));
vi.mock("@/lib/scoring", () => ({ AI_RUNS_PER_BUSINESS_PER_DAY: { windowMinutes: 1440, max: 500 } }));
vi.mock("@/lib/integrations/openai", () => ({ proposeTellRead: vi.fn() }));
vi.mock("@/lib/tellFollowUpData", () => ({
  addToDraft: vi.fn(),
  loadTellState: vi.fn(),
  tellPlayback: vi.fn(async () => null),
  wordedTopic: vi.fn(async (_b: string, t: unknown) => t),
}));
vi.mock("@/lib/siteReadData", () => ({ readWebsite: vi.fn(), readInstagramPosts: vi.fn() }));

import { prisma } from "@/lib/db";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { recordAudit } from "@/lib/audit";
import { tooManyRecentActions } from "@/lib/rateLimit";
import { proposeTellRead } from "@/lib/integrations/openai";
import { addToDraft, loadTellState, wordedTopic } from "@/lib/tellFollowUpData";
import { readInstagramPosts, readWebsite } from "@/lib/siteReadData";
import { tellState } from "@/lib/tellFollowUp";
import { POST } from "@/app/api/business/tell/read/route";

const m = (f: unknown) => f as ReturnType<typeof vi.fn>;
const call = (body: unknown) =>
  POST(new NextRequest("http://localhost/api/business/tell/read", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }));

const SITE = "Bright Web Studio\nWeb design for small businesses\nSites start at $950 for 5 pages\nWeekdays 10 am to 7 pm\nThanks @maria for the review";
const fresh = tellState("Other", [], [], false, []);
const labels = fresh.topics.map((t) => t.label);
const label = (start: string) => labels.find((l) => l.startsWith(start))!;

beforeEach(() => {
  vi.clearAllMocks();
  m(getSessionContext).mockResolvedValue({ businessId: "biz1", userId: "u1" });
  m(requireAdmin).mockResolvedValue(true);
  m(tooManyRecentActions).mockResolvedValue(false);
  m(loadTellState).mockResolvedValue(fresh);
  m(readWebsite).mockResolvedValue({ pages: ["https://mysite.ca/", "https://mysite.ca/pricing"], text: SITE });
  m(readInstagramPosts).mockResolvedValue(null);
  m(prisma.business.findUnique).mockResolvedValue({ tellDraft: null });
  m(proposeTellRead).mockResolvedValue([
    { label: label("Prices"), value: "Sites start at $950 for 5 pages" },
    { label: label("Hours"), value: "Weekdays 10 am to 7 pm" },
    // Not on the page word for word: dropped.
    { label: label("What you do"), value: "We build beautiful websites" },
    // Names someone: dropped.
    { label: label("Who you work with"), value: "Thanks @maria for the review" },
    // Not one of the meeting's questions: dropped.
    { label: "Favourite colour", value: "Bright Web Studio" },
  ]);
});

describe("who may read", () => {
  it("refuses when signed out, and when not an admin, before reading anything", async () => {
    m(getSessionContext).mockResolvedValue(null);
    expect((await call({ action: "read", url: "mysite.ca" })).status).toBe(401);
    m(getSessionContext).mockResolvedValue({ businessId: "biz1", userId: "u1" });
    m(requireAdmin).mockResolvedValue(false);
    expect((await call({ action: "read", url: "mysite.ca" })).status).toBe(403);
    expect(readWebsite).not.toHaveBeenCalled();
    expect(proposeTellRead).not.toHaveBeenCalled();
  });
});

describe("before anything is fetched", () => {
  it("refuses what isn't a web address", async () => {
    for (const url of ["my site", "localhost", "file:///etc/passwd", "javascript:alert(1)"]) {
      expect((await call({ action: "read", url })).status).toBe(400);
    }
    expect(readWebsite).not.toHaveBeenCalled();
  });

  it("stops at the hourly, daily and AI limits", async () => {
    m(tooManyRecentActions).mockResolvedValueOnce(true);
    expect((await call({ action: "read", url: "mysite.ca" })).status).toBe(429);
    m(tooManyRecentActions).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect((await call({ action: "read", url: "mysite.ca" })).status).toBe(429);
    m(tooManyRecentActions).mockResolvedValueOnce(false).mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    expect((await call({ action: "read", url: "mysite.ca" })).status).toBe(429);
    expect(readWebsite).not.toHaveBeenCalled();
    expect(m(tooManyRecentActions).mock.calls.map((c) => c[1])).toEqual([
      "business.tell.read",
      "business.tell.read",
      "business.tell.read.day",
      "business.tell.read",
      "business.tell.read.day",
      "ai.run",
    ]);
  });
});

describe("reading", () => {
  it("keeps only word-for-word values for the meeting's questions, with where each came from", async () => {
    const res = await call({ action: "read", url: "mysite.ca" });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(readWebsite).toHaveBeenCalledWith("https://mysite.ca/");
    expect(readInstagramPosts).not.toHaveBeenCalled();
    const [businessId, rows, talk, note] = m(addToDraft).mock.calls[0];
    expect(businessId).toBe("biz1");
    expect(talk).toBeUndefined();
    expect(rows).toEqual([
      { label: label("Prices"), value: "Sites start at $950 for 5 pages" },
      { label: label("Hours"), value: "Weekdays 10 am to 7 pm" },
    ]);
    expect(note.url).toBe("https://mysite.ca/");
    expect(Object.values(note.from)).toEqual(["website", "website"]);
    expect(prisma.business.update).toHaveBeenCalledWith({ where: { id: "biz1" }, data: { websiteAskedAt: expect.any(Date), website: "https://mysite.ca/" } });
    expect(data.found).toBe(2);
    expect(data.line).toContain("Read 2 pages of mysite.ca.");
  });

  it("audits counts only, never the site's words", async () => {
    await call({ action: "read", url: "mysite.ca" });
    const meta = m(recordAudit).mock.calls[0][2].meta;
    expect(meta).toEqual({ decision: "read", pages: 2, posts: 0, facts: 2 });
    expect(JSON.stringify(m(recordAudit).mock.calls)).not.toContain("$950");
  });

  it("asks only the meeting's still-open questions", async () => {
    await call({ action: "read", url: "mysite.ca" });
    expect(m(proposeTellRead).mock.calls[0][3]).toEqual(labels);
  });

  it("says so, and saves nothing, when the site can't be opened", async () => {
    m(readWebsite).mockResolvedValue(null);
    const res = await call({ action: "read", url: "mysite.ca" });
    expect(res.status).toBe(422);
    expect((await res.json()).message).toContain("couldn't open that website");
    expect(addToDraft).not.toHaveBeenCalled();
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it("says so, and saves nothing, when the reading itself fails", async () => {
    m(proposeTellRead).mockResolvedValue(null);
    const res = await call({ action: "read", url: "mysite.ca" });
    expect(res.status).toBe(503);
    expect(addToDraft).not.toHaveBeenCalled();
    expect(prisma.business.update).not.toHaveBeenCalled();
  });

  it("reads Instagram alone when asked and says the link didn't open", async () => {
    m(readWebsite).mockResolvedValue(null);
    m(readInstagramPosts).mockResolvedValue({ posts: 12, text: "Weekdays 10 am to 7 pm" });
    m(proposeTellRead).mockResolvedValue([{ label: label("Hours"), value: "Weekdays 10 am to 7 pm" }]);
    const res = await call({ action: "read", url: "mysite.ca", instagram: true });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(readInstagramPosts).toHaveBeenCalledWith("biz1");
    expect(m(addToDraft).mock.calls[0][3]).toMatchObject({ url: null, posts: 12, from: { hours: "instagram" } });
    expect(data.line).toMatch(/^FollowUp couldn't open mysite\.ca\. Read your last 12 Instagram posts\./);
    // The site wasn't read, so it isn't kept as the business's website.
    expect(prisma.business.update).toHaveBeenCalledWith({ where: { id: "biz1" }, data: { websiteAskedAt: expect.any(Date) } });
  });

  it("from setup: no next question worded, setup's own line and wording", async () => {
    const res = await call({ action: "read", url: "mysite.ca", setup: true });
    const data = await res.json();
    expect(wordedTopic).not.toHaveBeenCalled();
    expect(data.line).toContain("That's 2 questions FollowUp won't need to ask you.");
    m(readWebsite).mockResolvedValue(null);
    expect((await (await call({ action: "read", url: "mysite.ca", setup: true })).json()).message).toContain("or leave it");
  });
});

describe("No website, skip this", () => {
  it("is asked once: marks it asked and reads nothing", async () => {
    const res = await call({ action: "skip" });
    expect(res.status).toBe(200);
    expect(prisma.business.update).toHaveBeenCalledWith({ where: { id: "biz1" }, data: { websiteAskedAt: expect.any(Date) } });
    expect(readWebsite).not.toHaveBeenCalled();
  });
});
