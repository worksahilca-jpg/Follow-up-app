/**
 * "Did they open FollowUp today?" (founder, 2026-10-04). One record per
 * person per local day, and the habit line on /admin built from it.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const findUnique = vi.fn();
const findFirst = vi.fn();
const recordAudit = vi.fn();
vi.mock("@/lib/db", () => ({ prisma: { business: { findUnique: (a: unknown) => findUnique(a) }, auditEvent: { findFirst: (a: unknown) => findFirst(a) } } }));
vi.mock("@/lib/audit", () => ({ recordAudit: (...a: unknown[]) => recordAudit(...a) }));
vi.mock("@/lib/platformAdmin", () => ({ requirePlatformAdmin: vi.fn() }));
vi.mock("@/lib/rescued", () => ({ getRescueReport: vi.fn() }));

import { APP_OPEN, localDay, recordAppOpen, summariseOpens } from "@/lib/appOpens";
import { openedLine } from "@/lib/testerHealth";

const TZ = "America/Toronto";
const ctx = { businessId: "b1", userId: "u1" };

beforeEach(() => {
  findUnique.mockReset().mockResolvedValue({ timezone: TZ });
  findFirst.mockReset();
  recordAudit.mockReset().mockResolvedValue(true);
});

describe("recordAppOpen", () => {
  it("writes the first open of the day", async () => {
    findFirst.mockResolvedValue(null);
    expect(await recordAppOpen(ctx, new Date("2026-10-05T14:00:00Z"))).toBe(true);
    expect(recordAudit).toHaveBeenCalledWith(ctx, APP_OPEN);
  });

  it("writes nothing for a second open the same local day", async () => {
    findFirst.mockResolvedValue({ createdAt: new Date("2026-10-05T13:00:00Z") });
    expect(await recordAppOpen(ctx, new Date("2026-10-05T22:00:00Z"))).toBe(false);
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("counts days in the business's zone: 11 pm and 1 am Toronto are two days", async () => {
    // 03:00Z is 11 pm Toronto the evening before; 05:00Z the next day is 1 am.
    findFirst.mockResolvedValue({ createdAt: new Date("2026-10-05T03:00:00Z") });
    expect(await recordAppOpen(ctx, new Date("2026-10-06T05:00:00Z"))).toBe(true);
  });

  it("only ever looks at this person's own opens", async () => {
    findFirst.mockResolvedValue(null);
    await recordAppOpen(ctx, new Date("2026-10-05T14:00:00Z"));
    expect(findFirst.mock.calls[0][0].where).toMatchObject({ userId: "u1", action: APP_OPEN });
  });
});

describe("summariseOpens and the habit line", () => {
  const now = new Date("2026-10-10T16:00:00Z"); // noon Toronto, Oct 10

  it("counts distinct days in the last seven, today included", () => {
    const times = ["2026-10-10T13:00:00Z", "2026-10-10T15:00:00Z", "2026-10-08T14:00:00Z", "2026-10-04T14:00:00Z", "2026-10-01T14:00:00Z"].map((s) => new Date(s));
    const o = summariseOpens(times, now, TZ);
    expect(o.daysOf7).toBe(3);
    expect(o.last?.toISOString()).toBe("2026-10-10T15:00:00.000Z");
  });

  it("says today, yesterday, or days ago, by calendar day in their zone", () => {
    expect(openedLine({ last: new Date("2026-10-10T13:00:00Z"), daysOf7: 4, timeZone: TZ }, now)).toBe("Opened today · 4 of 7 days");
    // 11 pm Toronto on Oct 9 is yesterday, even though it is under 24 hours ago.
    expect(openedLine({ last: new Date("2026-10-10T03:00:00Z"), daysOf7: 1, timeZone: TZ }, now)).toBe("Opened yesterday · 1 of 7 days");
    expect(openedLine({ last: new Date("2026-09-30T15:00:00Z"), daysOf7: 0, timeZone: TZ }, now)).toBe("Opened 10 days ago · 0 of 7 days");
  });

  it("is honest before there is any record", () => {
    expect(openedLine(undefined, now)).toBe("Not opened since tracking began");
    expect(openedLine(summariseOpens([], now, TZ), now)).toBe("Not opened since tracking began");
  });

  it("formats a local day as YYYY-MM-DD", () => {
    expect(localDay(new Date("2026-10-05T03:00:00Z"), TZ)).toBe("2026-10-04");
  });
});
