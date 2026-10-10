/**
 * The daily stuck-testers email (founder, 2026-10-10: "Yes, build it"):
 * quiet when nobody is stuck, names only the last two weeks, and never
 * lets a tester's typed name or business break the email's HTML.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const { loadActivation, sendAlertEmail } = vi.hoisted(() => ({ loadActivation: vi.fn(), sendAlertEmail: vi.fn() }));
vi.mock("@/lib/activation-data", () => ({ loadActivation }));
vi.mock("@/lib/alertEmail", () => ({ sendAlertEmail }));

import { stuckTestersEmail, sendStuckTesters } from "@/lib/stuckTesters";
import type { StuckTester } from "@/lib/activation";

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

describe("sending it", () => {
  beforeEach(() => {
    loadActivation.mockReset();
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
      .filter((f) => /\bloadActivation\b/.test(readFileSync(f, "utf8")))
      .map((f) => f.slice(src.length + 1))
      .sort();
    expect(users).toEqual(["lib/activation-data.ts", "lib/stuckTesters.ts"]);
  });
});
