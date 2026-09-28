/**
 * Reply truth (audit 2026-09-28). Every sentence below is a draft that
 * passed every deterministic guard at 7e68500 — none contains a digit, and
 * where it names a day the LEAD named it first. What is invented is the
 * assertion: it is available, you're booked, it's free, we're open, I sent
 * it. Only the owner states those.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("@/lib/integrations/openaiClient", () => ({
  MODEL: "test-model",
  TRANSCRIBE_MODEL: "test-transcribe",
  getClient: () => ({ chat: { completions: { create } } }),
}));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/sender", () => ({ composeFollowUpEmail: vi.fn(), getSenderFirstName: vi.fn(), latestInboundText: vi.fn() }));
vi.mock("@/lib/sending", () => ({ sendFollowUpToLead: vi.fn(), detectAutomatedReplyChannel: vi.fn() }));
vi.mock("@/lib/audit", () => ({ recordAudit: vi.fn() }));

import { unconfirmedClaim, ungroundedCalendarWords, ungroundedSpecifics } from "@/lib/grounding";
import { checkDmDraftShape, businessText } from "@/lib/dmDrafts";
import { checkAckShape } from "@/lib/acknowledge";
import { isSafeToSendInBulk } from "@/lib/approvalGroups";
import { HOLD_ALL_AUTOMATION_REASON } from "@/lib/holdReasons";
import { rewriteReply } from "@/lib/integrations/openai";
import type { Message } from "@/lib/types";

beforeEach(() => {
  create.mockReset();
  process.env.OPENAI_API_KEY = "test";
});

describe("unconfirmedClaim — what only the owner can say", () => {
  it.each([
    ["availability", "Yes, it's still on the market. Want to book a viewing?"],
    ["availability", "Good news, it hasn't been rented yet."],
    ["availability", "We can fit you in this week. Morning or afternoon?"],
    ["availability", "Only a few left, so I'd grab one soon."],
    ["availability", "Yes, the 2 bedroom condo is still available, would you like to see it?"],
    ["availability", "Sí, está disponible, ¿quieres verlo?"],
    ["availability", "Sí, todavía está libre. ¿Quieres verlo?"],
    ["booking", "Perfect, you're booked for Saturday. See you then!"],
    ["booking", "Listo, te esperamos el sábado."],
    ["booking", "Done, I've put you down for next week."],
    ["done", "I've sent you the details by email."],
    ["done", "Ya te envié la información por correo."],
    ["done", "As we discussed, the quote covers the whole deck."],
    ["policy", "Estimates are free, no obligation."],
    ["policy", "No problem, it's fully refundable if you cancel."],
    ["policy", "El presupuesto es gratis y sin compromiso."],
    ["hours", "Yes, we're open now until late."],
    ["service", "Yes, we cover Brampton. What kind of job is it?"],
  ])("%s: %s", (kind, draft) => {
    expect(unconfirmedClaim(draft, "")).toBe(kind);
  });

  it.each([
    "Checking on the status now, what is it you're asking about?",
    "Got it, I'll check on availability and come back to you shortly.",
    "I'll confirm availability for next week and send you pricing shortly.",
    "Good question, I'll get you the warranty details shortly.",
    "I'll confirm our Sunday hours and get back to you shortly.",
    "Saturday could work, I'll confirm once I've checked the calendar.",
    "I haven't sent the quote yet, I'll have it to you shortly.",
    "Voy a revisar si sigue disponible y te aviso pronto.",
    "Is it still available for you this week?",
    "No problem at all, what time would suit you instead?",
    "If it's still available, would you like to see it this week?",
    "Just to check, is it still available for you?",
    "If you're free this week, want to come by?",
    "I'm open to other times too, what suits you?",
  ])("states nothing: %s", (draft) => {
    expect(unconfirmedClaim(draft, "")).toBeNull();
  });

  it("is grounded by the owner saying it", () => {
    expect(unconfirmedClaim("Yes, it's still available. Want to see it?", "It's available from October.")).toBeNull();
    expect(unconfirmedClaim("Estimates are free, want one?", "Our estimates are free.")).toBeNull();
  });

  it("is NOT grounded by the owner saying they'd check — the word alone used to be enough", () => {
    expect(unconfirmedClaim("Great, the condo is available this month.", "Let me check if the condo is still available.")).toBe("availability");
  });

  it("is NOT grounded by the owner saying the opposite", () => {
    expect(unconfirmedClaim("Yes, the condo is still available.", "Sorry, the condo is no longer available.")).toBe("availability");
    expect(unconfirmedClaim("Sorry, it's no longer available.", "Sorry, the condo is no longer available.")).toBeNull();
  });
});

describe("businessText — only what a person at the business said", () => {
  const m = (direction: "inbound" | "outbound", body: string, extra: Partial<Message> = {}): Message => ({
    id: body,
    direction,
    channel: "instagram",
    body,
    date: new Date().toISOString(),
    ...extra,
  });

  it("leaves out FollowUp's automated sends and the phone assistant", () => {
    const text = businessText([
      m("inbound", "Is it available?"),
      m("outbound", "Yes it is available!", { trigger: "unanswered" }),
      m("outbound", "It's available.", { channel: "voice-agent" as Message["channel"] }),
      m("outbound", "Owner typed this.", { trigger: "manual" }),
      m("outbound", "Synced from Gmail."),
    ]);
    expect(text).toBe("Owner typed this.\nSynced from Gmail.");
  });
});

describe("a price with no digit in it", () => {
  it("is still a price", () => {
    expect(ungroundedSpecifics("It's fifty dollars for the visit.", "How much is a visit?")).toBe("currency");
    expect(ungroundedSpecifics("Son cien pesos la consulta.", "¿Cuánto cuesta?", "es")).toBe("currency");
    expect(ungroundedSpecifics("Happy to price it, what size is the room?", "How much?")).toBeNull();
  });
});

describe("the calendar rule", () => {
  it("catches today and tomorrow in any language Intl knows — a callback promise", () => {
    expect(ungroundedCalendarWords("I'll give you a call tomorrow morning.", "Can someone call me?")).toContain("tomorrow");
    expect(ungroundedCalendarWords("Te llamo mañana.", "¿Me llaman?", "es")).toContain("mañana");
    expect(ungroundedCalendarWords("હું આવતીકાલે ફોન કરીશ", "કૉલ કરો", "gu")).toContain("આવતીકાલે");
    expect(ungroundedSpecifics("I'll call you in an hour.", "Can someone call me?")).toBe("calendar");
  });

  it("does not read the English word 'may' as the month — only 'May' is", () => {
    expect(ungroundedCalendarWords("You may want to bring photos of the damage.", "Hello")).toEqual([]);
    expect(ungroundedCalendarWords("We could start in May.", "Hello")).toEqual(["may"]);
  });
});

describe("DM buttons are customer-facing words too", () => {
  it("refuses a chip that offers a slot nobody named", () => {
    const shape = checkDmDraftShape(
      { body: "Happy to show you the 2 bed, which of these suits you best?", buttons: [{ title: "Sat 10am", exit: false }, { title: "Not now", exit: true }] },
      "Can I see the 2 bed?",
      "en",
      ""
    );
    expect(shape).toEqual({ ok: false, rule: "digits" });
  });
});

describe("the instant reply (AUTONOMOUS skips the model judge)", () => {
  it("refuses a first reply that says it is available", () => {
    const shape = checkAckShape("Yes, the condo is still available, I'll send the details shortly.", "Is the condo still available?", "Sahil");
    expect(shape).toEqual({ ok: false, rule: "availability" });
  });

  it("still allows naming the topic", () => {
    expect(checkAckShape("Thanks for asking about the condo, I'll check availability and come back to you shortly.", "Is the condo still available?", "Sahil")).toEqual({ ok: true });
  });
});

describe("the routine pile", () => {
  const routine = { reason: HOLD_ALL_AUTOMATION_REASON, draftRiskLevel: "low" };
  it("never contains a draft that states availability, a booking, a policy or a price, whatever the judge said", () => {
    expect(isSafeToSendInBulk({ ...routine, draftMessage: "Yes, it is available. Do you want to schedule it?" })).toBe(false);
    expect(isSafeToSendInBulk({ ...routine, draftMessage: "Hi,\n\nThe consultation is $100.\n\nBest,\nSam" })).toBe(false);
    expect(isSafeToSendInBulk({ ...routine, draftMessage: "Estimates are free, want one?" })).toBe(false);
  });
  it("still offers an ordinary nudge", () => {
    expect(isSafeToSendInBulk({ ...routine, draftMessage: "Still thinking about the kitchen? Happy to answer anything." })).toBe(true);
  });
});

describe("rewriteReply may not add a fact", () => {
  it("keeps the owner's words when the rewrite adds a claim", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: "¡Claro! Está disponible y la visita es gratis." } }] });
    const out = await rewriteReply("Thanks, I'll check and get back to you.", "language", [], { language: "es" });
    expect(out).toBe("Thanks, I'll check and get back to you.");
  });

  it("keeps the owner's words when the rewrite adds a figure", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: "Gracias, el precio es $80." } }] });
    expect(await rewriteReply("Thanks, I'll send the price soon.", "language", [], { language: "es" })).toBe("Thanks, I'll send the price soon.");
  });

  it("passes a faithful rewrite", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: "Gracias, lo reviso y te respondo." } }] });
    expect(await rewriteReply("Thanks, I'll check and get back to you.", "language", [], { language: "es" })).toBe("Gracias, lo reviso y te respondo.");
  });
});

describe("ordinary follow-up wording stays routine", () => {
  // Reviewed before merge: two honest lines a follow-up uses all the time
  // were being held as invented.
  it("lets a follow-up mention the message it already sent", () => {
    const draft = "Just following up on the email I sent last week. Are you still looking?";
    expect(unconfirmedClaim(draft, "", { sentBefore: true })).toBeNull();
    // With nothing sent yet, the same sentence is invented.
    expect(unconfirmedClaim(draft, "")).toBe("done");
  });

  it("still catches a call or a booking alongside a true 'I sent'", () => {
    expect(unconfirmedClaim("I called you this morning but couldn't get through.", "", { sentBefore: true })).toBe("done");
    expect(unconfirmedClaim("I've sent you the details and booked you in for Saturday.", "", { sentBefore: true })).toBe("booking");
  });

  it("reads 'hope to see you soon' as a wish, not a booking", () => {
    expect(unconfirmedClaim("Hope to see you soon!", "")).toBeNull();
    expect(unconfirmedClaim("Looking forward to seeing you there.", "")).toBeNull();
    expect(unconfirmedClaim("See you Saturday!", "")).toBe("booking");
  });
});
