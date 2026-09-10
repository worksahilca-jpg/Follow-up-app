/**
 * POST /api/twilio/status/[secret] (task #96) — Twilio's StatusCallback
 * for an outbound SMS/WhatsApp send. Verifies the signature gate (same
 * posture as every other Twilio webhook in this family) and that a valid
 * callback records the delivery outcome onto the matching Message row by
 * externalId (the Twilio MessageSid).
 */
import { NextRequest } from "next/server";
import { createHmac } from "crypto";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findUniqueBusiness, updateMany } = vi.hoisted(() => ({
  findUniqueBusiness: vi.fn(),
  updateMany: vi.fn(async () => ({ count: 1 })),
}));
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: findUniqueBusiness }, message: { updateMany } } }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://followupbase.io" }));
const { recordAuthFailure } = vi.hoisted(() => ({ recordAuthFailure: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure }));

import { POST } from "@/app/api/twilio/status/[secret]/route";
import { validateTwilioSignature } from "@/lib/twilio";

function ctx(secret: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { params: Promise.resolve({ secret }) } as any;
}

function formRequest(url: string, form: Record<string, string>, signature?: string) {
  return new NextRequest(url, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      ...(signature ? { "x-twilio-signature": signature } : {}),
    },
    body: new URLSearchParams(form).toString(),
  });
}

const URL_PATH = "https://followupbase.io/api/twilio/status/sekret123";
const AUTH_TOKEN = "auth-token-1";

function sign(form: Record<string, string>) {
  const data =
    URL_PATH +
    Object.keys(form)
      .sort()
      .map((k) => k + form[k])
      .join("");
  return createHmac("sha1", AUTH_TOKEN).update(data, "utf8").digest("base64");
}

beforeEach(() => {
  findUniqueBusiness.mockReset();
  updateMany.mockClear();
  recordAuthFailure.mockClear();
});

describe("POST /api/twilio/status/[secret]", () => {
  it("records the delivery status on a validly-signed callback", async () => {
    findUniqueBusiness.mockResolvedValue({ id: "biz1", twilioAuthToken: AUTH_TOKEN });
    const form = { MessageSid: "SM123", MessageStatus: "delivered" };
    const req = formRequest(URL_PATH, form, sign(form));

    const res = await POST(req, ctx("sekret123"));

    expect(res.status).toBe(200);
    expect(updateMany).toHaveBeenCalledWith({
      where: { externalId: "SM123" },
      data: {
        deliveryStatus: "delivered",
        deliveryErrorCode: null,
        deliveryErrorMessage: null,
        deliveryUpdatedAt: expect.any(Date),
      },
    });
  });

  it("records an error code/message on a failed delivery", async () => {
    findUniqueBusiness.mockResolvedValue({ id: "biz1", twilioAuthToken: AUTH_TOKEN });
    const form = { MessageSid: "SM124", MessageStatus: "undelivered", ErrorCode: "30003", ErrorMessage: "Unreachable" };
    const req = formRequest(URL_PATH, form, sign(form));

    await POST(req, ctx("sekret123"));

    expect(updateMany).toHaveBeenCalledWith({
      where: { externalId: "SM124" },
      data: {
        deliveryStatus: "undelivered",
        deliveryErrorCode: "30003",
        deliveryErrorMessage: "Unreachable",
        deliveryUpdatedAt: expect.any(Date),
      },
    });
  });

  it("rejects a bad signature and does not touch the database", async () => {
    findUniqueBusiness.mockResolvedValue({ id: "biz1", twilioAuthToken: AUTH_TOKEN });
    const form = { MessageSid: "SM125", MessageStatus: "delivered" };
    const req = formRequest(URL_PATH, form, "totally-wrong-signature");

    const res = await POST(req, ctx("sekret123"));

    expect(res.status).toBe(403);
    expect(updateMany).not.toHaveBeenCalled();
    expect(recordAuthFailure).toHaveBeenCalled();
  });

  it("no-ops cleanly for an unknown secret", async () => {
    findUniqueBusiness.mockResolvedValue(null);
    const form = { MessageSid: "SM126", MessageStatus: "delivered" };
    const req = formRequest(URL_PATH, form);

    const res = await POST(req, ctx("unknown"));

    expect(res.status).toBe(200);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("no-ops when the business hasn't saved a Twilio Auth Token yet", async () => {
    findUniqueBusiness.mockResolvedValue({ id: "biz1", twilioAuthToken: null });
    const form = { MessageSid: "SM127", MessageStatus: "delivered" };
    const req = formRequest(URL_PATH, form);

    const res = await POST(req, ctx("sekret123"));

    expect(res.status).toBe(403);
    expect(updateMany).not.toHaveBeenCalled();
  });
});

// Sanity check that the hand-rolled signer above matches the app's own
// validateTwilioSignature — if these ever disagree, every "validly-signed"
// test above would be silently testing nothing.
describe("test signer sanity check", () => {
  it("matches validateTwilioSignature for the same inputs", () => {
    const form = { MessageSid: "SM999", MessageStatus: "sent" };
    const signature = sign(form);
    expect(validateTwilioSignature(AUTH_TOKEN, URL_PATH, form, signature)).toBe(true);
  });
});
