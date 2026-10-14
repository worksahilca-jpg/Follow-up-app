/**
 * The daily stuck-testers email (founder, 2026-10-10: "Yes, build it"):
 * quiet when nobody is stuck, names only the last two weeks, and never
 * lets a tester's typed name or business break the email's HTML. Since
 * 2026-10-14 (A-249) it also names testers who stalled after a first reply.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const { loadActivation, loadStopped, sendAlertEmail, reportCronFailure } = vi.hoisted(() => ({
  loadActivation: vi.fn(),
  loadStopped: vi.fn(),
  sendAlertEmail: vi.fn(),
  reportCronFailure: vi.fn(),
}));
vi.mock("@/lib/activation-data", () => ({ loadActivation, loadStopped }));
vi.mock("@/lib/alertEmail", () => ({ sendAlertEmail }));
vi.mock("@/lib/monitoring", () => ({ reportCronFailure }));

import { stuckTestersEmail, sendStuckTesters } from "@/lib/stuckTesters";
import type { StoppedTester, StuckTester } from "@/lib/activation";

const t = (over: Partial<StuckTester>): StuckTester => ({
  id: "t1",
  name: "Asha",
  email: "asha@example.com",
  business: "Asha Homes",
  lastStep: "Signed in",
  reason: "Hasn’t connected anything yet.",
  days: 2,
  ...over,
});

const s = (over: Partial<StoppedTester>): StoppedTester => ({
  id: "s1",
  name: "Cara",
  email: "cara@example.com",
  business: "Cara Realty",
  reason: "17 replies are waiting for an OK, the oldest for 9 days. Gmail or Outlook is disconnected. Last opened FollowUp 9 days ago.",
  quietDays: 9,
  ...over,
});

describe("the stuck-testers email", () => {
  it("says nothing when nobody is stuck", () => {
    expect(stuckTestersEmail([], "https://followupbase.io")).toBeNull();
  });

  it("names each tester with where they stopped, how long, and where to write", () => {
    const e = stuckTestersEmail([t({}), t({ id: "t2", name: "Ben", business: null, days: 1, reason: "Hasn’t signed in yet." })], "https://followupbase.io")!;
    expect(e.subject).toBe("2 testers are stuck");
    expect(e.named).toBe(2);
    expect(e.text).toContain("• Asha (Asha Homes): Hasn’t connected anything yet. For 2 days. Write to: asha@example.com");
    expect(e.text).toContain("• Ben: Hasn’t signed in yet. For 1 day.");
    expect(e.text).toContain("Everyone is on https://followupbase.io/admin");
  });

  it("counts, but doesn't name, testers stuck over two weeks; alone they send nothing", () => {
    const e = stuckTestersEmail([t({}), t({ id: "t2", days: 30 }), t({ id: "t3", days: 15 })], "https://x.io")!;
    expect(e.subject).toBe("1 tester is stuck");
    expect(e.text).toContain("2 more have been stuck for over two weeks.");
    expect(stuckTestersEmail([t({ days: 40 })], "https://x.io")).toBeNull();
  });

  it("escapes what testers typed", () => {
    const e = stuckTestersEmail([t({ name: "<b>Eve</b>", business: "A & B" })], "https://x.io")!;
    expect(e.html).toContain("&lt;b&gt;Eve&lt;/b&gt; (A &amp; B)");
    expect(e.html).not.toContain("<b>Eve</b>");
  });
});

describe("testers who stalled after a first reply (A-249)", () => {
  it("names them under their own line, after the stuck ones, and counts them in the subject", () => {
    const e = stuckTestersEmail([t({})], "https://followupbase.io", [s({})])!;
    expect(e.subject).toBe("2 testers are stuck");
    expect(e.named).toBe(2);
    expect(e.text).toContain("This tester sent replies before, but now customers are waiting or the inbox needs reconnecting.");
    expect(e.text).toContain(
      "• Cara (Cara Realty): 17 replies are waiting for an OK, the oldest for 9 days. Gmail or Outlook is disconnected. Last opened FollowUp 9 days ago. Write to: cara@example.com"
    );
    expect(e.text.indexOf("• Asha")).toBeLessThan(e.text.indexOf("• Cara"));
    expect(e.html).toContain('<a href="mailto:cara@example.com">cara@example.com</a>');
  });

  it("sends for them alone, without the first-reply sentence", () => {
    const e = stuckTestersEmail([], "https://x.io", [s({}), s({ id: "s2", name: "Dev", email: "dev@example.com", business: null, quietDays: null, reason: "Gmail or Outlook is disconnected." })])!;
    expect(e.subject).toBe("2 testers are stuck");
    expect(e.text).toContain("These testers sent replies before");
    expect(e.text).toContain("• Dev: Gmail or Outlook is disconnected. Write to: dev@example.com");
    expect(e.text).not.toContain("first reply yet");
  });

  it("counts, but doesn't name, those who haven't opened FollowUp in over two weeks", () => {
    expect(stuckTestersEmail([], "https://x.io", [s({ quietDays: 15 })])).toBeNull();
    const e = stuckTestersEmail([], "https://x.io", [s({}), s({ id: "s2", quietDays: 30 })])!;
    expect(e.subject).toBe("1 tester is stuck");
    expect(e.text).toContain("1 more hasn't opened FollowUp in over two weeks.");
    const quiet = stuckTestersEmail([t({})], "https://x.io", [s({ quietDays: 20 }), s({ id: "s2", quietDays: 40 })])!;
    expect(quiet.text).toContain("2 testers who sent replies haven't opened FollowUp in over two weeks.");
  });

  it("says the stuck count on its own line when only stalled testers are named", () => {
    const e = stuckTestersEmail([t({ days: 30 })], "https://x.io", [s({})])!;
    expect(e.text).toContain("1 tester has been stuck for over two weeks.");
  });

  it("escapes what they typed", () => {
    const e = stuckTestersEmail([], "https://x.io", [s({ name: "<i>Fay</i>", business: "C & D" })])!;
    expect(e.html).toContain("&lt;i&gt;Fay&lt;/i&gt; (C &amp; D)");
    expect(e.html).not.toContain("<i>Fay</i>");
  });
});

describe("sending it", () => {
  beforeEach(() => {
    loadActivation.mockReset();
    loadStopped.mockReset().mockResolvedValue([]);
    reportCronFailure.mockReset();
    sendAlertEmail.mockReset().mockResolvedValue({ sent: true });
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "founder@followupbase.io");
  });

  it("emails each founder once a day", async () => {
    loadActivation.mockResolvedValue({ stuck: [t({})] });
    const r = await sendStuckTesters(new Date("2026-10-11T13:07:00Z"));
    expect(r).toEqual({ named: 1, emailed: 1 });
    expect(sendAlertEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "founder@followupbase.io", subject: "1 tester is stuck", idempotencyKey: "stuck-testers:2026-10-11:founder@followupbase.io" })
    );
  });

  it("sends nothing when nobody is stuck, or nobody is set to receive it", async () => {
    loadActivation.mockResolvedValue({ stuck: [] });
    expect(await sendStuckTesters()).toEqual({ named: 0, emailed: 0 });
    vi.stubEnv("PLATFORM_ADMIN_EMAILS", "");
    loadActivation.mockResolvedValue({ stuck: [t({})] });
    expect(await sendStuckTesters()).toEqual({ named: 0, emailed: 0 });
    expect(sendAlertEmail).not.toHaveBeenCalled();
    expect(loadActivation).toHaveBeenCalledTimes(1);
  });

  it("emails when only a stalled tester needs a nudge", async () => {
    loadActivation.mockResolvedValue({ stuck: [] });
    loadStopped.mockResolvedValue([s({})]);
    expect(await sendStuckTesters(new Date("2026-10-15T13:07:00Z"))).toEqual({ named: 1, emailed: 1 });
  });

  it("still sends the stuck list when reading stalled testers fails, and reports the failure", async () => {
    loadActivation.mockResolvedValue({ stuck: [t({})] });
    loadStopped.mockRejectedValue(new Error("db timeout"));
    expect(await sendStuckTesters(new Date("2026-10-15T13:07:00Z"))).toEqual({ named: 1, emailed: 1 });
    expect(reportCronFailure).toHaveBeenCalledWith("setup-health", expect.any(Error), "stopped testers");
  });
});

describe("who may read every tester without signing in", () => {
  it("is only this email, which runs behind the cron secret", () => {
    const src = join(__dirname, "..", "..");
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = join(dir, f);
        if (statSync(p).isDirectory()) {
          if (f !== "__tests__") walk(p);
        } else if (/\.(ts|tsx)$/.test(f)) files.push(p);
      }
    };
    walk(src);
    const users = files
      .filter((f) => /\b(loadActivation|loadStopped)\b/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(src.length + 1))
      .sort();
    expect(users).toEqual(["lib/activation-data.ts", "lib/stuckTesters.ts"]);
  });
});
