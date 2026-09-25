/**
 * Someone selling TO the business is not a lead.
 *
 * Reported by the founder, 2026-09-20, from his own live inbox. A
 * photographer emailed him offering to shoot an event. FollowUp filed it
 * as a lead and replied to it. His words: "I don't know how this is even
 * a lead, because she is not looking for a photographer. They are the
 * service provider."
 *
 * The old prompt did name vendors — "advertising, software, insurance,
 * financing, warranties or service contracts, leads-for-sale" — but every
 * item on that list is a B2B commodity. A photographer, a videographer, a
 * designer, a contractor writing to offer their craft looks nothing like
 * that list, and reads exactly like an eager customer: praise for your
 * work, keen to discuss your event, free for a call this week.
 *
 * Two things were wrong and both are fixed here:
 *
 *   1. The verdict was generated BEFORE any reasoning (field order is
 *      generation order under strict structured output). The model picked
 *      isProspect and then wrote a sentence justifying it. `whoIsSelling`
 *      now comes first, so the direction has to be settled before the
 *      verdict exists.
 *
 *   2. Nothing enforced the two against each other. "They are selling to
 *      us" and "they are a prospective customer" are opposite ends of one
 *      transaction, and classifyAsProspect now refuses to return both —
 *      in code, not as a request to the model. A warm, flattering,
 *      well-researched pitch is precisely the input that talks a model
 *      out of its own rule.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("openai", () => ({
  default: class {
    chat = { completions: { create } };
    audio = { transcriptions: { create } };
  },
}));

import { classifyAsProspect } from "@/lib/integrations/openai";

/** The real thread, as the founder received it. */
const photographerPitch = [
  {
    id: "m1",
    direction: "inbound" as const,
    channel: "email" as const,
    body:
      "Hi Sahil,\n\nThanks for the kind words about my work! I'd love to chat about your corporate party in " +
      "Etobicoke and discuss how we can capture the event. I'm available for a call anytime during the day " +
      "this week.\n\nLooking forward to connecting.\n\nBest,\nHenji Milius | Photographer/Videographer\n" +
      "Website: www.ioptixstudio.com",
    date: new Date().toISOString(),
    opened: false,
  },
];

const henji = { name: "Henji Milius", email: "oneoptixstudio@gmail.com" };
const business = { name: "FollowUp", industry: "Software" };

function modelSays(payload: Record<string, unknown>) {
  create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(payload) } }] });
}

beforeEach(() => {
  vi.stubEnv("OPENAI_API_KEY", "test-key");
  create.mockReset();
});

describe("a seller is never a lead, whatever the model says", () => {
  it("overrules the model when it calls a seller a prospect", async () => {
    // Exactly the failure that shipped: the model, charmed by a warm
    // pitch, marks it a prospect while still correctly identifying who is
    // selling. The old code returned that verdict untouched.
    modelSays({
      whoIsSelling: "sender is selling to this business",
      isProspect: true,
      reason: "Henji is enthusiastic about discussing the corporate party.",
    });

    const result = await classifyAsProspect(photographerPitch, henji, business);
    expect(result.isProspect).toBe(false);
  });

  it("keeps the model's own sentence, so the owner can see why it was filtered", async () => {
    modelSays({
      whoIsSelling: "sender is selling to this business",
      isProspect: true,
      reason: "Henji is a photographer offering to shoot the business's event.",
    });

    const result = await classifyAsProspect(photographerPitch, henji, business);
    expect(result.reason).toBe("Henji is a photographer offering to shoot the business's event.");
  });

  it("supplies a sentence when the model left one empty", async () => {
    modelSays({ whoIsSelling: "sender is selling to this business", isProspect: true, reason: "" });

    const result = await classifyAsProspect(photographerPitch, henji, business);
    expect(result.isProspect).toBe(false);
    expect(result.reason).toMatch(/offering their own services/);
  });

  it("passes a seller straight through when the model already said false", async () => {
    modelSays({ whoIsSelling: "sender is selling to this business", isProspect: false, reason: "A photographer pitching their services." });

    const result = await classifyAsProspect(photographerPitch, henji, business);
    expect(result).toEqual({ isProspect: false, reason: "A photographer pitching their services." });
  });
});

describe("a contradiction resolves toward the customer, and nothing else is promoted", () => {
  // "Not selling to us" does not make someone a customer — a newsletter and
  // a password reset are both "neither" — so "neither" is never promoted.
  // Only the model's own "sender wants to buy" is (found live 2026-09-25).
  it("keeps a sender the model itself says is asking about this business's work", async () => {
    modelSays({
      whoIsSelling: "sender wants to buy from this business",
      isProspect: false,
      reason: "The sender is asking about pricing for a service they want, indicating they are a customer.",
    });

    const result = await classifyAsProspect(photographerPitch, henji, business);
    expect(result).toEqual({
      isProspect: true,
      reason: "The sender is asking about pricing for a service they want, indicating they are a customer.",
    });
  });

  it("leaves a real customer alone", async () => {
    modelSays({
      whoIsSelling: "sender wants to buy from this business",
      isProspect: true,
      reason: "asking what a shoot for their wedding would cost",
    });

    const result = await classifyAsProspect(photographerPitch, henji, business);
    expect(result.isProspect).toBe(true);
  });

  it("does not promote a newsletter just because nobody is selling to us", async () => {
    modelSays({ whoIsSelling: "neither", isProspect: false, reason: "a marketing newsletter" });

    const result = await classifyAsProspect(photographerPitch, henji, business);
    expect(result.isProspect).toBe(false);
  });

  it("does not promote a personal email", async () => {
    modelSays({ whoIsSelling: "neither", isProspect: false, reason: "personal correspondence" });

    const result = await classifyAsProspect(photographerPitch, henji, business);
    expect(result.isProspect).toBe(false);
  });
});

describe("the question is asked before the verdict, and the prompt says so", () => {
  it("generates whoIsSelling first — field order is generation order", async () => {
    modelSays({ whoIsSelling: "sender wants to buy from this business", isProspect: true, reason: "asking about a shoot" });
    await classifyAsProspect(photographerPitch, henji, business);

    const schema = create.mock.calls[0][0].response_format.json_schema.schema;
    const fields = Object.keys(schema.properties);
    expect(fields[0]).toBe("whoIsSelling");
    expect(fields.indexOf("whoIsSelling")).toBeLessThan(fields.indexOf("isProspect"));
    expect(schema.required).toContain("whoIsSelling");
    // The reasoning is written before the verdict, so the two can't disagree
    // the way they did live on 2026-09-25.
    expect(fields.indexOf("reason")).toBeLessThan(fields.indexOf("isProspect"));
    expect(schema.required).toEqual(["whoIsSelling", "reason", "isProspect"]);
    // Labels that say which way the money goes. "the sender" read as "the
    // one paying" and filtered a customer asking a price (live 2026-09-25).
    expect(schema.properties.whoIsSelling.enum).toEqual([
      "sender is selling to this business",
      "sender wants to buy from this business",
      "neither",
    ]);
  });

  it("names the trades that read like customers, not just the B2B commodity list", async () => {
    modelSays({ whoIsSelling: "sender wants to buy from this business", isProspect: true, reason: "asking about a shoot" });
    await classifyAsProspect(photographerPitch, henji, business);

    const system = create.mock.calls[0][0].messages[0].content as string;
    // The specific miss: a creative service, which the old list of
    // insurance/software/financing could never have covered.
    expect(system).toMatch(/photographer/i);
    expect(system).toMatch(/videographer|designer|contractor|consultant/i);
    // And the tells that separate the two, since tone cannot.
    expect(system).toMatch(/whoIsSelling/);
    expect(system).toMatch(/competitor|subcontractor/i);
  });

  it("tells the model a warm tone is not evidence of a customer", async () => {
    modelSays({ whoIsSelling: "sender wants to buy from this business", isProspect: true, reason: "asking about a shoot" });
    await classifyAsProspect(photographerPitch, henji, business);

    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toMatch(/no exception for how warm/i);
  });
});

/**
 * The second half of the same incident.
 *
 * The reply FollowUp sent read: "I can confirm that we're actively
 * seeking a photographer for our outdoor corporate party in Etobicoke."
 * Nobody at the business had said any of that. Henji asserted it in a
 * cold email and the draft adopted it as the owner's own confirmed fact
 * — which is how a stranger's opener turns into a warm confirmed need,
 * and the stranger is the only one who gains.
 *
 * The drafting prompt already forbade inventing facts and already
 * refused a prior COMMITMENT the lead merely claimed. It said nothing
 * about a claimed SITUATION, which is what came through.
 */
describe("a sender's claim about the business is never confirmed back to them", () => {
  it("tells the follow-up drafter not to adopt a claim about the business", async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ subject: "Re: your note", body: "I'll come back to you." }) } }],
    });
    const { generateFollowUpMessage } = await import("@/lib/integrations/openai");
    await generateFollowUpMessage({ name: "Henji", conversation: photographerPitch });

    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toMatch(/asserts about the BUSINESS/);
    expect(system).toMatch(/never confirm it/);
    expect(system).toMatch(/I can confirm/);
  });

  it("tells the instant reply the same thing, since it is the one that sends unreviewed", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ reply: "Thanks — I'll come back to you." }) } }] });
    const { generateInstantReply } = await import("@/lib/integrations/openai");
    await generateInstantReply({
      leadFirstName: "Henji",
      ownerFirstName: "Sahil",
      inboundText: photographerPitch[0].body,
    });

    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toMatch(/not the same as agreeing it is true/);
    expect(system).toMatch(/never confirm it/);
  });
});

/**
 * The worst line in the whole thread, and the founder did not flag it.
 *
 * Henji's FIRST email, pulled from production on 2026-09-20, asked in as
 * many words: "Just confirming you're still looking for a photographer
 * and that this is a genuine inquiry on your end, not something
 * automated. Occasionally those come through, so I like to check before
 * diving in."
 *
 * FollowUp — automated — answered: "I can confirm that we're actively
 * seeking a photographer for our outdoor corporate party in Etobicoke."
 *
 * A person asked, directly and politely, whether they were talking to
 * software. The software said no. Everything else in this file costs a
 * lead or a confusing screen; this is the product lying on its owner's
 * behalf to the one person who thought to ask — and it is exactly what
 * CLAUDE.md means by "never designed as a spam tool, a scam".
 *
 * No wording makes an automated denial acceptable, so there is no
 * approved phrasing to test for. The rule is that the draft must never
 * contain one, and must hand the question to the human instead.
 */
describe("FollowUp never tells someone it isn't automated", () => {
  const areYouABot =
    "Just confirming this is a genuine inquiry on your end, not something automated. " +
    "Occasionally those come through, so I like to check before diving in.";

  it("forbids the denial in the follow-up drafter", async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ subject: "Re:", body: "Someone will come back to you." }) } }],
    });
    const { generateFollowUpMessage } = await import("@/lib/integrations/openai");
    await generateFollowUpMessage({
      name: "Henji",
      conversation: [{ ...photographerPitch[0], body: areYouABot }],
    });

    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toMatch(/never deny it/);
    expect(system).toMatch(/claim to be a person/);
    // The instruction has to name the alternative, or the model invents one.
    expect(system).toMatch(/comes back to them personally/);
  });

  it("forbids it in the instant reply, which sends with no review at all", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ reply: "I'll have someone come back to you." }) } }] });
    const { generateInstantReply } = await import("@/lib/integrations/openai");
    await generateInstantReply({ leadFirstName: "Henji", ownerFirstName: "Sahil", inboundText: areYouABot });

    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toMatch(/never deny it/);
    expect(system).toMatch(/never claim to be a person/);
  });
});

/**
 * "Will this be for a weekday or weekend?"
 *
 * An Instagram DM on the founder's own account, 2026-09-20. The lead had
 * said, twice and in full: "Hey is this still available?" FollowUp
 * replied "Checking on the status now. Will this be for a weekday or
 * weekend?" The lead's next message was "What do you mean".
 *
 * Nobody had mentioned days. On Instagram "is this available" points at
 * a post FollowUp cannot see, so it had no idea what "this" was and
 * invented a dimension to sound like it was making progress.
 *
 * A qualifying question is the worst place to guess, because it does not
 * read as a guess — it reads as the business knowing something about the
 * enquiry. DMs go through this same drafter (src/lib/dmDrafting.ts calls
 * generateFollowUpMessage), so the rule lives with the other
 * no-invention rules.
 */
describe("it never invents the question", () => {
  it("forbids qualifying on a detail the lead never raised", async () => {
    create.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify({ subject: "", body: "What are you asking about?" }) } }],
    });
    const { generateFollowUpMessage } = await import("@/lib/integrations/openai");
    await generateFollowUpMessage({
      name: "@sahildoes",
      conversation: [{ ...photographerPitch[0], channel: "instagram" as const, body: "Hey is this still available?" }],
    });

    const system = create.mock.calls[0][0].messages[0].content as string;
    expect(system).toMatch(/Never ask a qualifying question about a detail the lead has not raised/);
    // The dimensions it actually reached for, named so the rule is concrete.
    expect(system).toMatch(/dates, days, times/);
    // And the alternative, or the model invents one.
    expect(system).toMatch(/ask them plainly what they mean/);
  });
});
