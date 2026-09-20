/**
 * "El costo será de $100."
 *
 * A lead wrote, in Spanish, asking whether a consultation was available
 * next week and what it would cost. The draft waiting in the founder's
 * approval queue on 2026-09-20 answered with a price. Nobody had said
 * $100 — not the lead, not the owner, not anywhere in the thread. It was
 * a commercial figure invented by a model and addressed from a real
 * person to a real person.
 *
 * The instant acknowledgement has refused ungrounded numbers since the
 * day it stopped being a fixed template. DM drafts have refused them
 * since they existed. The email follow-up — the longest message FollowUp
 * writes, the least constrained, and the only one that lands in a
 * stranger's inbox rather than a DM thread — had no check of any kind.
 *
 * Three other drafts in that same queue invented a sent email ("Envié la
 * información que solicitaste"), a prior discussion ("los servicios que
 * discutimos") and a confirmation. Those are assertions: the risk gate
 * and the prompt own them, and no regex will catch them. This file is
 * about the part that is arithmetic, and arithmetic is checkable.
 */
import { describe, it, expect } from "vitest";

import { ungroundedSpecifics } from "@/lib/grounding";

/** The real thread, as it sits in production. */
const DIEGO_ASKED =
  "Buenos días, quisiera saber si tienen disponibilidad para una consulta la semana que viene y cuál sería el costo. Me pueden responder por correo, gracias.";

describe("the draft that quoted a price nobody mentioned", () => {
  it("catches the $100", () => {
    const draft = "Podemos confirmar que tenemos disponibilidad para una consulta la semana que viene. El costo será de $100, ¿te parece bien?";
    expect(ungroundedSpecifics(draft, DIEGO_ASKED, "es")).toBe("digits");
  });

  it("catches the currency symbol even with no digits beside it", () => {
    // "a price in USD" — no number to trip the digits rule, still a
    // commercial specific the lead never raised.
    expect(ungroundedSpecifics("Le enviaremos el costo en USD.", DIEGO_ASKED, "es")).toBe("currency");
  });

  it("lets the same draft through once the lead names the price first", () => {
    const leadNamedIt = `${DIEGO_ASKED} Mi presupuesto es $100.`;
    const draft = "Podemos confirmar que tenemos disponibilidad. El costo será de $100, ¿te parece bien?";
    expect(ungroundedSpecifics(draft, leadNamedIt, "es")).toBeNull();
  });

  it("passes the honest version of the same reply — no figure at all", () => {
    const draft = "Podemos confirmar que tenemos disponibilidad para una consulta la semana que viene. ¿Te parece bien que te envíe los detalles?";
    expect(ungroundedSpecifics(draft, DIEGO_ASKED, "es")).toBeNull();
  });
});

describe("the other three specifics, on the same invariant", () => {
  it("catches an invented day", () => {
    expect(ungroundedSpecifics("Let's do Thursday.", "Are you free sometime?", "en")).toBe("calendar");
  });

  it("catches an invented clock time — as `digits`, because that is what it is", () => {
    // There is no separate time rule, and deliberately so: every clock
    // time carries digits, so the digits rule reaches it first and a
    // `time` branch would be unreachable code dressed as a safeguard.
    expect(ungroundedSpecifics("How about 3:30?", "Can we talk?", "en")).toBe("digits");
  });

  it("allows a day the lead named themselves", () => {
    expect(ungroundedSpecifics("Thursday works.", "Is Thursday any good?", "en")).toBeNull();
  });

  it("allows a day the business already named earlier in the thread", () => {
    // `source` is the WHOLE thread, both directions — a day FollowUp
    // committed to in message one is grounded for message two.
    const thread = "Is anything free this week?\nWe have Thursday open.\nSounds good.";
    expect(ungroundedSpecifics("See you Thursday.", thread, "en")).toBeNull();
  });
});

describe("it does not invent failures", () => {
  it("passes a draft with no specifics in it at all", () => {
    expect(ungroundedSpecifics("Thanks for getting in touch — happy to help.", "Hi there", "en")).toBeNull();
  });

  it("does not ground a fabricated number against a larger one the lead wrote", () => {
    // "2 days" is not grounded by "$2,000". Whole tokens, not substrings —
    // this is the bug the number rule was rewritten to fix, and it has to
    // stay fixed in the shared implementation.
    expect(ungroundedSpecifics("Give me 2 days.", "My budget is $2,000.", "en")).toBe("digits");
  });

  it("does not ground 'March' against 'market'", () => {
    // Whole-word matching. Substring matching would quietly pass an
    // invented month.
    expect(ungroundedSpecifics("Let's aim for March.", "How is the market?", "en")).toBe("calendar");
  });

  it("works in a language whose calendar words are not English", () => {
    // The check runs against the LEAD's locale, because that is the
    // language the draft was written in.
    expect(ungroundedSpecifics("Nos vemos el jueves.", "¿Tienen disponibilidad?", "es")).toBe("calendar");
  });

  it("survives a locale tag it does not recognise rather than throwing", () => {
    // A check that throws blocks a send. An unknown tag falls back to the
    // English pass and keeps working.
    expect(() => ungroundedSpecifics("Hello", "Hi", "not-a-locale")).not.toThrow();
  });
});
