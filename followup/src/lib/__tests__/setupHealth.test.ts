/**
 * The daily setup check (src/lib/setupHealth.ts). Found live 2026-09-25:
 * owner alert emails were silently off for hours because RESEND_API_KEY
 * was never saved. Nothing was broken, so nothing said anything.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: { ownerAlert: { count: vi.fn() } } }));
vi.mock("@/lib/slack", () => ({ notifySlack: vi.fn(async () => {}) }));
vi.mock("@/lib/alertEmail", () => ({
  isAlertEmailConfigured: vi.fn(() => Boolean(process.env.RESEND_API_KEY)),
  sendAlertEmail: vi.fn(async () => ({ sent: true })),
}));

import { prisma } from "@/lib/db";
import { notifySlack } from "@/lib/slack";
import { sendAlertEmail } from "@/lib/alertEmail";
import { missingRequirements, REQUIREMENTS, runSetupHealth, renderHealthReport } from "@/lib/setupHealth";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const count = (prisma as any).ownerAlert.count as ReturnType<typeof vi.fn>;
const slack = notifySlack as unknown as ReturnType<typeof vi.fn>;
const email = sendAlertEmail as unknown as ReturnType<typeof vi.fn>;

const everyName = REQUIREMENTS.flatMap((r) => r.names);
const allSet = Object.fromEntries(everyName.map((n) => [n, "x"]));

beforeEach(() => {
  vi.clearAllMocks();
  for (const [k, v] of Object.entries(allSet)) vi.stubEnv(k, v);
  vi.stubEnv("SLACK_WEBHOOK_URL", "https://hooks.slack.test/x");
  vi.stubEnv("PLATFORM_ADMIN_EMAILS", "founder@followupbase.io");
  count.mockResolvedValue(0);
});
afterEach(() => vi.unstubAllEnvs());

describe("missingRequirements", () => {
  it("is empty when every key is set", () => {
    expect(missingRequirements(allSet)).toEqual([]);
  });

  it("names the missing key and what stops working — never a value", () => {
    const problems = missingRequirements({ ...allSet, RESEND_API_KEY: "" });
    expect(problems).toEqual([{ what: "Not set: RESEND_API_KEY", breaks: "Owner alert emails" }]);
  });

  it("treats whitespace as missing", () => {
    expect(missingRequirements({ ...allSet, VAPID_PRIVATE_KEY: "  " })[0].what).toBe("Not set: VAPID_PRIVATE_KEY");
  });
});

describe("runSetupHealth", () => {
  it("stays quiet when everything is set and alerts are flowing", async () => {
    const r = await runSetupHealth();
    expect(r).toEqual({ problems: 0, notified: [] });
    expect(slack).not.toHaveBeenCalled();
    expect(email).not.toHaveBeenCalled();
  });

  it("tells Slack and the admins when a key is missing", async () => {
    vi.stubEnv("RESEND_API_KEY", "");
    const r = await runSetupHealth(new Date("2026-09-26T13:07:00Z"));
    expect(r.problems).toBe(1);
    expect(slack.mock.calls[0][0]).toMatch(/Not set: RESEND_API_KEY — affects: Owner alert emails/);
    expect(email).toHaveBeenCalledWith(
      expect.objectContaining({ to: "founder@followupbase.io", idempotencyKey: "setup-health:2026-09-26:founder@followupbase.io" })
    );
  });

  it("catches a key that is set but not working: alerts due, none emailed in a day", async () => {
    count.mockResolvedValueOnce(3).mockResolvedValueOnce(0);
    const r = await runSetupHealth();
    expect(r.problems).toBe(1);
    expect(slack.mock.calls[0][0]).toMatch(/3 alerts due in the last day, 0 emails sent/);
  });

  it("does not cry wolf when alerts went out", async () => {
    count.mockResolvedValueOnce(3).mockResolvedValueOnce(2);
    expect((await runSetupHealth()).problems).toBe(0);
  });
});

it("the report says where to fix it", () => {
  expect(renderHealthReport([{ what: "Not set: X", breaks: "Y" }])).toMatch(/Vercel → follow-up-app → Settings → Environment Variables/);
});
