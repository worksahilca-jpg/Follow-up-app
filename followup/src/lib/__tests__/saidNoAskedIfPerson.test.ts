/**
 * Situations audit (founder, 2026-10-06): reading each new message also
 * notes whether it said no, or asked if they're talking to a real person.
 * Both are stored against that message's time and cleared when the next
 * message doesn't say it, so a customer who writes again is read again.
 * The reminder and hold rules that use them are tested in automation.test.ts
 * and draftOnlyWhatCanSend.test.ts.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const create = vi.fn();
vi.mock("@/lib/integrations/openaiClient", () => ({
  MODEL: "test-model",
  TRANSCRIBE_MODEL: "test-transcribe",
  getClient: () => ({ chat: { completions: { create } } }),
}));

import { scoreLead } from "@/lib/integrations/openai";
import { plainHoldReason, ASKED_IF_PERSON_REASON } from "@/lib/holdReasons";

const answer = (extra: Record<string, unknown>) =>
  create.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ reason: "r", factors: [], score: 20, ...extra }) } }] });
const lead = { conversation: [], dealValue: 0, lastContacted: new Date().toISOString() };

beforeEach(() => create.mockReset());

describe("reading the newest message", () => {
  it("asks for both, as part of the score it already pays for", async () => {
    answer({ saysNo: false, asksIfAutomated: false });
    await scoreLead(lead);
    expect(create).toHaveBeenCalledTimes(1);
    const call = create.mock.calls[0][0];
    expect(call.response_format.json_schema.schema.required).toEqual(expect.arrayContaining(["saysNo", "asksIfAutomated"]));
    expect(call.messages[0].content).toMatch(/A hesitation or 'not right now' is not a no/);
  });

  it("passes both through", async () => {
    answer({ saysNo: true, asksIfAutomated: true });
    expect(await scoreLead(lead)).toEqual(expect.objectContaining({ saysNo: true, asksIfAutomated: true }));
  });

  it("reads anything but a plain true as no", async () => {
    answer({ saysNo: "yes", asksIfAutomated: 1 });
    expect(await scoreLead(lead)).toEqual(expect.objectContaining({ saysNo: false, asksIfAutomated: false }));
    answer({});
    expect(await scoreLead(lead)).toEqual(expect.objectContaining({ saysNo: false, asksIfAutomated: false }));
  });
});

describe("what the owner reads", () => {
  it("says who asked and that this one is theirs", () => {
    expect(plainHoldReason(ASKED_IF_PERSON_REASON, { firstName: "Ivy" })).toBe(
      "Ivy asked if they're talking to a real person. Answer this one yourself."
    );
  });
});
