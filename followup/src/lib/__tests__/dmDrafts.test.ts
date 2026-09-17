/**
 * The DM shape (src/lib/dmDrafts.ts): which situation a draft is written
 * for is decided by facts in the thread, and whether the result is fit to
 * send is decided by a model-free check. Both are pinned here because the
 * prompt alone cannot guarantee either — a model told "one question" will
 * still write two on a bad day, and the check is what keeps that message
 * off the wire.
 */
import { describe, it, expect } from "vitest";
import { checkDmDraftShape, dmChannelOf, pickDmSituation, DM_SHAPE_RULES } from "@/lib/dmDrafts";
import type { Message } from "@/lib/types";

let n = 0;
function msg(direction: "inbound" | "outbound", body: string, extra: Partial<Message> = {}): Message {
  n++;
  return { id: `m${n}`, direction, channel: "instagram", body, date: new Date(1_700_000_000_000 + n * 60_000).toISOString(), ...extra };
}

describe("pickDmSituation — chosen from the thread, never guessed", () => {
  it("asks about timing when the lead asked a price and nobody has replied", () => {
    const s = pickDmSituation([msg("inbound", "How much for a two-bed clean?")], "reply");
    expect(s.id).toBe("price_unanswered");
    expect(s.hint).toMatch(/do not guess a price/i);
  });

  it("does not count the instant ack as a reply from the business", () => {
    const s = pickDmSituation(
      [msg("inbound", "How much for a two-bed clean?"), msg("outbound", "Got it, back to you shortly.", { trigger: "instant_ack" })],
      "reply"
    );
    expect(s.id).toBe("price_unanswered");
  });

  it("does not count an automated follow-up as a reply from the business either", () => {
    const s = pickDmSituation(
      [msg("inbound", "How much for a two-bed clean?"), msg("outbound", "Whole flat or just the kitchen?", { trigger: "unanswered" })],
      "reply"
    );
    expect(s.id).toBe("price_unanswered");
  });

  it("narrows availability when the lead asked for a day and nobody has replied", () => {
    expect(pickDmSituation([msg("inbound", "Do you have anything Saturday?")], "reply").id).toBe("availability_unanswered");
  });

  it("asks how soon for a general enquiry nobody has replied to", () => {
    expect(pickDmSituation([msg("inbound", "Do you do gutters?")], "reply").id).toBe("general_unanswered");
  });

  it("offers a slot or still-deciding once the business has sent a price", () => {
    const s = pickDmSituation([msg("inbound", "How much?"), msg("outbound", "It's $180 for the flat.", { trigger: "manual" })], "reply");
    expect(s.id).toBe("price_given_quiet");
    expect(s.hint).toMatch(/do not discount/i);
  });

  it("offers the exact times once the business has named slots", () => {
    const s = pickDmSituation([msg("inbound", "When could you come?"), msg("outbound", "I could do Sat 10am or Sun 2pm.")], "reply");
    expect(s.id).toBe("slots_named_quiet");
  });

  it("treats a reply synced from the owner's mail app (no trigger at all) as the business having replied", () => {
    const s = pickDmSituation([msg("inbound", "Can you help with a fence?"), msg("outbound", "Yes, I can come and look.")], "reply");
    expect(s.id).toBe("replied_quiet");
  });

  it("confirms and stops asking after a button tap", () => {
    const s = pickDmSituation(
      [msg("inbound", "How much?"), msg("outbound", "This week or this month?", { trigger: "unanswered" }), msg("inbound", "This week", { quickReplyPayload: "fu1;unanswered;price_unanswered;this_week;a" })],
      "reply"
    );
    expect(s.id).toBe("after_tap");
    expect(s.hint).toMatch(/Do not ask another question/);
  });

  it("asks for the least on the last message: price still wanted, or leave it", () => {
    const s = pickDmSituation([msg("inbound", "How much for a quote?")], "last");
    expect(s.id).toBe("price_last");
    expect(s.hint).toMatch(/No deadline/);
  });

  it("asks still-looking-or-sorted on the last message for anything else, and never says it is the last", () => {
    const s = pickDmSituation([msg("inbound", "Do you do gutters?")], "last");
    expect(s.id).toBe("interest_last");
    expect(s.hint).toMatch(/never tell them this is the last message/);
  });
});

describe("checkDmDraftShape — what may go out as a DM", () => {
  const thread = "How much for a two-bed clean on Saturday?";
  const good = { body: "Happy to price the two-bed clean. Is this for this week or later in the month?", buttons: [{ title: "This week", exit: false }, { title: "Later", exit: false }] };

  it("passes a short message with one question last and two plain buttons", () => {
    expect(checkDmDraftShape(good, thread)).toEqual({ ok: true });
  });

  it("refuses two questions", () => {
    expect(checkDmDraftShape({ ...good, body: "Is it a two-bed? And is this week ok?" }, thread)).toEqual({ ok: false, rule: "two_questions" });
  });

  it("refuses a question that is not the last sentence", () => {
    expect(checkDmDraftShape({ ...good, body: "Is this for this week? I can price the two-bed clean either way." }, thread)).toEqual({ ok: false, rule: "question_not_last" });
  });

  it("refuses buttons under a message that asks nothing", () => {
    expect(checkDmDraftShape({ ...good, body: "Happy to price the two-bed clean, I'll come back to you with a number today." }, thread)).toEqual({ ok: false, rule: "buttons_without_question" });
  });

  it("allows a statement with no buttons — the after-tap shape", () => {
    expect(checkDmDraftShape({ body: "This week it is, I'll confirm the Saturday slot and come back to you shortly.", buttons: [] }, thread)).toEqual({ ok: true });
  });

  it("refuses the closers that read as a bot", () => {
    expect(checkDmDraftShape({ ...good, body: "I can price the two-bed clean for you, let me know if you have any questions?" }, thread)).toEqual({ ok: false, rule: "banned_closer" });
    expect(checkDmDraftShape({ ...good, body: "I can price the two-bed clean this week for you, does that sound good?" }, thread)).toEqual({ ok: false, rule: "banned_closer" });
    expect(checkDmDraftShape({ ...good, body: "I can price the two-bed clean this week, are you interested?" }, thread)).toEqual({ ok: false, rule: "banned_closer" });
  });

  it("refuses a number nobody in the thread wrote", () => {
    expect(checkDmDraftShape({ ...good, body: "A two-bed clean is usually around 180, is this for this week?" }, thread)).toEqual({ ok: false, rule: "digits" });
  });

  it("allows a number the thread already contains", () => {
    expect(checkDmDraftShape({ ...good, body: "Saturday works for the two-bed, is 10am or 2pm better for you?" }, "How much for Saturday, 10am or 2pm?")).toEqual({ ok: true });
  });

  it("refuses too short and too long", () => {
    expect(checkDmDraftShape({ ...good, body: "This week?" }, thread)).toEqual({ ok: false, rule: "too_short" });
    expect(checkDmDraftShape({ ...good, body: `${"word ".repeat(31)}ok?` }, thread)).toEqual({ ok: false, rule: "too_long" });
  });

  it("judges a script written without spaces on characters, not words", () => {
    expect(checkDmDraftShape({ ...good, body: "ยินดีค่ะ เดี๋ยวจะแจ้งราคาให้ค่ะ สะดวกสัปดาห์นี้ไหมคะ?" }, thread)).toEqual({ ok: true });
  });

  it("refuses a link or an email address", () => {
    expect(checkDmDraftShape({ ...good, body: "Book at https://example.com for the two-bed clean, is this week ok?" }, thread)).toEqual({ ok: false, rule: "contact" });
  });

  it("refuses four buttons, an empty one, a long one, a duplicate, a question as a button, and two exits", () => {
    const b = (title: string, exit = false) => ({ title, exit });
    expect(checkDmDraftShape({ ...good, buttons: [b("A"), b("B"), b("C"), b("D")] }, thread)).toEqual({ ok: false, rule: "too_many_buttons" });
    expect(checkDmDraftShape({ ...good, buttons: [b(" "), b("B")] }, thread)).toEqual({ ok: false, rule: "empty_button" });
    expect(checkDmDraftShape({ ...good, buttons: [b("This is far too long for a chip"), b("B")] }, thread)).toEqual({ ok: false, rule: "button_too_long" });
    expect(checkDmDraftShape({ ...good, buttons: [b("Yes"), b("yes")] }, thread)).toEqual({ ok: false, rule: "duplicate_button" });
    expect(checkDmDraftShape({ ...good, buttons: [b("This week?"), b("Later")] }, thread)).toEqual({ ok: false, rule: "button_is_question" });
    expect(checkDmDraftShape({ ...good, buttons: [b("Not now", true), b("Leave it", true)] }, thread)).toEqual({ ok: false, rule: "two_exits" });
  });

  it("refuses a lone yes button — a yes/no question needs its honest no", () => {
    expect(checkDmDraftShape({ ...good, buttons: [{ title: "Yes", exit: false }] }, thread)).toEqual({ ok: false, rule: "single_yes_button" });
  });

  it("accepts fullwidth and Arabic question marks as the question", () => {
    expect(checkDmDraftShape({ ...good, body: "この二部屋の清掃のお見積りをお送りします、ご希望は今週ですか？" }, thread)).toEqual({ ok: true });
  });
});

describe("dmChannelOf", () => {
  it("is the channel of the lead's last message when that is Instagram or Messenger", () => {
    expect(dmChannelOf([msg("inbound", "hi", { channel: "email" }), msg("inbound", "hi", { channel: "messenger" })])).toBe("messenger");
    expect(dmChannelOf([msg("inbound", "hi", { channel: "instagram" }), msg("outbound", "x", { channel: "email" })])).toBe("instagram");
  });

  it("is null for email, SMS, WhatsApp, or no inbound at all", () => {
    expect(dmChannelOf([msg("inbound", "hi", { channel: "email" })])).toBeNull();
    expect(dmChannelOf([msg("inbound", "hi", { channel: "whatsapp" })])).toBeNull();
    expect(dmChannelOf([msg("outbound", "hi")])).toBeNull();
  });
});

describe("the shared rules the prompt repeats", () => {
  it("name the one question, the word range, the button limit and the banned closers", () => {
    expect(DM_SHAPE_RULES).toMatch(/Exactly one question/);
    expect(DM_SHAPE_RULES).toMatch(/8 to 30 words/);
    expect(DM_SHAPE_RULES).toMatch(/20 characters or fewer/);
    expect(DM_SHAPE_RULES).toMatch(/Never a deadline/);
    expect(DM_SHAPE_RULES).toMatch(/are you interested/);
  });
});

describe("the day-2–7 owner draft (handoff)", () => {
  it("names the gap, answers what it can, ends on one question with the way out inside it, and has no buttons", () => {
    const s = pickDmSituation([msg("inbound", "How much for a two-bed clean?"), msg("outbound", "Whole flat or just the kitchen?", { trigger: "unanswered" })], "handoff");
    expect(s.id).toBe("day2_7_owner");
    expect(s.hint).toMatch(/Name the gap/);
    expect(s.hint).toMatch(/Do not apologise/);
    expect(s.hint).toMatch(/never mention any window or limit/);
    expect(s.hint).toMatch(/Provide NO buttons/);
  });

  it("still confirms an answer tap first — a lead who tapped has replied, so nothing needs handing off", () => {
    const s = pickDmSituation([msg("inbound", "How much?"), msg("outbound", "This week or later?", { trigger: "unanswered" }), msg("inbound", "This week", { quickReplyPayload: "fu1;unanswered;price_unanswered;this_week;a" })], "handoff");
    expect(s.id).toBe("after_tap");
  });
});
