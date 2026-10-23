import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { getClient, MODEL, withAiContext } from "@/lib/integrations/openaiClient";
import type { ReplyCase } from "@/lib/replyEval";

/**
 * Plan step 3 (research/product/2026-10-23-self-improving-loop.md): customer messages written for one waiting rule, so
 * the lesson test (src/lib/lessonTest.ts) can see whether the rule does its job, not only whether it broke anything.
 * The kind's fixed 20 messages rarely touch a narrow rule; these are about it. Two messages, and the first one said in
 * other words, so a rule that only works for one phrasing shows up.
 *
 * Written once per wording of the rule and kept on it (TrainingRule.testMessages), so every test of the same wording
 * uses the same messages. Invented messages, never a real customer's.
 */

/** Messages written for each rule, plus the first one reworded. */
export const RULE_MESSAGES = 2;
/** Rules a test writes messages for, in the order they were taught: each adds 3 messages, answered 3 times each way. */
export const MAX_TARGETED_RULES = 3;

export type RuleTestMessage = { text: string; asks: string[]; reworded: boolean };

const MAX_TEXT = 400;
const MAX_ASK = 160;

function clean(raw: unknown, reworded: boolean): RuleTestMessage | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { text?: unknown; asks?: unknown };
  const text = typeof r.text === "string" ? r.text.replace(/\s+/g, " ").trim().slice(0, MAX_TEXT) : "";
  if (!text) return null;
  const asks = Array.isArray(r.asks)
    ? r.asks.filter((a): a is string => typeof a === "string" && a.trim().length > 0).map((a) => a.trim().slice(0, MAX_ASK)).slice(0, 3)
    : [];
  return { text, asks, reworded };
}

/** The model's answer, checked: exactly RULE_MESSAGES messages and the reworded one, or nothing. */
export function parseWritten(raw: unknown): RuleTestMessage[] | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { messages?: unknown; reworded?: unknown };
  const messages = Array.isArray(r.messages) ? r.messages.slice(0, RULE_MESSAGES).map((m) => clean(m, false)) : [];
  const reworded = clean(r.reworded, true);
  if (messages.length !== RULE_MESSAGES || messages.some((m) => !m) || !reworded) return null;
  return [...(messages as RuleTestMessage[]), reworded];
}

/** What a rule keeps: the messages, for the wording (version) they were written for. */
export function storedFor(raw: unknown, version: number): RuleTestMessage[] | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { version?: unknown; messages?: unknown };
  if (r.version !== version || !Array.isArray(r.messages)) return null;
  const messages = r.messages.map((m) => clean(m, !!(m as { reworded?: unknown })?.reworded));
  return messages.length > 0 && messages.every((m) => m) ? (messages as RuleTestMessage[]) : null;
}

/** Writes the messages for one rule. Throws when the model call fails or its answer doesn't hold up. */
export async function writeRuleMessages(trade: string, rule: string): Promise<RuleTestMessage[]> {
  const client = getClient("write_rule_tests");
  const message = { type: "object", properties: { text: { type: "string" }, asks: { type: "array", items: { type: "string" } } }, required: ["text", "asks"], additionalProperties: false };
  const completion = await withAiContext({ tag: "test" }, () =>
    client.chat.completions.create({
      model: MODEL,
      temperature: 0.7,
      max_tokens: 500,
      messages: [
        {
          role: "system",
          content:
            "You write test messages for FollowUp, which drafts the replies a small business sends its customers on " +
            "Instagram. The business owner set a rule for those replies. Write " +
            `${RULE_MESSAGES} different first messages a customer of this kind of business might really send, where the ` +
            "rule clearly matters, so a reply shows whether it follows the rule. Each is one or two sentences in the " +
            "customer's own casual voice, with one concrete detail of theirs (a place, a home, a date, a budget). Then " +
            "write the first message again in different words with the same meaning. For each, list the questions the " +
            "customer asked, in plain words, one per question (none if they asked nothing). Invent everything: no real " +
            "person's name, email or phone number. Write in the language the rule is about; otherwise English.",
        },
        { role: "user", content: `KIND OF BUSINESS: ${trade}\nRULE: ${rule}` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "rule_test_messages",
          strict: true,
          schema: {
            type: "object",
            properties: { messages: { type: "array", items: message }, reworded: message },
            required: ["messages", "reworded"],
            additionalProperties: false,
          },
        },
      },
    })
  );
  const raw = completion.choices[0]?.message?.content;
  const written = raw ? parseWritten(JSON.parse(raw)) : null;
  if (!written) throw new Error("The test messages for a rule came back incomplete.");
  return written;
}

/** “Answer about the home first.”, cut to a heading's length. */
function quoted(rule: string): string {
  const t = rule.replace(/\s+/g, " ").trim();
  return `“${t.length > 60 ? `${t.slice(0, 59).trimEnd()}…` : t}”`;
}

/** One rule's messages as test cases (src/lib/replyEval.ts), named so the founder can tell them apart. */
export function casesForRule(rule: string, messages: readonly RuleTestMessage[]): ReplyCase[] {
  let n = 0;
  return messages.map((m) => ({
    name: `${quoted(rule)} · ${m.reworded ? "message 1, reworded" : `message ${++n}`}`,
    lines: [["in", m.text]],
    asks: m.asks,
    rule,
  }));
}

export type TargetRule = { id: string; text: string; version: number; testMessages: unknown };

/**
 * The cases for up to MAX_TARGETED_RULES waiting rules: their kept messages, or new ones written and kept now. A rule
 * whose messages can't be written is tested by the fixed set alone; that never stops the test.
 */
export async function targetedCases(trade: string, rules: readonly TargetRule[]): Promise<ReplyCase[]> {
  const picked = rules.slice(0, MAX_TARGETED_RULES);
  const perRule = await Promise.all(
    picked.map(async (r) => {
      const kept = storedFor(r.testMessages, r.version);
      if (kept) return casesForRule(r.text, kept);
      try {
        const messages = await writeRuleMessages(trade, r.text);
        await prisma.trainingRule.updateMany({
          where: { id: r.id, version: r.version },
          data: { testMessages: { version: r.version, messages } as unknown as Prisma.InputJsonValue },
        });
        return casesForRule(r.text, messages);
      } catch (err) {
        console.warn(`Couldn't write test messages for rule ${r.id}:`, err instanceof Error ? err.message : err);
        return [];
      }
    })
  );
  return perRule.flat();
}
