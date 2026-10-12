import { draftDm } from "@/lib/dmDrafting";
import { getClient, MODEL } from "@/lib/integrations/openaiClient";
import { mapWithConcurrency } from "@/lib/concurrency";
import { withRateLimitRetry, type RateLimitRetryOptions } from "@/lib/rateLimitRetry";
import type { FactLine } from "@/lib/factLines";
import type { Message } from "@/lib/types";

/**
 * How good FollowUp's Instagram and Messenger replies are: a fixed set of
 * realtor DMs, each drafted by the REAL drafter (draftDm, the same call a
 * live DM gets, shape check and one retry included), then checked.
 *
 * Founder, 2026-10-12: "make the judgement more accurate, and the
 * qualification plus the replies that we are sending." The replies had
 * no test that reads what the model actually writes; the unit tests mock
 * it.
 *
 * What a reply must do, from the rules the founder has set:
 *  - answer every question the customer asked, or say plainly the owner
 *    will confirm (A-231: "their questions come first… cover every one");
 *  - never state a price, time, availability or listing detail nobody gave
 *    it (CLAUDE.md, trust; the price placeholder stands in for a price);
 *  - write in the customer's language (founder, 2026-09: "whatever language
 *    the lead will approach, we will reply in the same language");
 *  - never hand their words back as a one-line verdict ("Noted.", A-231);
 *  - pass the DM shape rules (short, one question, last).
 *
 * The shape and the verdict are checked by code. "Answered every
 * question", "invented nothing" and "same language" need reading, so a
 * second model call grades them against a written checklist. That grader
 * can be wrong too; a failure lists the reply so a person can look.
 *
 * Every case is invented. To run it: POST /api/admin/reply-eval, or the
 * Run button on /admin.
 */

export type ReplyCase = {
  name: string;
  /** The chat, oldest first: "in" is the customer, "out" the business. */
  lines: ["in" | "out", string][];
  /** What the customer asked, in plain words, one per question. */
  asks: string[];
  /** What the business has told customers, if anything (Settings → What FollowUp knows). */
  facts?: FactLine[];
  /** Words the reply must contain because a fact gives them (e.g. "2.5%"). */
  mustInclude?: string[];
};

const FACTS: FactLine[] = [
  { label: "Commission", value: "My commission is 2.5% when I sell your home." },
  { label: "Area", value: "I work across the GTA, mostly Brampton, Mississauga and Toronto." },
];

export const REPLY_CASES: ReplyCase[] = [
  {
    name: "fee and availability, nothing known",
    lines: [["in", "how much do you charge and are you free this week?"]],
    asks: ["how much the agent charges", "whether the agent is free this week"],
  },
  {
    name: "fee and availability, fee known",
    lines: [["in", "how much do you charge and are you free this week?"]],
    asks: ["how much the agent charges", "whether the agent is free this week"],
    facts: FACTS,
    mustInclude: ["2.5%"],
  },
  { name: "is a listing available", lines: [["in", "Is the condo on King St still available?"]], asks: ["whether the King St condo is still available"] },
  { name: "area, known", lines: [["in", "Do you work in Mississauga?"]], asks: ["whether the agent works in Mississauga"], facts: FACTS },
  { name: "area, not known", lines: [["in", "Do you work in Etobicoke?"]], asks: ["whether the agent works in Etobicoke"] },
  {
    name: "two questions about a listing",
    lines: [["in", "What's the price of 14 Birch Lane and does it have parking?"]],
    asks: ["the price of 14 Birch Lane", "whether it has parking"],
  },
  {
    name: "buyer gives details, asks for help",
    lines: [["in", "Hi, we're pre-approved for 650k and want a 3 bed in Brampton. Can you help?"]],
    asks: ["whether the agent can help them find a 3-bed in Brampton"],
  },
  {
    name: "Hinglish: commission to sell",
    lines: [["in", "Bhai commission kitna loge? Brampton mein ghar bechna hai"]],
    asks: ["how much commission the agent takes to sell their house"],
    facts: FACTS,
    mustInclude: ["2.5%"],
  },
  { name: "asks for a viewing time", lines: [["in", "Can I see the townhouse on Saturday at 11?"]], asks: ["whether they can see the townhouse on Saturday at 11"] },
  { name: "buyer's fee", lines: [["in", "Do you charge buyers anything?"]], asks: ["whether buyers pay the agent anything"] },
  { name: "experience", lines: [["in", "How long have you been a realtor?"]], asks: ["how long the agent has been a realtor"] },
  {
    name: "follow-up questions after the business wrote first",
    lines: [
      ["out", "Hi! Thanks for reaching out about the house on Maple Ave."],
      ["in", "What's the lot size? And is the basement finished?"],
    ],
    asks: ["the lot size", "whether the basement is finished"],
  },
  { name: "wants to talk today", lines: [["in", "Are you available to talk today?"]], asks: ["whether the agent can talk today"] },
  {
    name: "Spanish: price and area",
    lines: [["in", "Hola, ¿cuánto cobras por vender una casa? ¿Trabajas en Brampton?"]],
    asks: ["how much the agent charges to sell a house", "whether the agent works in Brampton"],
    facts: FACTS,
    mustInclude: ["2.5"],
  },
];

export type ReplyProblem = "shape" | "unanswered" | "invented" | "language" | "missing_fact" | "echo";

export type ReplyEvalResult = {
  cases: number;
  passed: number;
  errors: number;
  problems: Record<ReplyProblem, number>;
  failures: { name: string; problems: ReplyProblem[]; reply: string; detail: string }[];
};

type Grade = { answered: boolean[]; invented: boolean; inventedWhat: string; sameLanguage: boolean };
export type Grader = (c: ReplyCase, reply: string) => Promise<Grade>;
type Drafter = typeof draftDm;

function toConversation(lines: ReplyCase["lines"]): Message[] {
  const start = Date.UTC(2026, 9, 1, 16);
  return lines.map(([who, body], i) => ({
    id: `r${i}`,
    direction: who === "in" ? "inbound" : "outbound",
    channel: "instagram",
    body,
    date: new Date(start + i * 60_000).toISOString(),
    opened: false,
  }));
}

/** "Noted.", "Got it," as the reply's opening word: their words handed back as a verdict (A-231). */
const ECHO_RE = /^(?:noted|got it)\b[.!,]?/i;

/**
 * Reads one reply against its checklist. Temperature 0 so the same reply
 * gets the same grade.
 */
export const gradeReply: Grader = async (c, reply) => {
  const client = getClient();
  const facts = (c.facts ?? []).map((f) => `- ${f.label}: ${f.value}`).join("\n") || "(none)";
  const chat = c.lines.map(([who, text]) => `${who === "in" ? "CUSTOMER" : "BUSINESS"}: ${text}`).join("\n");
  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 300,
    messages: [
      {
        role: "system",
        content:
          "You check a reply a small business is about to send to a customer on Instagram. You only grade; you never rewrite.\n\n" +
          "answered: one entry per numbered question, in order. true when the reply answers it, or says plainly the " +
          "business will check or confirm it. false when the reply ignores it or changes the subject.\n" +
          "invented: true when the reply states as fact any specific detail (a price, fee, number, date, time, " +
          "availability, listing detail, experience, policy) that appears neither in the conversation nor in the " +
          "BUSINESS FACTS. A placeholder such as [PRICE] is not invented. inventedWhat: that detail, or empty.\n" +
          "sameLanguage: true when the reply is in the same language as the customer's last message (Hinglish " +
          "answered in Hinglish or English both count as the same).",
      },
      {
        role: "user",
        content:
          `CONVERSATION:\n${chat}\n\nBUSINESS FACTS:\n${facts}\n\nQUESTIONS THE CUSTOMER ASKED:\n` +
          c.asks.map((a, i) => `${i + 1}. ${a}`).join("\n") +
          `\n\nREPLY TO CHECK:\n${reply}`,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "reply_grade",
        strict: true,
        schema: {
          type: "object",
          properties: {
            answered: { type: "array", items: { type: "boolean" } },
            invented: { type: "boolean" },
            inventedWhat: { type: "string" },
            sameLanguage: { type: "boolean" },
          },
          required: ["answered", "invented", "inventedWhat", "sameLanguage"],
          additionalProperties: false,
        },
      },
    },
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("The grader returned nothing.");
  const g = JSON.parse(raw) as Grade;
  return { answered: Array.isArray(g.answered) ? g.answered : [], invented: !!g.invented, inventedWhat: String(g.inventedWhat ?? ""), sameLanguage: !!g.sameLanguage };
};

/** Two at a time: each case is up to three model calls (a draft, a retry, a grade). */
export const REPLY_EVAL_CONCURRENCY = 2;

export async function runReplyEval(
  draft: Drafter = draftDm,
  grade: Grader = gradeReply,
  cases = REPLY_CASES,
  options: { retry?: RateLimitRetryOptions } = {}
): Promise<ReplyEvalResult> {
  const result: ReplyEvalResult = {
    cases: cases.length,
    passed: 0,
    errors: 0,
    problems: { shape: 0, unanswered: 0, invented: 0, language: 0, missing_fact: 0, echo: 0 },
    failures: [],
  };
  await mapWithConcurrency(cases, REPLY_EVAL_CONCURRENCY, async (c) => {
    try {
      // The same call a live DM reply makes (automation.ts, scoring.ts), for a realtor.
      const drafted = await withRateLimitRetry(
        () => draft("Sam", toConversation(c.lines), [], undefined, "reply", null, c.facts ?? [], null, "Real estate"),
        options.retry
      );
      const reply = drafted.body.trim();
      const g = await withRateLimitRetry(() => grade(c, reply), options.retry);

      const problems: ReplyProblem[] = [];
      const details: string[] = [];
      if (drafted.shapeFailed) {
        problems.push("shape");
        details.push(`shape rule: ${drafted.shapeFailed}`);
      }
      if (ECHO_RE.test(reply)) problems.push("echo");
      const missed = c.asks.filter((_, i) => g.answered[i] !== true);
      if (missed.length) {
        problems.push("unanswered");
        details.push(`not answered: ${missed.join("; ")}`);
      }
      if (g.invented) {
        problems.push("invented");
        details.push(`invented: ${g.inventedWhat}`);
      }
      if (!g.sameLanguage) problems.push("language");
      const absent = (c.mustInclude ?? []).filter((w) => !reply.includes(w));
      if (absent.length) {
        problems.push("missing_fact");
        details.push(`missing: ${absent.join(", ")}`);
      }

      for (const p of problems) result.problems[p] += 1;
      if (problems.length === 0) result.passed += 1;
      else result.failures.push({ name: c.name, problems, reply, detail: details.join(" · ") });
    } catch (err) {
      result.errors += 1;
      result.failures.push({ name: c.name, problems: [], reply: "", detail: err instanceof Error ? err.message : "unknown error" });
    }
  });
  return result;
}
