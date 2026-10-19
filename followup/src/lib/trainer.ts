import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { TRAINER_BRIEF } from "@/lib/trainerBrief";
import { playbookFor } from "@/lib/tradePlaybooks";
import { practiceReply, type PracticeChannel } from "@/lib/practiceReply";
import { deleteTrainingRule, listTrainingRules, saveTrainingRule, updateTrainingRule } from "@/lib/trainingRules";
import { MAX_RULE_TEXT } from "@/lib/trainingRuleLines";
import { scrub } from "@/lib/trainingParse";
import { INDUSTRIES } from "@/lib/industries";

/**
 * "Claude on the Train page" (A-298, founder 2026-10-19: "i want you to be there bro … if your clone is also sitting
 * there with all the rules that you know … then its good"). Beside Talk to it, the founder talks to Claude about a
 * bad answer. Claude knows the brief (src/lib/trainerBrief.ts), the kind's reply plan, every rule with its id, and the
 * last part of their talk (TrainerMessage). It proposes rules (he saves them with a button), saves, changes or removes
 * one when he says yes in words, and runs FollowUp on test chats to check a fix. It never sees customer data.
 *
 * Calls Anthropic's Messages API with fetch (no new package). Needs ANTHROPIC_API_KEY and ANTHROPIC_MODEL, both set by
 * the founder in Vercel; without them the panel says it isn't set up yet.
 */

const API = "https://api.anthropic.com/v1/messages";
/** How much of the talk it remembers each time: the newest messages, oldest first. */
const HISTORY = 30;
/** Rounds of tool use in one answer, and FollowUp test replies in one answer: bounds time and cost. */
const MAX_ROUNDS = 6;
const MAX_TESTS = 6;
const MAX_TOKENS = 1500;
const MAX_TEXT = 4000;

export type TrainerCard =
  | { kind: "proposal"; trade: string; text: string; replacesId?: string; replacesText?: string }
  | { kind: "saved"; id: string; trade: string; text: string }
  | { kind: "changed"; id: string; trade: string; text: string }
  | { kind: "removed"; id: string; trade: string; text: string }
  | { kind: "test"; trade: string; customer: string; reply: string };

export type TrainerTurn = { id: string; role: "founder" | "claude"; text: string; cards: TrainerCard[]; when: string };

export type TalkContext = {
  trade: string;
  channel: PracticeChannel;
  turns: { from: "customer" | "followup"; text: string }[];
  /** The answer he pressed "Ask Claude" under, as an index into turns. */
  focus: number | null;
};

export function trainerReady(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_MODEL);
}

const clean = (t: string, max: number) => scrub(t, [], "").replace(/[ \t]+/g, " ").trim().slice(0, max);

/** The newest part of the talk, oldest first, for the panel and for Claude's memory. */
export async function loadTrainerTalk(limit = HISTORY): Promise<TrainerTurn[]> {
  const rows = await prisma.trainerMessage.findMany({ orderBy: { createdAt: "desc" }, take: limit });
  return rows.reverse().map((r) => ({
    id: r.id,
    role: r.role === "claude" ? "claude" : "founder",
    text: r.text,
    cards: Array.isArray(r.cards) ? (r.cards as unknown as TrainerCard[]) : [],
    when: r.createdAt.toISOString(),
  }));
}

const TRADES = INDUSTRIES as readonly string[];
const tradeSchema = { type: "string", enum: [...INDUSTRIES], description: "The kind of business, exactly as listed." };

const TOOLS = [
  {
    name: "test_reply",
    description:
      "Run FollowUp on a test chat as this kind of business and get its next answer. The chat must end with a customer " +
      "message. Uses every saved rule for that kind. Call several at once to test several ways of saying something.",
    input_schema: {
      type: "object",
      properties: {
        trade: tradeSchema,
        channel: { type: "string", enum: ["instagram", "messenger", "email"] },
        chat: {
          type: "array",
          description: "The test chat so far, oldest first, ending with the customer.",
          items: {
            type: "object",
            properties: { from: { type: "string", enum: ["customer", "followup"] }, text: { type: "string" } },
            required: ["from", "text"],
          },
        },
      },
      required: ["trade", "channel", "chat"],
    },
  },
  {
    name: "propose_rule",
    description:
      "Show Sahil a new rule, or a new wording for an existing one (replaces_id), with a Save button. Saves nothing.",
    input_schema: {
      type: "object",
      properties: {
        trade: tradeSchema,
        text: { type: "string", description: "The rule: one or two short sentences, under 45 words." },
        replaces_id: { type: "string", description: "The id of the existing rule this rewrites, if any." },
      },
      required: ["trade", "text"],
    },
  },
  {
    name: "save_rule",
    description: "Save a new rule. Only when Sahil's latest message clearly says yes to it.",
    input_schema: { type: "object", properties: { trade: tradeSchema, text: { type: "string" } }, required: ["trade", "text"] },
  },
  {
    name: "change_rule",
    description: "Change the wording of an existing rule. Only when Sahil's latest message clearly says yes to it.",
    input_schema: { type: "object", properties: { id: { type: "string" }, text: { type: "string" } }, required: ["id", "text"] },
  },
  {
    name: "remove_rule",
    description: "Remove an existing rule. Only when Sahil's latest message clearly says yes to it.",
    input_schema: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
  },
];

type Block =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
type Message = { role: "user" | "assistant"; content: string | Block[] };

/** The rules as Claude sees them: every kind, with ids, so it can find a clash and name the rule to change. */
function rulesBlock(rules: { id: string; trade: string; text: string }[]): string {
  if (rules.length === 0) return "No rules saved yet for any kind of business.";
  const byTrade = new Map<string, string[]>();
  for (const r of rules) byTrade.set(r.trade, [...(byTrade.get(r.trade) ?? []), `- [${r.id}] ${r.text}`]);
  return [...byTrade].map(([t, lines]) => `${t}:\n${lines.join("\n")}`).join("\n\n");
}

function talkBlock(talk: TalkContext): string {
  const lines = talk.turns.map((t, i) => `${i === talk.focus ? ">> " : ""}[${t.from === "customer" ? "customer" : "FollowUp"}] ${t.text}`);
  const focus = talk.focus !== null && talk.turns[talk.focus] ? "\nHe is asking about the FollowUp answer marked >>." : "";
  return `<talk_test trade="${talk.trade}" channel="${talk.channel}">\n${lines.join("\n") || "(no test chat yet)"}\n</talk_test>${focus}`;
}

/** What Claude said and showed before, as plain text, so its memory of a card survives the page reloading. */
function cardLine(c: TrainerCard): string {
  switch (c.kind) {
    case "proposal":
      return `(proposed for ${c.trade}${c.replacesId ? `, replacing ${c.replacesId}` : ""}: ${c.text})`;
    case "saved":
      return `(saved ${c.id} for ${c.trade}: ${c.text})`;
    case "changed":
      return `(changed ${c.id}: ${c.text})`;
    case "removed":
      return `(removed ${c.id}: ${c.text})`;
    case "test":
      return `(tested ${c.trade}: customer "${c.customer}" got "${c.reply}")`;
  }
}

function historyMessages(history: TrainerTurn[]): Message[] {
  const out: Message[] = [];
  for (const h of history) {
    const role = h.role === "claude" ? "assistant" : "user";
    const text = [h.text, ...h.cards.map(cardLine)].filter(Boolean).join("\n") || "(nothing)";
    const last = out[out.length - 1];
    if (last && last.role === role && typeof last.content === "string") last.content += `\n\n${text}`;
    else out.push({ role, content: text });
  }
  // The API wants the talk to start with him.
  while (out[0]?.role === "assistant") out.shift();
  return out;
}

async function callClaude(system: string, messages: Message[]): Promise<{ content: Block[]; stop_reason: string }> {
  const res = await fetch(API, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL,
      max_tokens: MAX_TOKENS,
      // The brief, the plan and the rules are the same on every round: cached, so only the first round pays full price.
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: TOOLS,
      messages,
    }),
    signal: AbortSignal.timeout(50_000),
  });
  if (!res.ok) throw new Error(`Claude answered ${res.status}`);
  return (await res.json()) as { content: Block[]; stop_reason: string };
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const knownTrade = (v: unknown): string | null => (typeof v === "string" && TRADES.includes(v) ? v : null);

/**
 * One answer from Claude: his message (and the Talk to it chat it's about) in, Claude's words and cards out, both kept.
 * Throws when Claude can't be reached; his message is kept either way.
 */
export async function askTrainer(input: {
  businessId: string;
  userId: string | null;
  message: string;
  talk: TalkContext;
}): Promise<TrainerTurn> {
  const history = await loadTrainerTalk();
  const said = clean(input.message, MAX_TEXT);
  await prisma.trainerMessage.create({ data: { role: "founder", text: said, userId: input.userId } });

  const rules = await listTrainingRules();
  const byId = new Map(rules.map((r) => [r.id, r]));
  const system =
    `${TRAINER_BRIEF}\n\nTHE REPLY PLAN FOR ${input.talk.trade.toUpperCase()} (what FollowUp is told today):\n${playbookFor(input.talk.trade)}` +
    `\n\nSAHIL'S SAVED RULES, BY KIND OF BUSINESS (newest first):\n${rulesBlock(rules)}`;
  const messages: Message[] = [...historyMessages(history), { role: "user", content: `${said}\n\n${talkBlock(input.talk)}` }];
  if (messages.length > 1 && messages[messages.length - 2].role === "user") {
    // Two of his messages in a row (an earlier answer failed): fold them into one.
    const prev = messages.splice(messages.length - 2, 1)[0];
    messages[messages.length - 1].content = `${prev.content}\n\n${messages[messages.length - 1].content}`;
  }

  const cards: TrainerCard[] = [];
  const words: string[] = [];
  let tests = 0;
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const reply = await callClaude(system, messages);
    messages.push({ role: "assistant", content: reply.content });
    for (const b of reply.content) if (b.type === "text" && b.text.trim()) words.push(b.text.trim());
    const uses = reply.content.filter((b): b is Extract<Block, { type: "tool_use" }> => b.type === "tool_use");
    if (reply.stop_reason !== "tool_use" || uses.length === 0) break;

    // Cards keep the order Claude asked in, even though the tests run side by side.
    const made: TrainerCard[][] = uses.map(() => []);
    const results = await Promise.all(
      uses.map(async (u, n): Promise<Block> => {
        const card = (c: TrainerCard) => made[n].push(c);
        const done = (content: string, is_error = false): Block => ({ type: "tool_result", tool_use_id: u.id, content, is_error });
        try {
          const a = u.input ?? {};
          if (u.name === "test_reply") {
            if (++tests > MAX_TESTS) return done(`No more tests in this answer (limit ${MAX_TESTS}).`, true);
            const trade = knownTrade(a.trade);
            const channel = (["instagram", "messenger", "email"] as const).find((c) => c === a.channel) ?? "instagram";
            const chat = (Array.isArray(a.chat) ? a.chat : [])
              .slice(-24)
              .map((t: { from?: unknown; text?: unknown }) => ({ from: t?.from === "followup" ? ("followup" as const) : ("customer" as const), text: str(t?.text, 1500) }))
              .filter((t) => t.text);
            if (!trade || chat.length === 0 || chat[chat.length - 1].from !== "customer") {
              return done("The test chat needs a known kind of business and must end with a customer message.", true);
            }
            const r = await practiceReply(input.businessId, "there", chat, null, channel, false, { industry: trade });
            card({ kind: "test", trade, customer: chat[chat.length - 1].text, reply: r.reply });
            return done(`FollowUp answered: ${r.reply}`);
          }
          if (u.name === "propose_rule") {
            const trade = knownTrade(a.trade);
            const text = str(a.text, MAX_RULE_TEXT);
            const old = typeof a.replaces_id === "string" ? byId.get(a.replaces_id) : undefined;
            if (!trade || !text) return done("A proposal needs a known kind of business and the rule.", true);
            card({ kind: "proposal", trade, text, ...(old ? { replacesId: old.id, replacesText: old.text } : {}) });
            return done("Shown to Sahil with a Save button. Nothing is saved until he taps it or says yes.");
          }
          if (u.name === "save_rule") {
            const trade = knownTrade(a.trade);
            const text = str(a.text, MAX_RULE_TEXT);
            if (!trade || !text) return done("A rule needs a known kind of business and the rule.", true);
            const row = await saveTrainingRule({ trade, text, note: `From Claude on Train: ${said}` }, input.userId);
            byId.set(row.id, { id: row.id, trade, text: row.text, createdAt: new Date() });
            card({ kind: "saved", id: row.id, trade, text: row.text });
            return done(`Saved as ${row.id}. Every ${trade} business uses it now.`);
          }
          if (u.name === "change_rule") {
            const old = typeof a.id === "string" ? byId.get(a.id) : undefined;
            const text = str(a.text, MAX_RULE_TEXT);
            if (!old || !text) return done("No rule with that id, or no new wording.", true);
            if (!(await updateTrainingRule(old.id, text))) return done("That rule is gone.", true);
            card({ kind: "changed", id: old.id, trade: old.trade, text });
            return done(`Changed ${old.id}.`);
          }
          if (u.name === "remove_rule") {
            const old = typeof a.id === "string" ? byId.get(a.id) : undefined;
            if (!old) return done("No rule with that id.", true);
            if (!(await deleteTrainingRule(old.id))) return done("That rule is already gone.", true);
            byId.delete(old.id);
            card({ kind: "removed", id: old.id, trade: old.trade, text: old.text });
            return done(`Removed ${old.id}.`);
          }
          return done("Unknown tool.", true);
        } catch {
          return done("That didn't work this time.", true);
        }
      })
    );
    cards.push(...made.flat());
    messages.push({ role: "user", content: results });
  }

  const text = words.join("\n\n").slice(0, MAX_TEXT) || "Done.";
  const row = await prisma.trainerMessage.create({
    data: { role: "claude", text, cards: cards as unknown as Prisma.InputJsonValue, userId: input.userId },
  });
  return { id: row.id, role: "claude", text, cards, when: row.createdAt.toISOString() };
}
