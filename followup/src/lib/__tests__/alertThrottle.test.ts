/**
 * The alert channel has to stay worth reading.
 *
 * 2026-09-19, the founder: "there is a server error message popping up
 * every minute in the Slack follow-up alert." The two Meta webhook URLs
 * are public and named in Meta's own console, so they take ordinary
 * internet background traffic, and every single request used to post its
 * own red siren. An alert channel that cries wolf is worse than none:
 * the real one arrives and nobody looks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { captureMessage } = vi.hoisted(() => ({ captureMessage: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureMessage }));

/**
 * The throttle's memory is module-level, which is the point of it — so
 * each test takes a FRESH copy of the module rather than sharing one.
 * Without this, test order decides the result: the second test to use a
 * given kind is already inside the first one's window.
 *
 * Deliberately not solved by exporting a reset from monitoring.ts. A
 * test-only door into production state is a thing that gets called in
 * production eventually.
 */
async function freshRecordAuthFailure() {
  vi.resetModules();
  return (await import("@/lib/monitoring")).recordAuthFailure;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("auth-failure alerting", () => {
  it("reports the first one immediately — a real attempt is never delayed", async () => {
    const record = await freshRecordAuthFailure();
    record("twilio_signature");
    expect(captureMessage).toHaveBeenCalledTimes(1);
  });

  it("swallows a flood of the same kind inside the window", async () => {
    const record = await freshRecordAuthFailure();
    for (let i = 0; i < 50; i++) record("meta_webhook_verify");
    expect(captureMessage).toHaveBeenCalledTimes(1);
  });

  // Throttling must not hide a spike, only stop it arriving one message
  // at a time — so the next report carries what was swallowed.
  it("reports again after the window, carrying the suppressed count", async () => {
    const record = await freshRecordAuthFailure();
    for (let i = 0; i < 12; i++) record("meta_webhook_verify");
    expect(captureMessage).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(11 * 60_000);
    record("meta_webhook_verify");

    expect(captureMessage).toHaveBeenCalledTimes(2);
    const second = captureMessage.mock.calls[1][1] as { extra: Record<string, string> };
    expect(second.extra.suppressedSinceLastReport).toBe("11");
  });

  // One noisy kind must never mask a different, possibly worse one.
  it("throttles each kind on its own clock", async () => {
    const record = await freshRecordAuthFailure();
    record("meta_webhook_verify");
    record("meta_webhook_verify");
    record("cron_secret");
    record("gmail_push_secret");

    expect(captureMessage).toHaveBeenCalledTimes(3);
  });
});
