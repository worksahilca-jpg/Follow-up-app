/**
 * /api/business/calendar (A-305): which calendar the owner books in. Admin only; a calendar FollowUp can book into
 * sets where customers book at once, any other leaves that to the owner; "Not now" isn't asked again on Today.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const { getSessionContext, requireAdmin } = vi.hoisted(() => ({ getSessionContext: vi.fn(), requireAdmin: vi.fn() }));
vi.mock("@/lib/session", () => ({ getSessionContext, requireAdmin }));
const { tooManyRecentActions } = vi.hoisted(() => ({ tooManyRecentActions: vi.fn() }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));
const { recordAudit } = vi.hoisted(() => ({ recordAudit: vi.fn<(ctx: unknown, action: string, details: { meta?: unknown }) => Promise<boolean>>(async () => true) }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
const { getGmailStatus } = vi.hoisted(() => ({ getGmailStatus: vi.fn() }));
vi.mock("@/lib/integrations/gmail", () => ({ getGmailStatus }));
const { prismaMock } = vi.hoisted(() => ({ prismaMock: { business: { findUnique: vi.fn(), update: vi.fn() } } }));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));

import { POST } from "../route";
import { CALENDAR_LABEL } from "@/lib/calendarUsed";

const req = (body: unknown) =>
  new NextRequest("http://localhost/api/business/calendar", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } });

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  requireAdmin.mockResolvedValue(true);
  tooManyRecentActions.mockResolvedValue(false);
  getGmailStatus.mockResolvedValue({ connected: true });
  prismaMock.business.findUnique.mockResolvedValue({ calendarUsed: null, questionsSkipped: [], bookingCalendarSource: "followup" });
  prismaMock.business.update.mockResolvedValue({});
});

const saved = () => prismaMock.business.update.mock.calls[0][0].data;

describe("an answer", () => {
  it("Google Calendar with Gmail connected: customers book into it", async () => {
    const body = await (await POST(req({ calendar: "google" }))).json();
    expect(body).toMatchObject({ success: true, outcome: "google", bookingCalendarSource: "google", label: "Google Calendar" });
    expect(saved()).toMatchObject({ calendarUsed: "google", bookingCalendarSource: "google" });
    expect(saved().questionAfter.getTime()).toBeGreaterThan(Date.now());
    expect(recordAudit.mock.calls[0][1]).toBe("business.calendar");
    expect(recordAudit.mock.calls[0][2].meta).toEqual({ calendar: "google", outcome: "google" });
  });

  it("Google Calendar without Gmail: noted, and where customers book stays as it was", async () => {
    getGmailStatus.mockResolvedValue({ connected: false });
    const body = await (await POST(req({ calendar: "google" }))).json();
    expect(body).toMatchObject({ outcome: "connect_gmail", bookingCalendarSource: "followup" });
    expect(saved()).not.toHaveProperty("bookingCalendarSource");
  });

  it("one FollowUp can't book into yet: noted, and the owner chooses", async () => {
    prismaMock.business.findUnique.mockResolvedValue({ calendarUsed: null, questionsSkipped: [], bookingCalendarSource: "google" });
    const body = await (await POST(req({ calendar: "brokerbay" }))).json();
    expect(body).toMatchObject({ outcome: "choose", label: "BrokerBay", bookingCalendarSource: "google" });
    expect(saved()).toMatchObject({ calendarUsed: "brokerbay" });
    expect(saved()).not.toHaveProperty("bookingCalendarSource");
  });

  it("none: FollowUp's own calendar", async () => {
    const body = await (await POST(req({ calendar: "none" }))).json();
    expect(body).toMatchObject({ outcome: "followup" });
    expect(saved()).toMatchObject({ calendarUsed: "none", bookingCalendarSource: "followup" });
  });

  it("a change from Settings later doesn't push Today's next question back", async () => {
    prismaMock.business.findUnique.mockResolvedValue({ calendarUsed: "brokerbay", questionsSkipped: [], bookingCalendarSource: "followup" });
    await POST(req({ calendar: "showingtime" }));
    expect(saved()).not.toHaveProperty("questionAfter");
  });

  it("only a calendar on the list", async () => {
    expect((await POST(req({ calendar: "Sharepoint" }))).status).toBe(400);
    expect(prismaMock.business.update).not.toHaveBeenCalled();
  });
});

describe("Not now", () => {
  it("isn't asked again on Today, and nothing else changes", async () => {
    const res = await POST(req({ notNow: true }));
    expect(res.status).toBe(200);
    expect(saved().questionsSkipped).toEqual([CALENDAR_LABEL]);
    expect(saved()).not.toHaveProperty("calendarUsed");
    expect(recordAudit.mock.calls[0][2].meta).toEqual({ decision: "not_now" });
  });
});

describe("who may", () => {
  it("only an admin, signed in, within the limit", async () => {
    requireAdmin.mockResolvedValue(false);
    expect((await POST(req({ calendar: "google" }))).status).toBe(403);
    requireAdmin.mockResolvedValue(true);
    tooManyRecentActions.mockResolvedValue(true);
    expect((await POST(req({ calendar: "google" }))).status).toBe(429);
    getSessionContext.mockResolvedValue(null);
    expect((await POST(req({ calendar: "google" }))).status).toBe(401);
    expect(prismaMock.business.update).not.toHaveBeenCalled();
  });
});
