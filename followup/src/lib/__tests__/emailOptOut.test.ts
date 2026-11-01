/**
 * "Stop" by email is recorded like a STOP by text (Nov 1 2026, src/lib/emailOptOut.ts): read above the quoted thread,
 * only "stop" and "unsubscribe" on email, and only while it is the customer's newest message on any channel.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUnique, update, recordAudit } = vi.hoisted(() => ({ findUnique: vi.fn(), update: vi.fn(), recordAudit: vi.fn() }));
vi.mock("@/lib/db", () => ({ prisma: { lead: { findUnique, update } } }));
vi.mock("@/lib/audit", () => ({ recordAudit }));

import { recordEmailConsent } from "@/lib/emailOptOut";
import { isOptInReply, isOptOutReply } from "@/lib/optOutKeywords";
import { isConsentKeyword } from "@/lib/automation";

const GMAIL_STOP = "STOP\r\n\r\nOn Mon, Nov 2, 2026 at 9:00 AM Sam Rivera <sam@example.com> wrote:\r\n> Hi Priya, just checking in on the King St condo.\r\n";

describe("reading a reply", () => {
  it("finds a STOP above the quoted email, a signature or a phone's line", () => {
    expect(isOptOutReply(GMAIL_STOP, "email")).toBe(true);
    expect(isOptOutReply("Unsubscribe.\n\nSent from my iPhone", "email")).toBe(true);
    expect(isOptOutReply("stop\n-- \nPriya", "email")).toBe(true);
  });

  it("on email, only stop and unsubscribe: a Cancel under a showing email is about the showing", () => {
    expect(isOptOutReply("Cancel\n\nOn Mon, Sam wrote:\n> Your showing is booked for Saturday at 11.", "email")).toBe(false);
    expect(isOptOutReply("End", "email")).toBe(false);
    expect(isOptOutReply("Cancel", "text")).toBe(true);
  });

  it("never reads a sentence as a STOP", () => {
    expect(isOptOutReply("Please stop by the office tomorrow\n\nOn Mon, Sam wrote:\n> …", "email")).toBe(false);
    expect(isOptOutReply("Stop. On second thought I wrote: let's meet", "instagram")).toBe(false);
  });

  it("finds a START by email too", () => {
    expect(isOptInReply("start\n\nOn Tue, Sam wrote:\n> …", "email")).toBe(true);
  });

  it("is what the engine checks before drafting a reply", () => {
    expect(isConsentKeyword(GMAIL_STOP, "email")).toBe(true);
    expect(isConsentKeyword("Cancel", "email")).toBe(false);
    expect(isConsentKeyword("STOP", "text")).toBe(true);
  });
});

const lead = (optedOutAt: Date | null, ...convs: { channel: string; body: string; at: number }[]) => ({
  optedOutAt,
  conversations: convs.map((c) => ({ channel: c.channel, messages: [{ body: c.body, sentAt: new Date(c.at) }] })),
});

describe("recording it", () => {
  beforeEach(() => {
    findUnique.mockReset();
    update.mockReset();
    recordAudit.mockReset();
  });

  it("records a STOP that is the customer's newest message", async () => {
    findUnique.mockResolvedValue(lead(null, { channel: "email", body: GMAIL_STOP, at: 2_000 }, { channel: "text", body: "Hi", at: 1_000 }));
    expect(await recordEmailConsent("l1", "b1")).toBe("out");
    expect(update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { optedOutAt: expect.any(Date) } });
    expect(recordAudit).toHaveBeenCalledWith({ businessId: "b1", userId: null }, "lead.opt_out", expect.objectContaining({ meta: { channel: "email", via: "keyword" } }));
  });

  it("leaves it when they've written since on another channel", async () => {
    findUnique.mockResolvedValue(lead(null, { channel: "email", body: GMAIL_STOP, at: 1_000 }, { channel: "text", body: "START", at: 2_000 }));
    expect(await recordEmailConsent("l1", "b1")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("does nothing for an ordinary reply, or a STOP already recorded", async () => {
    findUnique.mockResolvedValue(lead(null, { channel: "email", body: "Saturday works!\n\nOn Mon, Sam wrote:\n> stop", at: 1_000 }));
    expect(await recordEmailConsent("l1", "b1")).toBeNull();
    findUnique.mockResolvedValue(lead(new Date(5_000), { channel: "email", body: GMAIL_STOP, at: 1_000 }));
    expect(await recordEmailConsent("l1", "b1")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("clears an opt-out only for a START sent after it", async () => {
    findUnique.mockResolvedValue(lead(new Date(1_000), { channel: "email", body: "Start", at: 2_000 }));
    expect(await recordEmailConsent("l1", "b1")).toBe("in");
    expect(update).toHaveBeenCalledWith({ where: { id: "l1" }, data: { optedOutAt: null } });
    update.mockReset();
    findUnique.mockResolvedValue(lead(new Date(3_000), { channel: "email", body: "Start", at: 2_000 }));
    expect(await recordEmailConsent("l1", "b1")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("never throws: the mail is already stored", async () => {
    findUnique.mockRejectedValue(new Error("db down"));
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await recordEmailConsent("l1", "b1")).toBeNull();
    error.mockRestore();
  });
});
