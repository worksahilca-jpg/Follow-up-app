/**
 * A Gmail send's Subject arrives as written, accents and all.
 *
 * sendEmail wrote the Subject into the raw message as bare UTF-8. Mail
 * headers are ASCII (RFC 5322) unless a non-ASCII value is carried as an
 * RFC 2047 encoded-word, and a raw UTF-8 subject sent through the Gmail API
 * reaches recipients as mojibake ("rÃ©novation") in the clients that assume
 * ASCII headers. It hit exactly the mail FollowUp is built for: the reply
 * "Re: <the customer's own subject>" to a French-speaking customer, and the
 * instant acknowledgement's localized subject ("Merci d'avoir contacté…").
 * A subject that no longer matches the customer's also stops their mail
 * app keeping the reply in their thread.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { send, prismaMock } = vi.hoisted(() => ({
  send: vi.fn(async (_args: { requestBody: { raw: string } }) => ({ data: { id: "sent-1" } })),
  prismaMock: { integration: { findFirst: vi.fn(), findMany: vi.fn() } },
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials() {}
      },
    },
    gmail: () => ({ users: { messages: { send } } }),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/openai", () => ({ classifyWithSecondLook: vi.fn() }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn() }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead: vi.fn() }));

import { sendEmail } from "@/lib/integrations/gmail";

/** The raw message Gmail was handed, as text. */
function sentRaw(): string {
  const raw = send.mock.calls[0][0].requestBody.raw;
  return Buffer.from(raw.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf-8");
}

/** The Subject header as sent, unfolded, and as a mail app decodes it. */
function subjectOf(raw: string): { onTheWire: string; decoded: string } {
  const head = raw.split("\r\n\r\n")[0].replace(/\r\n[ \t]/g, " ");
  const onTheWire = head.split("\r\n").find((l) => l.startsWith("Subject: "))!.slice("Subject: ".length);
  const decoded = onTheWire
    // Whitespace between two adjacent encoded-words is not part of the text (RFC 2047 §6.2).
    .replace(/\?=\s+=\?/g, "?==?")
    .replace(/=\?UTF-8\?B\?([A-Za-z0-9+/=]*)\?=/gi, (_, b64) => Buffer.from(b64, "base64").toString("utf-8"));
  return { onTheWire, decoded };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("GOOGLE_CLIENT_ID", "client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://followupbase.io/api/integrations/gmail/callback");
  prismaMock.integration.findMany.mockResolvedValue([{ id: "int1" }]);
  prismaMock.integration.findFirst.mockResolvedValue({
    id: "int1",
    refreshToken: "refresh",
    accountEmail: "info@renovationsgagnon.ca",
    user: { email: "luc@gmail.com" },
  });
});

describe("the Subject of a Gmail send", () => {
  it.each([
    "Re: Soumission — rénovation de cuisine",
    "Merci d'avoir contacté Rénovations Gagnon",
    "Re: Presupuesto para baño, ¿cuándo pueden venir?",
    // Long enough that one encoded-word would pass RFC 2047's 75-character limit.
    "Re: Demande de soumission pour la rénovation complète de la salle de bain et de la cuisine à Montréal",
  ])("is ASCII on the wire and reads back exactly: %s", async (subject) => {
    await sendEmail("biz1", { to: "chloe@example.com", subject, body: "Bonjour Chloé", threadId: "t1", inReplyTo: "<m1@mail>" });

    const { onTheWire, decoded } = subjectOf(sentRaw());
    expect(onTheWire).toMatch(/^[\x20-\x7e]*$/);
    expect(decoded).toBe(subject);
    for (const word of onTheWire.match(/=\?[^?]+\?B\?[^?]*\?=/g) ?? []) expect(word.length).toBeLessThanOrEqual(75);
  });

  it("leaves a plain ASCII subject exactly as it was", async () => {
    await sendEmail("biz1", { to: "jane@example.com", subject: "Re: Water heater quote", body: "Hi Jane" });
    expect(subjectOf(sentRaw()).onTheWire).toBe("Re: Water heater quote");
  });

  it("still cannot inject a header through the subject", async () => {
    await sendEmail("biz1", { to: "jane@example.com", subject: "Café\r\nBcc: evil@example.com", body: "Hi" });
    const raw = sentRaw();
    expect(raw.split("\r\n\r\n")[0]).not.toMatch(/^Bcc:/m);
    expect(subjectOf(raw).decoded).toBe("Café Bcc: evil@example.com");
  });
});
