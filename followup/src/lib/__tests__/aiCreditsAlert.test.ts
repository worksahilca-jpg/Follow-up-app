/**
 * The OpenAI account ran out of credit (twice on 2026-10-30, seen only on the test page): the founder hears it by
 * email, a buzz and Slack, at most once every six hours however many calls fail.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { sendAlertEmail, sendPushToUser, notifySlack, prisma } = vi.hoisted(() => ({
  sendAlertEmail: vi.fn(),
  sendPushToUser: vi.fn(),
  notifySlack: vi.fn(),
  prisma: { user: { findMany: vi.fn() } },
}));
vi.mock("@/lib/alertEmail", () => ({ sendAlertEmail }));
vi.mock("@/lib/webPush", () => ({ sendPushToUser }));
vi.mock("@/lib/slack", () => ({ notifySlack }));
vi.mock("@/lib/db", () => ({ prisma }));

import { BILLING_URL, CREDITS_ALERT_EVERY_MS, creditsAlertText, resetCreditsAlert, tellFounderCreditsRanOut } from "@/lib/aiCreditsAlert";
import { isOutOfCreditsError, isRateLimitError } from "@/lib/rateLimitRetry";

const T0 = Date.UTC(2026, 9, 30, 21, 0, 0);

beforeEach(() => {
  vi.clearAllMocks();
  resetCreditsAlert();
  process.env.PLATFORM_ADMIN_EMAILS = "founder@example.com";
  sendAlertEmail.mockResolvedValue({ sent: true });
  sendPushToUser.mockResolvedValue({ delivered: 1, removed: 0, failed: 0 });
  notifySlack.mockResolvedValue(undefined);
  prisma.user.findMany.mockResolvedValue([{ id: "u1" }]);
});

describe("isOutOfCreditsError", () => {
  it("knows OpenAI's no-credit refusal, by code or by its words, and nothing else", () => {
    expect(isOutOfCreditsError({ status: 429, message: "429 You have no credits remaining. Add credits to continue." })).toBe(true);
    expect(isOutOfCreditsError({ status: 429, code: "insufficient_quota", message: "quota" })).toBe(true);
    expect(isOutOfCreditsError({ status: 429, error: { code: "insufficient_quota" } })).toBe(true);
    expect(isOutOfCreditsError({ status: 429, message: "Rate limit reached for requests" })).toBe(false);
    expect(isOutOfCreditsError({ status: 500, message: "no credits remaining" })).toBe(false);
    expect(isOutOfCreditsError(null)).toBe(false);
  });

  it("is never a rate limit worth waiting out", () => {
    expect(isRateLimitError({ status: 429, code: "insufficient_quota" })).toBe(false);
  });
});

describe("tellFounderCreditsRanOut", () => {
  it("emails, buzzes and posts to Slack, with the billing link", async () => {
    await tellFounderCreditsRanOut(T0);
    expect(sendAlertEmail).toHaveBeenCalledTimes(1);
    const email = sendAlertEmail.mock.calls[0][0];
    expect(email).toMatchObject({ to: "founder@example.com", subject: "FollowUp's AI is out of OpenAI credits" });
    expect(email.text).toContain(BILLING_URL);
    expect(email.idempotencyKey).toMatch(/^ai-credits:\d+:founder@example\.com$/);
    expect(sendPushToUser).toHaveBeenCalledWith("u1", expect.objectContaining({ title: "OpenAI credits ran out", url: "/admin/usage" }));
    expect(notifySlack).toHaveBeenCalledTimes(1);
  });

  it("speaks once every six hours however many calls fail", async () => {
    await tellFounderCreditsRanOut(T0);
    await tellFounderCreditsRanOut(T0 + 1000);
    await tellFounderCreditsRanOut(T0 + CREDITS_ALERT_EVERY_MS - 1);
    expect(sendAlertEmail).toHaveBeenCalledTimes(1);
    await tellFounderCreditsRanOut(T0 + CREDITS_ALERT_EVERY_MS);
    expect(sendAlertEmail).toHaveBeenCalledTimes(2);
  });

  it("does nothing when no founder address is set", async () => {
    process.env.PLATFORM_ADMIN_EMAILS = "";
    await tellFounderCreditsRanOut(T0);
    expect(sendAlertEmail).not.toHaveBeenCalled();
    expect(notifySlack).not.toHaveBeenCalled();
  });

  it("still emails when the founders can't be looked up for the buzz", async () => {
    prisma.user.findMany.mockRejectedValue(new Error("db down"));
    await tellFounderCreditsRanOut(T0);
    expect(sendAlertEmail).toHaveBeenCalledTimes(1);
    expect(sendPushToUser).not.toHaveBeenCalled();
  });

  it("says plainly what stops and what to do", () => {
    const words = creditsAlertText();
    expect(words.text).toMatch(/can't write replies or follow-ups/);
    expect(words.text).toMatch(/auto-recharge/);
  });
});
