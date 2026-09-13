/**
 * notifySlack() (src/lib/slack.ts) — the shared team-Slack echo used by
 * a lead going hot (scoring.ts) and a server error being reported
 * (sentry.server.config.ts). Both call sites fire this without awaiting
 * or checking a return value, so the properties that matter are: it
 * never throws, it no-ops cleanly without config, and it doesn't let a
 * burst of calls flood the channel or blow through Slack's own rate
 * limit.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("notifySlack", () => {
  const ORIGINAL_ENV = process.env.SLACK_WEBHOOK_URL;

  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    process.env.SLACK_WEBHOOK_URL = ORIGINAL_ENV;
  });

  it("is a safe no-op (no network call) when SLACK_WEBHOOK_URL isn't set", async () => {
    delete process.env.SLACK_WEBHOOK_URL;
    const fetchSpy = vi.spyOn(global, "fetch");
    const { notifySlack } = await import("@/lib/slack");
    await expect(notifySlack("hello")).resolves.toBeUndefined();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("posts the message as JSON to the configured webhook", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/T000/B000/xyz";
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const { notifySlack } = await import("@/lib/slack");
    await notifySlack("🔥 a hot lead");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://hooks.slack.com/services/T000/B000/xyz",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ "Content-Type": "application/json" }),
        body: JSON.stringify({ text: "🔥 a hot lead" }),
      })
    );
  });

  it("never throws when the webhook call fails", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/T000/B000/xyz";
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { notifySlack } = await import("@/lib/slack");
    await expect(notifySlack("hello")).resolves.toBeUndefined();
  });

  it("stops sending once the rate limit is hit within the window", async () => {
    process.env.SLACK_WEBHOOK_URL = "https://hooks.slack.com/services/T000/B000/xyz";
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 200 }));
    const { notifySlack } = await import("@/lib/slack");
    for (let i = 0; i < 10; i++) {
      await notifySlack(`message ${i}`);
    }
    // 5 allowed through, the rest silently dropped — a burst (e.g. an
    // error loop) must never turn into 10 Slack messages.
    expect(fetchSpy).toHaveBeenCalledTimes(5);
  });
});
