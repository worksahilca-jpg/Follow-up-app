/**
 * Reminders when an inbox stays disconnected (founder, 2026-10-22): one email at day 2 and one at day 7 after the inbox
 * last worked, to every admin, then silence; never again for the same break, and never once it works again.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { prismaMock, sendAlertEmail, recordAudit } = vi.hoisted(() => ({
  prismaMock: {
    integration: { findMany: vi.fn(), count: vi.fn() },
    auditEvent: { findMany: vi.fn() },
    user: { findMany: vi.fn() },
  },
  sendAlertEmail: vi.fn(),
  recordAudit: vi.fn(async () => true),
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/alertEmail", () => ({ sendAlertEmail }));
vi.mock("@/lib/audit", () => ({ recordAudit }));
vi.mock("@/lib/stripe", () => ({ appUrl: () => "https://app.example" }));

import { brokeAtOf, reconnectReminderEmail, reminderDue, sendReconnectReminders, REMINDER_ACTION } from "@/lib/reconnectReminders";

const DAY = 86_400_000;
const now = new Date("2026-10-22T13:07:00Z");
const daysAgo = (d: number) => new Date(now.getTime() - d * DAY);

describe("which reminder is due", () => {
  it("none before day 2, the first from day 2, the second from day 7", () => {
    expect(reminderDue(daysAgo(1.9), now, [])).toBeNull();
    expect(reminderDue(daysAgo(2), now, [])).toBe(1);
    expect(reminderDue(daysAgo(6), now, [1])).toBeNull();
    expect(reminderDue(daysAgo(7), now, [1])).toBe(2);
    expect(reminderDue(daysAgo(30), now, [1, 2])).toBeNull();
  });

  it("an inbox found long after it broke gets only the last one, never two in a row", () => {
    expect(reminderDue(daysAgo(39), now, [])).toBe(2);
    expect(reminderDue(daysAgo(39), now, [2])).toBeNull();
  });

  it("counts from the last moment it worked: the later of the last good sync and the connect", () => {
    expect(brokeAtOf({ lastSyncedAt: daysAgo(10), connectedAt: daysAgo(20) })).toEqual(daysAgo(10));
    expect(brokeAtOf({ lastSyncedAt: daysAgo(10), connectedAt: daysAgo(3) })).toEqual(daysAgo(3));
    expect(brokeAtOf({ lastSyncedAt: null, connectedAt: null })).toBeNull();
  });
});

describe("the email", () => {
  it("says since when, the one-press fix, why, and whether more will come", () => {
    const e = reconnectReminderEmail({
      provider: "gmail",
      inbox: "owner@example.com",
      brokeAt: new Date("2026-10-06T15:00:00Z"),
      connectedAt: new Date("2026-09-29T15:00:00Z"),
      last: false,
      base: "https://app.example",
      timeZone: "America/Toronto",
    });
    expect(e.subject).toBe("Gmail is still disconnected");
    expect(e.text).toContain("since Tue, Oct 6");
    expect(e.text).toContain("Reconnect Gmail: https://app.example/api/integrations/gmail/connect");
    expect(e.text).toContain("Connections made before October 3 ended after 7 days");
    expect(e.text).toContain("remind you once more");
    expect(e.html).toContain("Reconnect Gmail");
  });

  it("Outlook goes to Outlook's connect, and the last one says it is the last", () => {
    const e = reconnectReminderEmail({
      provider: "outlook",
      inbox: "owner@example.com",
      brokeAt: daysAgo(8),
      connectedAt: daysAgo(40),
      last: true,
      base: "https://app.example",
    });
    expect(e.text).toContain("/api/integrations/outlook/connect");
    expect(e.text).toContain("Microsoft account");
    expect(e.text).not.toContain("October 3");
    expect(e.text).toContain("This is the last reminder");
  });
});

describe("the daily run", () => {
  const broken = (over: Record<string, unknown> = {}) => ({
    id: "int1",
    provider: "gmail",
    connectedAt: new Date("2026-09-29T15:00:00Z"),
    lastSyncedAt: new Date("2026-10-06T15:00:00Z"),
    accountEmail: "owner@example.com",
    user: { email: "owner@example.com", businessId: "biz1" },
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    prismaMock.integration.findMany.mockResolvedValue([broken()]);
    prismaMock.integration.count.mockResolvedValue(0);
    prismaMock.auditEvent.findMany.mockResolvedValue([]);
    prismaMock.user.findMany.mockResolvedValue([
      { id: "u1", email: "owner@example.com", business: { timezone: "America/Toronto" } },
      { id: "u2", email: "partner@example.com", business: { timezone: "America/Toronto" } },
    ]);
    sendAlertEmail.mockResolvedValue({ sent: true });
  });

  it("emails every admin once and records it, so tomorrow sends nothing", async () => {
    expect(await sendReconnectReminders(now)).toEqual({ checked: 1, emailed: 2 });
    expect(prismaMock.integration.findMany.mock.calls[0][0].where).toEqual({
      provider: { in: ["gmail", "outlook"] },
      status: "needs_reconnect",
    });
    expect(sendAlertEmail.mock.calls.map((c) => c[0].to)).toEqual(["owner@example.com", "partner@example.com"]);
    // 16 days since it last worked, nothing sent yet: the last reminder, alone.
    expect(sendAlertEmail.mock.calls[0][0].text).toContain("This is the last reminder");
    expect(recordAudit).toHaveBeenCalledWith({ businessId: "biz1" }, REMINDER_ACTION, {
      targetType: "integration",
      targetId: "int1",
      meta: { n: 2, since: "2026-09-29T15:00:00.000Z" },
    });

    prismaMock.auditEvent.findMany.mockResolvedValue([{ targetId: "int1", meta: { n: 2, since: "2026-09-29T15:00:00.000Z" } }]);
    sendAlertEmail.mockClear();
    expect(await sendReconnectReminders(now)).toEqual({ checked: 1, emailed: 0 });
    expect(sendAlertEmail).not.toHaveBeenCalled();
  });

  it("a reminder for an earlier break doesn't count against a new one", async () => {
    prismaMock.integration.findMany.mockResolvedValue([
      broken({ connectedAt: daysAgo(12), lastSyncedAt: daysAgo(3) }),
    ]);
    prismaMock.auditEvent.findMany.mockResolvedValue([{ targetId: "int1", meta: { n: 2, since: "2026-09-29T15:00:00.000Z" } }]);
    await sendReconnectReminders(now);
    expect(sendAlertEmail).toHaveBeenCalledTimes(2);
    expect(sendAlertEmail.mock.calls[0][0].text).toContain("remind you once more");
  });

  it("nothing when the business already works through another connection, or it broke under 2 days ago", async () => {
    prismaMock.integration.count.mockResolvedValueOnce(1);
    await sendReconnectReminders(now);
    expect(sendAlertEmail).not.toHaveBeenCalled();

    prismaMock.integration.findMany.mockResolvedValue([broken({ lastSyncedAt: daysAgo(1), connectedAt: daysAgo(5) })]);
    await sendReconnectReminders(now);
    expect(sendAlertEmail).not.toHaveBeenCalled();
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("records nothing when no email went, so tomorrow tries again", async () => {
    sendAlertEmail.mockResolvedValue({ sent: false, reason: "no key" });
    await sendReconnectReminders(now);
    expect(recordAudit).not.toHaveBeenCalled();
  });

  it("one business failing never stops the others", async () => {
    prismaMock.integration.findMany.mockResolvedValue([broken(), broken({ id: "int2", user: { email: "b@example.com", businessId: "biz2" } })]);
    prismaMock.user.findMany.mockRejectedValueOnce(new Error("pool timeout"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await sendReconnectReminders(now)).toEqual({ checked: 2, emailed: 2 });
  });
});
