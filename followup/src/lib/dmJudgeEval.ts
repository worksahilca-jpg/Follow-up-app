import { judgeHistoryThread } from "@/lib/inbound/whatsappHistoryFilter";
import type { ClassifierBusinessContext } from "@/lib/integrations/openai";
import { mapWithConcurrency } from "@/lib/concurrency";
import type { Message } from "@/lib/types";

/**
 * How accurately the "is this a customer?" check reads a new Instagram or
 * Messenger chat (src/lib/inbound/dmContactGate.ts, A-234): a fixed set of
 * first-contact DMs with known answers, run against the REAL model through
 * the same judge the live check uses (judgeHistoryThread, two reads).
 *
 * Founder, 2026-10-12: "We're going to make the judgement more accurate."
 * The email check has had its own test since 2026-09-25
 * (src/lib/classifierEval.ts); the DM check, live since 2026-10-11, had
 * none.
 *
 * Two kinds of wrong, counted apart:
 *  - customer set aside: a real enquiry the owner never sees on Today.
 *    The expensive one, and the one that must stay at 0.
 *  - chat let through: a friend or a pitch shows up on Today. Noise.
 *
 * Only messages the live check actually judges are here: something with
 * words that isn't a bare greeting. "Hi", a photo, and a shared Reel never
 * reach the judge (dmContactGate.ts, sharedContent.ts).
 *
 * The judge fails open by design: an error or a rate limit reads as "let
 * through". So an outage here shows up as chats let through, never as a
 * customer lost, and the cases run two at a time to keep rate limits rare.
 *
 * Every case is invented. To run it: POST /api/admin/dm-judge-eval, or the
 * Run button on /admin.
 */

export type DmJudgeCase = {
  name: string;
  business: ClassifierBusinessContext;
  /** The chat, oldest first: "in" is the person writing, "out" the business. */
  lines: ["in" | "out", string][];
  expectCustomer: boolean;
  /** What Instagram says about them, as the live check passes it (src/lib/inbound/dmBackground.ts). */
  background?: string;
};

const realtor: ClassifierBusinessContext = { name: "Maple Key Realty", industry: "Real estate" };
const plumber: ClassifierBusinessContext = { name: "Northside Plumbing", industry: "Home services (contractor, cleaning, etc.)" };
const salon: ClassifierBusinessContext = { name: "Glow Studio", industry: "Hair salon" };

const ask = (business: ClassifierBusinessContext, name: string, text: string, expectCustomer: boolean): DmJudgeCase => ({
  name,
  business,
  lines: [["in", text]],
  expectCustomer,
});

export const DM_JUDGE_CASES: DmJudgeCase[] = [
  // ---- customers: must come through -----------------------------------------
  ask(realtor, "asks if a listing is available", "Is the condo on King St still available?", true),
  ask(realtor, "asks the agent's fee", "How much do you charge to sell a house?", true),
  ask(realtor, "saw a Reel, asks about the house", "Hey, saw your reel about the Brampton townhouse, is it still on the market?", true),
  ask(realtor, "first-time buyers next spring", "Hi! We're looking to buy our first home next spring, can you help?", true),
  ask(realtor, "rental for a date", "Do you do rentals too? Need a 1 bed downtown for Nov 1", true),
  ask(realtor, "friend refers a buyer", "hey bro, my cousin is looking for a house in Milton, can I give him your number?", true),
  ask(realtor, "Hinglish: wants to see a house", "Bhai Brampton mein ghar dekhna hai, kab free ho?", true),
  ask(realtor, "asks a listing's price", "What's the price on the Elm St listing?", true),
  ask(realtor, "wants a home valuation", "Can you tell me what my house is worth? It's a 3 bed semi in Ajax", true),
  ask(realtor, "compliment, then asks about an open house", "Saw your post, love the kitchen 😍 is there an open house this weekend?", true),
  ask(realtor, "short, no capitals, asks about showings", "are u still doing showings for the pine ct house", true),
  {
    name: "small talk that turns into selling",
    business: realtor,
    lines: [
      ["in", "hey whats up man"],
      ["out", "Hey! All good, you?"],
      ["in", "good good, actually thinking of selling my condo, what would you charge?"],
    ],
    expectCustomer: true,
  },
  ask(plumber, "plumber: drain backing up", "My basement drain is backing up, can you come today?", true),
  ask(salon, "salon: books a colour", "do you have anything open saturday for a balayage?", true),

  // ---- not customers: set aside ------------------------------------------------
  ask(realtor, "a friend catching up", "hey bro what's up, long time", false),
  ask(realtor, "a friend sharing a joke", "haha this reel is so you 😂", false),
  ask(realtor, "a birthday wish", "Happy birthday man!! 🎉 have a great one", false),
  ask(realtor, "photographer pitching", "Hi, I'm a photographer and I'd love to shoot your listings. Can I send you my portfolio?", false),
  ask(realtor, "follower-growth spam", "Grow your Instagram to 10k followers fast! DM us for a free trial", false),
  ask(realtor, "plans with a friend", "Are we still on for basketball tonight?", false),
  ask(realtor, "congratulations", "Congrats on the new office! 🙌", false),
  ask(realtor, "leads for sale", "I can get you 50 buyer leads a month, interested?", false),
  ask(realtor, "brand-ambassador bait", "You've been selected for our brand ambassador program! Reply to claim your spot", false),
  ask(realtor, "sports chat", "Yo did you see the game last night", false),
  ask(realtor, "family message", "Hey it's your cousin, mom says call her", false),
  ask(realtor, "a brand asking for promotion", "Collab? We're a small clothing brand looking for realtors to promote us", false),
  ask(realtor, "Hinglish: party plans", "Bhai kal party pe aa raha hai na?", false),
  ask(realtor, "brokerage recruiting the agent", "We're hiring agents at our brokerage, 90/10 split, want to chat?", false),
  ask(salon, "salon: supplier pitch", "Hi! We sell wholesale hair extensions to salons, can I send our price list?", false),

  // ---- from the founder's own inbox, 2026-10-12 (A-239) -----------------------
  // A friend's emoji, then a joke about something in a story: let in on the
  // emoji, and before A-239 never looked at again.
  {
    name: "real miss: emoji, then a Hinglish joke",
    business: realtor,
    lines: [
      ["in", "😍"],
      ["in", "Isme bee bhi dal"],
    ],
    expectCustomer: false,
  },
  {
    name: "a friend asks for a Reel back",
    business: realtor,
    lines: [
      ["in", "hahaha"],
      ["in", "bro send me that reel again"],
    ],
    expectCustomer: false,
  },
  // The emoji decides nothing (founder, 2026-10-12: "emojis can be, but we
  // need to judge right"). The same 😍 opens a buyer's chat: what comes
  // after it is what counts.
  {
    name: "emoji, then asks if a listing is available",
    business: realtor,
    lines: [
      ["in", "😍"],
      ["in", "Is this one still available?"],
    ],
    expectCustomer: true,
  },
  {
    name: "fire emojis, then asks the price",
    business: realtor,
    lines: [
      ["in", "🔥🔥"],
      ["in", "how much is this one"],
    ],
    expectCustomer: true,
  },
  {
    name: "emoji, then a Hinglish price question",
    business: realtor,
    lines: [
      ["in", "😍"],
      ["in", "Bhai ye ghar kitne ka hai?"],
    ],
    expectCustomer: true,
  },
  {
    name: "says hi, then asks about a rental",
    business: realtor,
    lines: [
      ["in", "Hi"],
      ["in", "Is the basement apartment on Main St still for rent?"],
    ],
    expectCustomer: true,
  },
  // With what Instagram says about them (founder, 2026-10-12: "whether they talked earlier").
  {
    name: "with background: a mutual follow and a long casual chat",
    business: realtor,
    lines: [
      ["in", "bro you watching the match tonight"],
      ["out", "ya obviously"],
      ["in", "Isme bee bhi dal"],
    ],
    background:
      "What Instagram says about this person: they follow the business; the business follows them back; they have 640 followers; " +
      "their chat with the business goes back to Jan 2024.",
    expectCustomer: false,
  },
  {
    name: "with background: follows the business, first message ever",
    business: realtor,
    lines: [
      ["in", "Hi"],
      ["in", "Do you have any 2 bed condos under 600k in Mississauga?"],
    ],
    background:
      "What Instagram says about this person: they follow the business; the business doesn't follow them; they have 95 followers; " +
      "this is the first time they've messaged the business.",
    expectCustomer: true,
  },
];

export type DmJudgeResult = {
  cases: number;
  right: number;
  /** Real enquiries set aside. Must stay at 0. */
  customersSetAside: number;
  /** Friends, pitches and spam let through. */
  chatsLetThrough: number;
  failures: { name: string; expected: string; got: string; reason: string }[];
};

/** Two at a time: the judge swallows rate limits as "let through", so fewer at once means a cleaner score. */
export const DM_JUDGE_CONCURRENCY = 2;

type Judge = typeof judgeHistoryThread;

function toThread(lines: DmJudgeCase["lines"]): Message[] {
  const start = Date.UTC(2026, 9, 1, 15);
  return lines.map(([who, body], i) => ({
    id: `d${i}`,
    direction: who === "in" ? "inbound" : "outbound",
    channel: "instagram",
    body,
    date: new Date(start + i * 60_000).toISOString(),
    opened: false,
  }));
}

export async function runDmJudgeEval(judge: Judge = judgeHistoryThread, cases = DM_JUDGE_CASES): Promise<DmJudgeResult> {
  const result: DmJudgeResult = { cases: cases.length, right: 0, customersSetAside: 0, chatsLetThrough: 0, failures: [] };
  const word = (customer: boolean) => (customer ? "customer" : "set aside");
  await mapWithConcurrency(cases, DM_JUDGE_CONCURRENCY, async (c) => {
    // The same call the live check makes for someone new (dmContactGate.ts).
    const verdict = await judge(toThread(c.lines), { name: "Instagram user", phone: "ig:eval" }, c.business, { knownOnAnotherChannel: false, background: c.background }, { alreadySetAside: false });
    if (verdict.import === c.expectCustomer) {
      result.right += 1;
      return;
    }
    if (c.expectCustomer) result.customersSetAside += 1;
    else result.chatsLetThrough += 1;
    result.failures.push({ name: c.name, expected: word(c.expectCustomer), got: word(verdict.import), reason: verdict.import ? "" : verdict.reason });
  });
  return result;
}
