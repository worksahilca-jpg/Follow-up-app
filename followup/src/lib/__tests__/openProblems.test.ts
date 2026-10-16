/**
 * Problems go on Today (A-270): what broke, the one thing to do, and gone once fixed. The inboxes below are made up.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { notification } = vi.hoisted(() => ({ notification: { findMany: vi.fn() } }));
vi.mock("@/lib/db", () => ({ prisma: { notification } }));

import { firstSentence, openProblems, problemAction, stillOpen, type InboxState } from "@/lib/openProblems";

const LOST = "FollowUp lost access to owner@example.com, so new emails there aren't being picked up. Reconnect Gmail in Settings to keep catching leads. Connections made before October 3 ended after 7 days.";
const OUTLOOK = "FollowUp lost access to owner@outlook.com, so new emails there aren't being picked up. Reconnect Outlook in Settings to keep catching leads.";
const at = (iso: string) => new Date(iso);
const healthy: InboxState = { gmail: { connected: true, needsReconnect: false, lastSyncedAt: at("2026-10-16T12:00:00Z") }, outlook: { connected: false }, cantSendShown: false };
const broken: InboxState = { gmail: { connected: false, needsReconnect: true, lastSyncedAt: null }, outlook: { connected: false }, cantSendShown: false };

describe("the words", () => {
  it("says what happened in one sentence", () => {
    expect(firstSentence(LOST)).toBe("FollowUp lost access to owner@example.com, so new emails there aren't being picked up.");
    expect(firstSentence("No full stop here")).toBe("No full stop here");
  });

  it("names the one thing to do", () => {
    expect(problemAction(LOST)).toEqual({ label: "Reconnect Gmail", href: "/settings#connections" });
    expect(problemAction(OUTLOOK)).toEqual({ label: "Reconnect Outlook", href: "/settings#connections" });
    expect(problemAction("Something with no fix in it.")).toBeNull();
  });
});

describe("still open", () => {
  const n = { id: "n1", message: LOST, createdAt: at("2026-10-16T10:00:00Z") };

  it("shows a Gmail problem until Gmail is connected and has checked since", () => {
    expect(stillOpen(n, broken)).toBe(true);
    expect(stillOpen(n, healthy)).toBe(false);
    expect(stillOpen(n, { ...healthy, gmail: { ...healthy.gmail, lastSyncedAt: at("2026-10-16T09:00:00Z") } })).toBe(true);
  });

  it("isn't said twice beside Today's own can't-send box", () => {
    expect(stillOpen(n, { ...broken, cantSendShown: true })).toBe(false);
  });

  it("drops an Outlook problem once Outlook is connected", () => {
    const o = { id: "n2", message: OUTLOOK, createdAt: at("2026-10-16T10:00:00Z") };
    expect(stillOpen(o, broken)).toBe(true);
    expect(stillOpen(o, { ...broken, outlook: { connected: true } })).toBe(false);
  });
});

describe("openProblems", () => {
  beforeEach(() => notification.findMany.mockReset());

  it("asks only for the viewer's own unread, account-wide notices of the last few days", async () => {
    notification.findMany.mockResolvedValue([]);
    await openProblems("biz-1", "user-7", broken, at("2026-10-16T12:00:00Z"));
    const where = notification.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: "user-7", user: { businessId: "biz-1" }, read: false, leadId: null });
    expect(where.createdAt.gte).toEqual(at("2026-10-13T12:00:00Z"));
  });

  it("shows the same problem once, at most three", async () => {
    notification.findMany.mockResolvedValue([
      { id: "a", message: LOST, createdAt: at("2026-10-16T11:00:00Z") },
      { id: "b", message: LOST, createdAt: at("2026-10-15T11:00:00Z") },
      { id: "c", message: OUTLOOK, createdAt: at("2026-10-15T10:00:00Z") },
      { id: "d", message: "One. Two.", createdAt: at("2026-10-15T09:00:00Z") },
      { id: "e", message: "Three.", createdAt: at("2026-10-15T08:00:00Z") },
    ]);
    const out = await openProblems("biz-1", "user-7", broken, at("2026-10-16T12:00:00Z"));
    expect(out.map((p) => p.id)).toEqual(["a", "c", "d"]);
  });
});
