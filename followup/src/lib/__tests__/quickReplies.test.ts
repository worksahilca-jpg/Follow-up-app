/**
 * The reply-button payload is what turns a tap into an answer FollowUp can
 * act on (src/lib/quickReplies.ts). These pin the round trip, the refusal
 * of anything FollowUp did not write, and Meta's limits at the boundary.
 */
import { describe, it, expect } from "vitest";
import {
  answerKey,
  decodeQuickReplyPayload,
  encodeQuickReplyPayload,
  isExitPayload,
  toQuickReplies,
  validateQuickReplies,
  quickRepliesForGraph,
  QUICK_REPLY_MAX_COUNT,
  QUICK_REPLY_PAYLOAD_MAX_CHARS,
  QUICK_REPLY_TITLE_MAX_CHARS,
} from "@/lib/quickReplies";

describe("payload round trip", () => {
  it("encodes touch, question, answer and the exit flag, and decodes them back", () => {
    const payload = encodeQuickReplyPayload({ touch: "unanswered", question: "price_unanswered", answer: "this_week", exit: false });
    expect(decodeQuickReplyPayload(payload)).toEqual({ touch: "unanswered", question: "price_unanswered", answer: "this_week", exit: false });
    expect(isExitPayload(payload)).toBe(false);
  });

  it("marks the honest-no chip as the exit", () => {
    const payload = encodeQuickReplyPayload({ touch: "unanswered", question: "interest_last", answer: "not_now", exit: true });
    expect(isExitPayload(payload)).toBe(true);
    expect(decodeQuickReplyPayload(payload)?.exit).toBe(true);
  });

  it("refuses anything it did not write: another tool's payload, garbage, nothing", () => {
    expect(decodeQuickReplyPayload("QR_BOOK")).toBeNull();
    expect(decodeQuickReplyPayload("fu1;only;three")).toBeNull();
    expect(decodeQuickReplyPayload("fu2;a;b;c;x")).toBeNull();
    expect(decodeQuickReplyPayload("fu1;a;b;c;maybe")).toBeNull();
    expect(decodeQuickReplyPayload(null)).toBeNull();
    expect(decodeQuickReplyPayload(undefined)).toBeNull();
    expect(isExitPayload("QR_LATER")).toBe(false);
  });

  it("cannot be broken by a separator inside a field", () => {
    const payload = encodeQuickReplyPayload({ touch: "unanswered", question: "a;b", answer: "c;d", exit: false });
    const decoded = decodeQuickReplyPayload(payload);
    expect(decoded).not.toBeNull();
    expect(decoded?.question).not.toContain(";");
  });

  it("stays well inside Meta's payload limit however long the inputs", () => {
    const payload = encodeQuickReplyPayload({ touch: "x".repeat(500), question: "y".repeat(500), answer: "z".repeat(500), exit: false });
    expect(payload.length).toBeLessThanOrEqual(QUICK_REPLY_PAYLOAD_MAX_CHARS);
    expect(decodeQuickReplyPayload(payload)).not.toBeNull();
  });
});

describe("answerKey", () => {
  it("reduces a title to a stable key, in any script", () => {
    expect(answerKey("Sat 10am")).toBe("sat_10am");
    expect(answerKey("  Not now! ")).toBe("not_now");
    expect(answerKey("सुबह")).toBe("सुबह");
  });
});

describe("toQuickReplies", () => {
  it("tags every chip with the send's own trigger and the question it answers", () => {
    const chips = toQuickReplies(
      { question: "availability_unanswered", buttons: [{ title: "Morning", exit: false }, { title: "Afternoon", exit: false }, { title: "Either", exit: false }] },
      "unanswered"
    );
    expect(chips.map((c) => c.title)).toEqual(["Morning", "Afternoon", "Either"]);
    for (const c of chips) {
      const decoded = decodeQuickReplyPayload(c.payload);
      expect(decoded?.touch).toBe("unanswered");
      expect(decoded?.question).toBe("availability_unanswered");
    }
    expect(decodeQuickReplyPayload(chips[0].payload)?.answer).toBe("morning");
  });

  it("never sends more than three chips even if more were stored", () => {
    const stored = { question: "q", buttons: Array.from({ length: 6 }, (_, i) => ({ title: `Option ${i}`, exit: false })) };
    expect(toQuickReplies(stored, "unanswered")).toHaveLength(3);
  });
});

describe("validateQuickReplies — Meta's limits at the boundary", () => {
  const ok = (title: string) => ({ title, payload: "fu1;t;q;a;a" });

  it("passes a normal set through, trimmed", () => {
    const result = validateQuickReplies([ok(" Morning "), ok("Afternoon")]);
    expect(result).toEqual({ ok: true, quickReplies: [{ title: "Morning", payload: "fu1;t;q;a;a" }, { title: "Afternoon", payload: "fu1;t;q;a;a" }] });
  });

  it("treats no chips as fine", () => {
    expect(validateQuickReplies(undefined)).toEqual({ ok: true, quickReplies: undefined });
    expect(validateQuickReplies([])).toEqual({ ok: true, quickReplies: undefined });
  });

  it(`refuses more than ${QUICK_REPLY_MAX_COUNT} chips`, () => {
    const result = validateQuickReplies(Array.from({ length: QUICK_REPLY_MAX_COUNT + 1 }, (_, i) => ok(`c${i}`)));
    expect(result.ok).toBe(false);
  });

  it(`refuses a title over ${QUICK_REPLY_TITLE_MAX_CHARS} characters — Instagram truncates it silently, Messenger may reject it`, () => {
    const result = validateQuickReplies([ok("a".repeat(QUICK_REPLY_TITLE_MAX_CHARS + 1))]);
    expect(result.ok).toBe(false);
    expect(validateQuickReplies([ok("a".repeat(QUICK_REPLY_TITLE_MAX_CHARS))]).ok).toBe(true);
  });

  it("refuses an empty title, a missing payload, an over-long payload, and two chips that say the same thing", () => {
    expect(validateQuickReplies([ok("  ")]).ok).toBe(false);
    expect(validateQuickReplies([{ title: "Yes", payload: "" }]).ok).toBe(false);
    expect(validateQuickReplies([{ title: "Yes", payload: "p".repeat(QUICK_REPLY_PAYLOAD_MAX_CHARS + 1) }]).ok).toBe(false);
    expect(validateQuickReplies([ok("Yes"), ok("yes")]).ok).toBe(false);
  });

  it("renders the exact Graph shape: content_type text, title, payload", () => {
    expect(quickRepliesForGraph([{ title: "Yes", payload: "p" }])).toEqual([{ content_type: "text", title: "Yes", payload: "p" }]);
  });
});
