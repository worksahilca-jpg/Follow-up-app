import { draftDm } from "@/lib/dmDrafting";
import { salesPressure } from "@/lib/replyTone";
import { getClient, MODEL, withAiContext } from "@/lib/integrations/openaiClient";
import { mapWithConcurrency } from "@/lib/concurrency";
import { withRateLimitRetry, type RateLimitRetryOptions } from "@/lib/rateLimitRetry";
import type { FactLine } from "@/lib/factLines";
import type { Message } from "@/lib/types";
import type { OwnerExampleLine } from "@/lib/ownerExampleLines";
import { PROMPT_EXAMPLES } from "@/lib/ownerExampleLines";
import { getTrainingExamples, TRAINING_IN_PROMPT } from "@/lib/training";
import { getTrainingRules } from "@/lib/trainingRules";

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
 *  - pass the DM shape rules (short, one question, last);
 *  - read like a person who read their message, never a salesperson or a
 *    bot (A-247, the trust research's eight rules): a detail of theirs, no
 *    pressure, no self-praise, their feeling acknowledged when they named
 *    one and never invented, and a "no" answered with a warm close.
 *
 * The shape and the verdict are checked by code. "Answered every
 * question", "invented nothing" and "same language" need reading, so a
 * second model call grades them against a written checklist. That grader
 * can be wrong too; a failure lists the reply so a person can look.
 *
 * Every case is invented. To run it: POST /api/admin/reply-eval, or the
 * Run button on /admin.
 *
 * A-319 (2026-10-23): each reply is drafted the way a live realtor's is, with
 * the founder's rules and examples for realtors (tradeLessons). Until then the
 * test drafted with none, so it couldn't show what a lesson changed. The test
 * on Train → Talk to it (src/lib/lessonTest.ts) drafts every case more than
 * once (runReplyTries), without and with the lessons waiting for an OK.
 */

/** The kind of business these cases are written for. */
export const REPLY_EVAL_TRADE = "Real estate";

/** What a kind of business has been taught, as a live draft for it gets it (draftingContext, src/lib/businessFacts.ts). */
export type Lessons = { examples: OwnerExampleLine[]; rules: string[] };

/**
 * The kind's lessons, read the way a live draft reads them: active ones, plus the waiting ones inside
 * withWaitingLessons (src/lib/learning.ts). A test business has no examples of its own, so the shared ones get all of
 * their room.
 */
export async function tradeLessons(trade: string): Promise<Lessons> {
  const [examples, rules] = await Promise.all([getTrainingExamples(trade, Math.min(TRAINING_IN_PROMPT, PROMPT_EXAMPLES)), getTrainingRules(trade)]);
  return { examples, rules };
}

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
  /** They named a feeling ("exhausted"): the reply must acknowledge it (rule 6). */
  feeling?: boolean;
  /** They said no or have an agent: a warm close, no question (rule 8). */
  closing?: boolean;
  /**
   * Their message holds nothing of their own to pick up ("How long have you
   * been a realtor?"), so "could go to anyone" would fail every reply,
   * however good. The template check still runs (2026-10-14: four of the
   * ten failures in the first run were this).
   */
  noDetail?: boolean;
  /**
   * Written for one waiting rule (plan step 3, src/lib/ruleTestMessages.ts): the reply must also follow it. Without
   * the rule it usually doesn't, so these show whether the rule does its job.
   */
  rule?: string;
};

/** The customer's profile name, which the drafter is given as a live DM's would be. */
const LEAD_NAME = "Sam";

const FACTS: FactLine[] = [
  { label: "Commission", value: "My commission is 2.5% when I sell your home." },
  { label: "Area", value: "I work across the GTA, mostly Brampton, Mississauga and Toronto." },
];

export const REPLY_CASES: ReplyCase[] = [
  {
    name: "fee and availability, nothing known",
    lines: [["in", "how much do you charge and are you free this week?"]],
    asks: ["how much the agent charges", "whether the agent is free this week"],
    noDetail: true,
  },
  {
    name: "fee and availability, fee known",
    lines: [["in", "how much do you charge and are you free this week?"]],
    asks: ["how much the agent charges", "whether the agent is free this week"],
    facts: FACTS,
    mustInclude: ["2.5%"],
    noDetail: true,
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
  { name: "buyer's fee", lines: [["in", "Do you charge buyers anything?"]], asks: ["whether buyers pay the agent anything"], noDetail: true },
  { name: "experience", lines: [["in", "How long have you been a realtor?"]], asks: ["how long the agent has been a realtor"], noDetail: true },
  {
    name: "follow-up questions after the business wrote first",
    lines: [
      ["out", "Hi! Thanks for reaching out about the house on Maple Ave."],
      ["in", "What's the lot size? And is the basement finished?"],
    ],
    asks: ["the lot size", "whether the basement is finished"],
  },
  { name: "wants to talk today", lines: [["in", "Are you available to talk today?"]], asks: ["whether the agent can talk today"], noDetail: true },
  {
    name: "Spanish: price and area",
    lines: [["in", "Hola, ¿cuánto cobras por vender una casa? ¿Trabajas en Brampton?"]],
    asks: ["how much the agent charges to sell a house", "whether the agent works in Brampton"],
    facts: FACTS,
    mustInclude: ["2.5"],
  },
  // The trust research's own examples (reports/Realtor replies that win
  // trust.md, A-247), one per rule a model can break without inventing a fact.
  {
    name: "family move: picks up their detail",
    lines: [["in", "We're moving from Ottawa in August. Need 3 beds near a good school for our 8 year old. Budget around 1.3."]],
    asks: [],
  },
  {
    name: "lost offers: acknowledges the feeling",
    lines: [["in", "We've lost 3 offers in a row and honestly we're exhausted. Can you help?"]],
    asks: ["whether the agent can help them"],
    feeling: true,
  },
  { name: "plain search: invents no feeling", lines: [["in", "Looking for a 2 bed condo downtown."]], asks: [] },
  {
    name: "knows the area: useful, no bragging",
    lines: [["in", "Thinking of buying in the Junction. Do you know the area?"]],
    asks: ["whether the agent knows the Junction"],
    facts: [{ label: "Area", value: "I work in the Junction and High Park a lot." }],
    mustInclude: ["Junction"],
  },
  { name: "weekend viewing: no pressure", lines: [["in", "Can I see the Danforth semi this weekend?"]], asks: ["whether they can see the Danforth semi this weekend"] },
  {
    name: "has an agent: a warm close",
    lines: [
      ["out", "Are you still looking for a condo in Liberty Village?"],
      ["in", "Thanks, but we already signed with another agent."],
    ],
    asks: [],
    closing: true,
  },
];

export type ReplyProblem =
  | "shape"
  | "unanswered"
  | "invented"
  | "language"
  | "missing_fact"
  | "echo"
  // A-247: pushed or rushed them, praised the business, missed or made up a
  // feeling, or could have gone to anyone / read like a bot.
  | "pressure"
  | "brag"
  | "feeling"
  | "generic"
  // Plan step 3: a message written for a rule, and the reply didn't follow it.
  | "rule";

export type ReplyEvalResult = {
  cases: number;
  passed: number;
  errors: number;
  problems: Record<ReplyProblem, number>;
  failures: { name: string; problems: ReplyProblem[]; reply: string; detail: string }[];
};

type Grade = {
  answered: boolean[];
  invented: boolean;
  inventedWhat: string;
  sameLanguage: boolean;
  usedDetail: boolean;
  robotic: boolean;
  pushy: boolean;
  bragged: boolean;
  acknowledgedFeeling: boolean;
  inventedFeeling: boolean;
};
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
  const client = getClient("grade_reply");
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
          "BUSINESS FACTS. A placeholder such as [PRICE] is not invented. The customer's name is known, and so is " +
          "everything either side wrote in the conversation. Offering to help, to look for something, or to check " +
          "or confirm something is a promise to act, not a fact: never invented. Repeating the customer's own " +
          "details is not invented, but getting one wrong (another place, number or date than they wrote) is. " +
          "inventedWhat: that detail, or empty.\n" +
          "sameLanguage: true when the reply is in the same language as the customer's last message (Hinglish " +
          "answered in Hinglish or English both count as the same).\n" +
          "usedDetail: true when the reply picks up something specific the customer wrote (a place, a home, a date, " +
          "a person, the thing they asked about), so it could not be sent unchanged to a different customer.\n" +
          "robotic: true when it reads like a template or a bot rather than a person typing: stock phrases " +
          "('thanks for reaching out', 'I'd be happy to help', 'great question'), 'our team', hype ('dream home', " +
          "'thrilled', 'amazing'), emoji, or a string of exclamation marks.\n" +
          "pushy: true when it pressures them: urgency or scarcity nobody in the conversation stated, a deadline, a " +
          "command ('you need to'), a test of how serious they are, guilt, or a promised outcome.\n" +
          "bragged: true when it praises the agent or the business (a ranking, award or title such as 'top', '#1', " +
          "'best', 'expert', 'award-winning', or results for other clients) that the BUSINESS FACTS do not state.\n" +
          "acknowledgedFeeling: true when the customer named a feeling (tired, exhausted, worried, stressed, " +
          "excited) and the reply acknowledges it in plain words; also true when the customer named no feeling.\n" +
          "inventedFeeling: true when the reply names or assumes a feeling the customer never expressed ('I know " +
          "this is stressful'), flatters them, or claims something in common with them.",
      },
      {
        role: "user",
        content:
          `CUSTOMER'S NAME (from their profile): ${LEAD_NAME}\n\nCONVERSATION:\n${chat}\n\nBUSINESS FACTS:\n${facts}\n\nQUESTIONS THE CUSTOMER ASKED:\n` +
          (c.asks.map((a, i) => `${i + 1}. ${a}`).join("\n") || "(none)") +
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
            usedDetail: { type: "boolean" },
            robotic: { type: "boolean" },
            pushy: { type: "boolean" },
            bragged: { type: "boolean" },
            acknowledgedFeeling: { type: "boolean" },
            inventedFeeling: { type: "boolean" },
          },
          required: ["answered", "invented", "inventedWhat", "sameLanguage", "usedDetail", "robotic", "pushy", "bragged", "acknowledgedFeeling", "inventedFeeling"],
          additionalProperties: false,
        },
      },
    },
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("The grader returned nothing.");
  const g = JSON.parse(raw) as Grade;
  return {
    answered: Array.isArray(g.answered) ? g.answered : [],
    invented: !!g.invented,
    inventedWhat: String(g.inventedWhat ?? ""),
    sameLanguage: !!g.sameLanguage,
    usedDetail: !!g.usedDetail,
    robotic: !!g.robotic,
    pushy: !!g.pushy,
    bragged: !!g.bragged,
    acknowledgedFeeling: !!g.acknowledgedFeeling,
    inventedFeeling: !!g.inventedFeeling,
  };
};

/** Did the reply follow the rule a message was written for? A second, narrow reading, so the main checklist stays as it was. */
export type RuleGrader = (rule: string, c: ReplyCase, reply: string) => Promise<boolean>;

export const gradeRule: RuleGrader = async (rule, c, reply) => {
  const client = getClient("grade_rule");
  const chat = c.lines.map(([who, text]) => `${who === "in" ? "CUSTOMER" : "BUSINESS"}: ${text}`).join("\n");
  const completion = await client.chat.completions.create({
    model: MODEL,
    temperature: 0,
    max_tokens: 60,
    messages: [
      {
        role: "system",
        content:
          "A small business set a rule for the replies FollowUp writes to its customers. You check one reply against " +
          "that rule. You only grade; you never rewrite. followed: true when the reply does what the rule asks, or the " +
          "rule doesn't apply to this conversation; false when the reply breaks it or ignores it.",
      },
      { role: "user", content: `RULE:\n${rule}\n\nCONVERSATION:\n${chat}\n\nREPLY TO CHECK:\n${reply}` },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "rule_check",
        strict: true,
        schema: { type: "object", properties: { followed: { type: "boolean" } }, required: ["followed"], additionalProperties: false },
      },
    },
  });
  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("The rule check returned nothing.");
  return !!(JSON.parse(raw) as { followed?: unknown }).followed;
};

/** Two at a time: each case is up to three model calls (a draft, a retry, a grade). */
export const REPLY_EVAL_CONCURRENCY = 2;

/**
 * One reply to one case, and what was wrong with it. `hard` is the part of `problems` that code decided, not a model's
 * reading: the message rules, a reply that hands their words back, a fact left out, the pressure and bragging words
 * src/lib/replyTone.ts looks for, a question after a no. Plan step 3: these can block a lesson outright.
 */
export type CaseTry = { reply: string; problems: ReplyProblem[]; hard: ReplyProblem[]; detail: string; error?: string };

/** Drafts one case with the real drafter and checks it. Throws when a model call fails. */
async function tryCase(
  c: ReplyCase,
  draft: Drafter,
  grade: Grader,
  lessons: Lessons,
  retry?: RateLimitRetryOptions,
  ruleGrade: RuleGrader = gradeRule
): Promise<CaseTry> {
  // The same call a live DM reply makes (automation.ts, scoring.ts), for a realtor.
  const drafted = await withRateLimitRetry(
    () => draft(LEAD_NAME, toConversation(c.lines), [], undefined, "reply", null, c.facts ?? [], null, REPLY_EVAL_TRADE, lessons.examples, lessons.rules),
    retry
  );
  const reply = drafted.body.trim();
  const g = await withRateLimitRetry(() => grade(c, reply), retry);

  const problems: ReplyProblem[] = [];
  const hard = new Set<ReplyProblem>();
  const details: string[] = [];
  if (drafted.shapeFailed) {
    problems.push("shape");
    hard.add("shape");
    details.push(`shape rule: ${drafted.shapeFailed}`);
  }
  if (ECHO_RE.test(reply)) {
    problems.push("echo");
    hard.add("echo");
  }
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
    hard.add("missing_fact");
    details.push(`missing: ${absent.join(", ")}`);
  }
  // A-247. The code check (src/lib/replyTone.ts) and the reader both
  // count: the check is narrow on purpose, the reader catches the rest.
  const tone = salesPressure(reply, { said: (c.facts ?? []).map((f) => f.value).join("\n") });
  const askedAgain = c.closing && /[?？؟]/.test(reply);
  if (g.pushy || tone === "pressure" || askedAgain) {
    problems.push("pressure");
    if (tone === "pressure" || askedAgain) hard.add("pressure");
    details.push(askedAgain ? "asked again after a no" : "pushed or rushed them");
  }
  if (g.bragged || tone === "brag") {
    problems.push("brag");
    if (tone === "brag") hard.add("brag");
    details.push("praised the business");
  }
  if ((c.feeling && !g.acknowledgedFeeling) || g.inventedFeeling) {
    problems.push("feeling");
    details.push(g.inventedFeeling ? "made up a feeling" : "missed the feeling they named");
  }
  if ((!g.usedDetail && !c.noDetail) || g.robotic) {
    problems.push("generic");
    details.push(g.robotic ? "read like a template" : "could go to anyone");
  }
  if (c.rule && !(await withRateLimitRetry(() => ruleGrade(c.rule!, c, reply), retry))) {
    problems.push("rule");
    details.push("didn't follow the rule");
  }
  return { reply, problems, hard: [...hard], detail: details.join(" · ") };
}

const NO_LESSONS: Lessons = { examples: [], rules: [] };

export async function runReplyEval(
  draft: Drafter = draftDm,
  grade: Grader = gradeReply,
  cases = REPLY_CASES,
  options: { retry?: RateLimitRetryOptions; lessons?: Lessons } = {}
): Promise<ReplyEvalResult> {
  const result: ReplyEvalResult = {
    cases: cases.length,
    passed: 0,
    errors: 0,
    problems: { shape: 0, unanswered: 0, invented: 0, language: 0, missing_fact: 0, echo: 0, pressure: 0, brag: 0, feeling: 0, generic: 0, rule: 0 },
    failures: [],
  };
  // Logged as "test:…" in the decision log, apart from real customers' replies.
  await withAiContext({ tag: "test" }, () => mapWithConcurrency(cases, REPLY_EVAL_CONCURRENCY, async (c) => {
    try {
      const { reply, problems, detail } = await tryCase(c, draft, grade, options.lessons ?? NO_LESSONS, options.retry);
      for (const p of problems) result.problems[p] += 1;
      if (problems.length === 0) result.passed += 1;
      else result.failures.push({ name: c.name, problems, reply, detail });
    } catch (err) {
      result.errors += 1;
      result.failures.push({ name: c.name, problems: [], reply: "", detail: err instanceof Error ? err.message : "unknown error" });
    }
  }));
  return result;
}

/** Every reply to one case: the customer's last words and each try, and the rule it was written for, if any. */
export type CaseTries = { name: string; said: string; rule?: string; tries: CaseTry[] };

/**
 * Drafts every case `tries` times with the given lessons (A-319). A failed model call counts as a try that didn't
 * pass, with its error, so one hiccup never makes a lesson look better than it is.
 */
export async function runReplyTries(
  lessons: Lessons,
  options: {
    tries: number;
    concurrency: number;
    draft?: Drafter;
    grade?: Grader;
    ruleGrade?: RuleGrader;
    cases?: ReplyCase[];
    retry?: RateLimitRetryOptions;
  }
): Promise<CaseTries[]> {
  const cases = options.cases ?? REPLY_CASES;
  const jobs = cases.flatMap((c, ci) => Array.from({ length: options.tries }, (_, t) => ({ c, ci, t })));
  const out: CaseTries[] = cases.map((c) => ({ name: c.name, said: lastInbound(c), ...(c.rule ? { rule: c.rule } : {}), tries: [] }));
  const results = await withAiContext({ tag: "test" }, () => mapWithConcurrency(jobs, options.concurrency, async ({ c }) => {
    try {
      return await tryCase(c, options.draft ?? draftDm, options.grade ?? gradeReply, lessons, options.retry, options.ruleGrade);
    } catch (err) {
      return { reply: "", problems: [], hard: [], detail: "", error: err instanceof Error ? err.message : "unknown error" } satisfies CaseTry;
    }
  }));
  jobs.forEach((j, i) => {
    out[j.ci].tries[j.t] = results[i];
  });
  return out;
}

/** What the customer said last in a case: the words a person reads first. */
function lastInbound(c: ReplyCase): string {
  for (let i = c.lines.length - 1; i >= 0; i--) if (c.lines[i][0] === "in") return c.lines[i][1];
  return "";
}
