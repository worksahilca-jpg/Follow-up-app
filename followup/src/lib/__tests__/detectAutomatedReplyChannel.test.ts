/**
 * task #86 (third-pass audit): detectAutomatedReplyChannel() is what
 * automation.ts now passes explicitly instead of relying on
 * sendFollowUpToLead()'s own "email if the lead has one" default — that
 * default sent automated replies to an email address a lead never checks
 * whenever they'd actually been engaging over SMS, WhatsApp, Instagram, or
 * Messenger and simply also had an email on file.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: { message: { findFirst: vi.fn() } },
}));

import { prisma } from "@/lib/db";
import { detectAutomatedReplyChannel } from "@/lib/sending";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

function lead(overrides: Record<string, unknown> = {}) {
  return { id: "lead1", email: "lead@example.com", phone: "+15551234567", ...overrides };
}

beforeEach(() => {
  p.message.findFirst.mockResolvedValue(null);
});

describe("detectAutomatedReplyChannel", () => {
  it("prefers the channel the lead most recently actually messaged through, over email", async () => {
    p.message.findFirst.mockResolvedValue({ conversation: { channel: "text" } });
    expect(await detectAutomatedReplyChannel(lead())).toBe("text");
  });

  it("prefers WhatsApp when that's the last channel the lead used", async () => {
    p.message.findFirst.mockResolvedValue({ conversation: { channel: "whatsapp" } });
    expect(await detectAutomatedReplyChannel(lead())).toBe("whatsapp");
  });

  it("prefers Instagram when that's the last channel, and the phone field is really an Instagram sender id", async () => {
    p.message.findFirst.mockResolvedValue({ conversation: { channel: "instagram" } });
    expect(await detectAutomatedReplyChannel(lead({ phone: "ig:12345", email: "lead@example.com" }))).toBe("instagram");
  });

  it("still uses email when that's genuinely the last channel the lead engaged on", async () => {
    p.message.findFirst.mockResolvedValue({ conversation: { channel: "email" } });
    expect(await detectAutomatedReplyChannel(lead())).toBe("email");
  });

  it("falls back to email when there's no inbound history to infer from at all", async () => {
    p.message.findFirst.mockResolvedValue(null);
    expect(await detectAutomatedReplyChannel(lead())).toBe("email");
  });

  it("falls back to email when the last channel was 'web' (not a send-capable channel)", async () => {
    p.message.findFirst.mockResolvedValue({ conversation: { channel: "web" } });
    expect(await detectAutomatedReplyChannel(lead())).toBe("email");
  });

  it("falls back to whichever phone channel the lead last used when there's no email on file", async () => {
    p.message.findFirst.mockResolvedValue({ conversation: { channel: "whatsapp" } });
    expect(await detectAutomatedReplyChannel(lead({ email: null }))).toBe("whatsapp");
  });

  it("returns null when the lead has neither an email nor a phone", async () => {
    expect(await detectAutomatedReplyChannel(lead({ email: null, phone: null }))).toBeNull();
  });
});
