/**
 * composeFollowUpEmail()'s language-aware greeting/sign-off frame
 * (src/lib/sender.ts) — task #63's live test: a Spanish lead's email went
 * out as "Hi Lucía, … Best, Sahil" around an in-language body, because
 * the frame was a fixed English string. Now the frame alone is localized
 * against the lead's latest inbound message, the body is never touched,
 * and anything the localizer hands back in the wrong shape falls back to
 * the English frame rather than risking a mangled signature.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { findFirstUser, localize } = vi.hoisted(() => ({
  findFirstUser: vi.fn(),
  localize: vi.fn(),
}));
vi.mock("@/lib/db", () => ({ prisma: { user: { findFirst: findFirstUser }, business: { findUnique: vi.fn() } } }));
vi.mock("@/lib/integrations/openai", () => ({ localizeFixedText: localize }));

import { composeFollowUpEmail, latestInboundText } from "@/lib/sender";
import type { Message } from "@/lib/types";

beforeEach(() => {
  findFirstUser.mockResolvedValue({ name: "Sahil Sharma", email: "sahil@example.com" });
  localize.mockReset();
  localize.mockImplementation(async (t: string) => t);
});

describe("composeFollowUpEmail", () => {
  it("uses the plain English frame, with no localizer call, when there's no language sample", async () => {
    const out = await composeFollowUpEmail("Lucía", "biz1", "Body line.");
    expect(out).toBe("Hi Lucía,\n\nBody line.\n\nBest,\nSahil");
    expect(localize).not.toHaveBeenCalled();
  });

  it("localizes only the frame — greeting and sign-off — never the body", async () => {
    localize.mockResolvedValue("Hola Lucía,\n\nSaludos,\nSahil");
    const body = "Con gusto — Sahil te enviará el precio exacto en breve.";
    const out = await composeFollowUpEmail("Lucía", "biz1", body, { languageSample: "Hola, ¿cuánto cuesta?" });

    expect(localize).toHaveBeenCalledTimes(1);
    // Arity-strict: localizeFixedText gained a third argument on
    // 2026-09-19, the lead's decided language/register. Undefined here
    // because this caller passed no options.leadLanguage — which is the
    // unchanged-behaviour path this test is about.
    expect(localize).toHaveBeenCalledWith("Hi Lucía,\n\nBest,\nSahil", "Hola, ¿cuánto cuesta?", undefined);
    expect(out).toBe(`Hola Lucía,\n\n${body}\n\nSaludos,\nSahil`);
  });

  it("keeps the English frame for an English lead (localizer returns the input unchanged)", async () => {
    const out = await composeFollowUpEmail("Young", "biz1", "Body.", { languageSample: "Is the roof original?" });
    expect(out).toBe("Hi Young,\n\nBody.\n\nBest,\nSahil");
  });

  it("falls back to the English frame if the localizer collapses the two parts into one", async () => {
    localize.mockResolvedValue("Hola Lucía, Saludos, Sahil");
    const out = await composeFollowUpEmail("Lucía", "biz1", "Body.", { languageSample: "Hola" });
    expect(out).toBe("Hi Lucía,\n\nBody.\n\nBest,\nSahil");
  });

  it("falls back to the English frame if the sender's name went missing from the sign-off", async () => {
    localize.mockResolvedValue("Hola Lucía,\n\nSaludos,\nEl equipo");
    const out = await composeFollowUpEmail("Lucía", "biz1", "Body.", { languageSample: "Hola" });
    expect(out).toBe("Hi Lucía,\n\nBody.\n\nBest,\nSahil");
  });

  // Backlog b010: callers that pass lead.name.split(" ")[0] handed an
  // unnamed Messenger lead's "Facebook" straight into the greeting.
  it("greets a placeholder first name with no name, never 'Hi Facebook,'", async () => {
    for (const first of ["Facebook", "Instagram", "WhatsApp", "+14155551234"]) {
      const out = await composeFollowUpEmail(first, "biz1", "Body.");
      expect(out).toBe("Hi,\n\nBody.\n\nBest,\nSahil");
    }
  });

  it("greets an already-judged empty name as 'Hi,', not 'Hi ,'", async () => {
    const out = await composeFollowUpEmail("", "biz1", "Body.");
    expect(out).toBe("Hi,\n\nBody.\n\nBest,\nSahil");
    expect(out).not.toMatch(/Hi ,/);
  });

  it("keeps an Instagram handle as the name, without the @", async () => {
    expect(await composeFollowUpEmail("@sahildoes", "biz1", "Body.")).toBe("Hi sahildoes,\n\nBody.\n\nBest,\nSahil");
  });

  it("treats a blank sample as no sample", async () => {
    await composeFollowUpEmail("Lucía", "biz1", "Body.", { languageSample: "   " });
    expect(localize).not.toHaveBeenCalled();
  });
});

describe("latestInboundText", () => {
  const msg = (direction: Message["direction"], body: string): Message => ({
    id: body,
    direction,
    channel: "email",
    body,
    date: new Date().toISOString(),
  });

  it("returns the most recent non-empty inbound message, ignoring later outbound ones", () => {
    expect(
      latestInboundText([msg("inbound", "Hello"), msg("outbound", "Hi back"), msg("inbound", "Hola, ¿sigue disponible?"), msg("outbound", "Sí")])
    ).toBe("Hola, ¿sigue disponible?");
  });

  it("skips blank inbound bodies", () => {
    expect(latestInboundText([msg("inbound", "Hola"), msg("inbound", "   ")])).toBe("Hola");
  });

  it("is undefined when the lead has never written anything", () => {
    expect(latestInboundText([msg("outbound", "Following up")])).toBeUndefined();
    expect(latestInboundText([])).toBeUndefined();
  });
});
