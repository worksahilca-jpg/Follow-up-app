/**
 * "How did it go?" (A-263): the door for the one tap on Today. Signed in
 * only, one of the four answers or an undo, business-scoped through the
 * data layer, and nothing sent from here.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { getSessionContext, recordMeetingOutcome, undoMeetingOutcome, tooManyRecentActions } = vi.hoisted(() => ({
  getSessionContext: vi.fn(),
  recordMeetingOutcome: vi.fn(async () => ({ success: true, note: null })),
  undoMeetingOutcome: vi.fn(async () => ({ success: true })),
  tooManyRecentActions: vi.fn(async () => false),
}));
vi.mock("@/lib/session", () => ({ getSessionContext }));
vi.mock("@/lib/meetingOutcomeData", () => ({ recordMeetingOutcome, undoMeetingOutcome }));
vi.mock("@/lib/rateLimit", () => ({ tooManyRecentActions }));

import { POST } from "@/app/api/leads/[id]/meeting/route";
import type { NextRequest } from "next/server";

const params = Promise.resolve({ id: "lead1" });
const call = (body: unknown) =>
  POST(new Request("http://localhost/api/leads/lead1/meeting", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }) as unknown as NextRequest, { params });

beforeEach(() => {
  vi.clearAllMocks();
  getSessionContext.mockResolvedValue({ businessId: "biz1", userId: "u1" });
  tooManyRecentActions.mockResolvedValue(false);
});

describe("POST /api/leads/[id]/meeting", () => {
  it("refuses a stranger", async () => {
    getSessionContext.mockResolvedValue(null);
    expect((await call({ bookingId: "bk1", outcome: "working" })).status).toBe(401);
    expect(recordMeetingOutcome).not.toHaveBeenCalled();
  });

  it("records one of the four answers for this business", async () => {
    const res = await call({ bookingId: "bk1", outcome: "deciding" });
    expect(res.status).toBe(200);
    expect(recordMeetingOutcome).toHaveBeenCalledWith("lead1", "biz1", "u1", "bk1", "deciding");
  });

  it("refuses an answer it doesn't know, and a tap with no answer", async () => {
    expect((await call({ bookingId: "bk1", outcome: "ghosted" })).status).toBe(400);
    expect((await call({ bookingId: "bk1" })).status).toBe(400);
    expect(recordMeetingOutcome).not.toHaveBeenCalled();
  });

  it("undoes", async () => {
    expect((await call({ bookingId: "bk1", undo: true })).status).toBe(200);
    expect(undoMeetingOutcome).toHaveBeenCalledWith("lead1", "biz1", "u1", "bk1");
  });

  it("says 404 for someone else's customer, and slows a flood", async () => {
    recordMeetingOutcome.mockResolvedValueOnce({ success: false, message: "Lead not found." } as never);
    expect((await call({ bookingId: "bk1", outcome: "working" })).status).toBe(404);
    tooManyRecentActions.mockResolvedValue(true);
    expect((await call({ bookingId: "bk1", outcome: "working" })).status).toBe(429);
  });
});
