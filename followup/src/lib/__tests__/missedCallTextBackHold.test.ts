/**
 * The missed-call text-back is an automatic message to a stranger, so it
 * obeys the same hold as every other automated send (security hunt
 * 2026-09-30). Business.holdAllForApproval is on by default and is also
 * what "Pause all sending" turns on (src/lib/sendingControl.ts); while it
 * is on, "every reply waits for your OK". The text-back in
 * POST /api/twilio/voice/[secret] ignored it and texted every missed
 * caller anyway.
 */
import { NextRequest } from "next/server";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUniqueBusiness, updateManyLead } = vi.hoisted(() => ({
  findUniqueBusiness: vi.fn(),
  updateManyLead: vi.fn(async () => ({ count: 1 })),
}));
vi.mock("@/lib/db", () => ({
  prisma: { business: { findUnique: findUniqueBusiness }, lead: { updateMany: updateManyLead } },
}));
vi.mock("@/lib/billing", () => ({ requireActiveBilling: vi.fn(async () => true) }));
vi.mock("@/lib/siteUrl", () => ({ inboundBaseUrl: () => "https://followupbase.io" }));

const { sendSms, claimMissedCallTextBack } = vi.hoisted(() => ({
  sendSms: vi.fn(async () => ({ success: true })),
  claimMissedCallTextBack: vi.fn(async () => true),
}));
vi.mock("@/lib/twilio", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/twilio")>();
  return {
    ...actual,
    findBusinessByTwilioSecret: vi.fn(async () => ({
      id: "biz1",
      name: "Acme Plumbing",
      twilioAuthToken: "tok",
      twilioAccountSid: "AC1",
      voiceAgentEnabled: false,
    })),
    validateTwilioRequestSignature: vi.fn(() => true),
    findOrCreateLeadByPhone: vi.fn(async () => ({ id: "lead1" })),
    claimMissedCallTextBack,
    sendSms,
  };
});

import { POST } from "@/app/api/twilio/voice/[secret]/route";

function call() {
  const req = new NextRequest("https://followupbase.io/api/twilio/voice/sekret", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", "x-twilio-signature": "sig" },
    body: new URLSearchParams({ From: "+15550001111", CallSid: "CA1" }).toString(),
  });
  return POST(req, { params: Promise.resolve({ secret: "sekret" }) } as never);
}

function businessWith(holdAllForApproval: boolean) {
  findUniqueBusiness.mockImplementation(async () => ({ holdAllForApproval }));
}

beforeEach(() => {
  sendSms.mockClear();
  claimMissedCallTextBack.mockClear();
});

describe("missed-call text-back respects the approval hold", () => {
  it("sends nothing to the caller while every reply waits for approval (or sending is paused)", async () => {
    businessWith(true);
    const res = await call();
    expect(res.status).toBe(200);
    expect(sendSms).not.toHaveBeenCalled();
    // Not claimed either, so it isn't marked as done while nothing went out.
    expect(claimMissedCallTextBack).not.toHaveBeenCalled();
    // The caller still reaches voicemail.
    expect(await res.text()).toContain("<Record");
  });

  it("still texts back when the business lets FollowUp send on its own", async () => {
    businessWith(false);
    await call();
    expect(sendSms).toHaveBeenCalledTimes(1);
  });
});
