/**
 * A DM draft that breaks a rule is written once more, and the second try
 * is told exactly what was wrong (founder, 2026-10-14). The retry used to
 * be the same request again, so the model tended to repeat the mistake
 * and the owner got a held draft to fix by hand.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Message } from "@/lib/types";

const { generate } = vi.hoisted(() => ({ generate: vi.fn() }));
vi.mock("@/lib/integrations/openai", () => ({ generateFollowUpMessage: generate }));

import { draftDm, retryNote } from "@/lib/dmDrafting";

const thread: Message[] = [
  { id: "m1", direction: "inbound", channel: "instagram", body: "Can I see the Danforth semi this weekend?", date: new Date("2026-10-06T12:00:00Z").toISOString() },
];
const reply = (body: string) => ({ subject: "", body, buttons: [] });
const hintOf = (call: number) => (generate.mock.calls[call][3] as { hint: string }).hint;

beforeEach(() => generate.mockReset());

describe("the second try is told what was wrong", () => {
  it("names the broken rule to the retry, and only to the retry", async () => {
    generate
      .mockResolvedValueOnce(reply("Happy to set that up for the Danforth semi, would Saturday or Sunday suit you better?"))
      .mockResolvedValueOnce(reply("Happy to look into the Danforth semi for this weekend, when would suit you best?"));
    const out = await draftDm("Sam", thread, [], undefined, "reply");
    expect(out.shapeFailed).toBeNull();
    expect(generate).toHaveBeenCalledTimes(2);
    expect(hintOf(0)).not.toMatch(/previous draft/);
    expect(hintOf(1)).toContain(hintOf(0));
    expect(hintOf(1)).toMatch(/previous draft of this message was refused/);
    expect(hintOf(1)).toMatch(/named a day, date or time of day that nobody in this conversation mentioned/);
  });

  it("still holds the draft when the retry breaks a rule too, and keeps the situation's id for the buttons", async () => {
    generate.mockResolvedValue(reply("Happy to set that up for the Danforth semi, would Saturday or Sunday suit you better?"));
    const out = await draftDm("Sam", thread, [], undefined, "reply");
    expect(out.shapeFailed).toBe("calendar");
    expect(generate).toHaveBeenCalledTimes(2);
    expect(out.quickReplies.question).toBe((generate.mock.calls[0][3] as { id: string }).id);
  });

  it("does not retry a draft that passed", async () => {
    generate.mockResolvedValue(reply("Happy to look into the Danforth semi for this weekend, when would suit you best?"));
    await draftDm("Sam", thread, [], undefined, "reply");
    expect(generate).toHaveBeenCalledTimes(1);
  });
});

describe("retryNote", () => {
  // Every rule checkDmDraftShape can fail (src/lib/dmDrafts.ts), the two
  // tone rules (src/lib/replyTone.ts) and every claim kind (src/lib/grounding.ts).
  const RULES = [
    "empty", "too_short", "too_long", "buttons_without_question", "two_questions", "question_not_last", "banned_closer",
    "pressure", "brag", "contact", "digits", "calendar", "availability", "booking", "done", "fee", "policy", "hours",
    "service", "confirm", "too_many_buttons", "empty_button", "button_too_long", "button_is_question", "duplicate_button",
    "two_exits", "single_yes_button",
  ];

  it.each(RULES)("says what was wrong for %s", (rule) => {
    expect(retryNote(rule)).not.toMatch(/broke one of the message rules above/);
  });

  it("a fee is to be confirmed, never stated", () => {
    expect(retryNote("fee")).toMatch(/what the business charges or who pays it.*confirmed instead/);
  });

  it("still asks for a fix on a rule it doesn't know", () => {
    expect(retryNote("something_new")).toMatch(/refused\. It broke one of the message rules above\. Write it again/);
  });
});
