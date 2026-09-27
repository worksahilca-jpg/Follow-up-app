/**
 * "Based on …" under a waiting reply (design brain A-043, the Intercom
 * study: every suggestion shows what it rests on, so the owner can check
 * it in a glance).
 *
 * Worked out from the conversation itself, not asked of the model: the
 * customer's latest message, and every amount in the draft matched to
 * the message where it actually appeared. So the line can only ever name
 * something that is really there. An amount that appears nowhere earlier
 * is simply left out here; the send-risk check is what holds such a draft.
 *
 * Pure, no imports: the dashboard and the lead page both call it.
 */
export type BasisMessage = {
  direction: "inbound" | "outbound";
  body: string;
  sentAt: Date;
  /** Message.source; set when an outbound came from somewhere other than FollowUp or the owner. */
  source?: string | null;
  channel?: string | null;
};

const AMOUNT = /(?:[$€£₹]\s?\d[\d,]*(?:\.\d+)?(?:\s?[kK])?)|(?:\b\d[\d,]*(?:\.\d+)?\s?(?:dollars|USD|CAD|EUR|GBP|INR)\b)/g;

/** The amounts written in a piece of text, as they were written ("$6,500"). */
export function findAmounts(text: string): string[] {
  return Array.from(new Set(text.match(AMOUNT) ?? [])).map((a) => a.trim());
}

function digits(a: string): string {
  return a.replace(/[^\d.kK]/g, "").toLowerCase();
}

const CHANNEL_NAME: Record<string, string> = {
  email: "email",
  text: "text",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
  web: "your website form",
  call: "a call",
};

function when(at: Date, now: Date, timeZone?: string): string {
  const opts = timeZone ? { timeZone } : {};
  const day = (d: Date) => d.toLocaleDateString("en-CA", opts);
  if (day(at) === day(now)) {
    const h = Number(at.toLocaleString("en-US", { hour: "numeric", hour12: false, ...opts }));
    return h < 12 ? "this morning" : h < 17 ? "this afternoon" : "this evening";
  }
  if (day(at) === day(new Date(now.getTime() - 86400000))) return "yesterday";
  return "on " + at.toLocaleDateString("en-US", { month: "short", day: "numeric", ...opts });
}

export function describeBasis(input: {
  draft: string;
  leadFirstName: string;
  messages: BasisMessage[];
  now?: Date;
  timeZone?: string;
}): string | null {
  const now = input.now ?? new Date();
  const first = input.leadFirstName.trim() || "their";
  const byTime = [...input.messages].sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime());
  const lastIn = [...byTime].reverse().find((m) => m.direction === "inbound");
  const parts: string[] = [];
  if (lastIn) {
    const ch = lastIn.channel && CHANNEL_NAME[lastIn.channel] ? ` on ${CHANNEL_NAME[lastIn.channel]}` : "";
    parts.push(`${first === "their" ? "their" : `${first}'s`} message${ch} ${when(lastIn.sentAt, now, input.timeZone)}`);
  }
  for (const amount of findAmounts(input.draft)) {
    const d = digits(amount);
    if (!d) continue;
    const firstSeen = byTime.find((m) => findAmounts(m.body).some((x) => digits(x) === d));
    if (!firstSeen) continue;
    // The live phone agent's words aren't the owner's quote (openai.ts,
    // VOICE_AGENT_TRUST_NOTICE), and neither is anything sent outside FollowUp.
    const ownersOwn = firstSeen.direction === "outbound" && !firstSeen.source && firstSeen.channel !== "call";
    const whenSeen = when(firstSeen.sentAt, now, input.timeZone);
    if (ownersOwn) parts.push(`the ${amount} you quoted ${whenSeen}`);
    else if (firstSeen.direction === "inbound") parts.push(`the ${amount} ${first === "their" ? "they" : first} mentioned ${whenSeen}`);
  }
  if (parts.length === 0) return null;
  const list = parts.length === 1 ? parts[0] : parts.slice(0, -1).join(", ") + " and " + parts[parts.length - 1];
  return `Based on ${list}.`;
}
