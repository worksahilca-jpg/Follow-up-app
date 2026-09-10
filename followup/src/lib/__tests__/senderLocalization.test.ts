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
    expect(localize).toHaveBeenCalledWith("Hi Lucía,\n\nBest,\nSahil", "Hola, ¿cuánto cuesta?");
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
