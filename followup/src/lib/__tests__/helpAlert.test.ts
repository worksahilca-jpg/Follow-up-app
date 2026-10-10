/**
 * A tester's Help message reaches the founder at once (founder, 2026-10-10:
 * "Yes, buzz me"). These check the words he gets: who wrote, what they
 * wrote, and where to reply; nothing in them can break the email's markup.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const sendAlertEmail = vi.fn(async () => ({ sent: true as const }));
const sendPushToUser = vi.fn(async () => ({ delivered: 1, removed: 0, failed: 0 }));
const notifySlack = vi.fn(async () => {});
const findMany = vi.fn(async () => [{ id: "u-founder" }]);
vi.mock("@/lib/alertEmail", () => ({ sendAlertEmail }));
vi.mock("@/lib/webPush", () => ({ sendPushToUser }));
vi.mock("@/lib/slack", () => ({ notifySlack }));
vi.mock("@/lib/db", () => ({ prisma: { user: { findMany } } }));

const msg = { id: "fb1", message: "The <b>Send</b> button does nothing & I'm stuck", fromEmail: "owner@example.com", fromName: "Pat", businessName: "Maple Realty" };

describe("Help reaches the founder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("says who wrote, what they wrote, and where to reply", async () => {
    const { helpAlertText } = await import("@/lib/helpAlert");
    const w = helpAlertText(msg);
    expect(w.subject).toBe("Help from Pat (Maple Realty)");
    expect(w.text).toContain(msg.message);
    expect(w.text).toContain("Reply to: owner@example.com");
    expect(w.html).toContain("&lt;b&gt;Send&lt;/b&gt;");
    expect(w.html).not.toContain("<b>Send</b>");
  });

  it("keeps the buzz to one short line", async () => {
    const { helpAlertText } = await import("@/lib/helpAlert");
    const long = helpAlertText({ ...msg, message: "x".repeat(300) });
    expect(long.push.length).toBeLessThanOrEqual(108);
    expect(long.push.endsWith("…")).toBe(true);
  });

  it("emails and buzzes every founder, once per message", async () => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "a@x.com, b@x.com");
    const { tellFounderAboutHelp } = await import("@/lib/helpAlert");
    await tellFounderAboutHelp(msg);
    expect(sendAlertEmail).toHaveBeenCalledTimes(2);
    expect(sendAlertEmail.mock.calls.map((c) => (c as unknown as [{ idempotencyKey: string }])[0].idempotencyKey)).toEqual(["help:fb1:a@x.com", "help:fb1:b@x.com"]);
    expect(sendPushToUser).toHaveBeenCalledWith("u-founder", expect.objectContaining({ tag: "help-fb1" }));
    expect(notifySlack).toHaveBeenCalledTimes(1);
  });

  it("does nothing when no founder is set", async () => {
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "");
    const { tellFounderAboutHelp } = await import("@/lib/helpAlert");
    await tellFounderAboutHelp(msg);
    expect(sendAlertEmail).not.toHaveBeenCalled();
    expect(sendPushToUser).not.toHaveBeenCalled();
  });
});
