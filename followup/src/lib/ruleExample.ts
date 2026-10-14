import { deadLeadMessageHint, DEAD_LEAD_ACTION, DEAD_LEAD_DEFAULT_DAYS, type TimelineMessage } from "@/lib/automation";
import { checkInName, followUpState, stepHint, type FollowUpPlans } from "@/lib/followUpPlans";
import { generateFollowUpMessage, generateInstantReply } from "@/lib/integrations/openai";
import { draftDm } from "@/lib/dmDrafting";
import { getVoiceSamples } from "@/lib/voice";
import { getSenderFirstName } from "@/lib/sender";
import { greetingFirstName } from "@/lib/leadName";
import type { LeadLanguage } from "@/lib/leadLanguage";
import type { Lead, Message } from "@/lib/types";
import { draftingContext } from "@/lib/businessFacts";

/**
 * "See an example" on a follow-up rule (design brain A-044, the Zapier
 * study): what this rule would write for a real recent customer, with the
 * same instructions the rule itself uses. Nothing is stored, held or sent.
 */
export type ExampleRule = "instant_ack" | "unanswered" | "silence" | typeof DEAD_LEAD_ACTION;

const DAY = 86_400_000;
const isAck = (m: Message) => m.direction === "outbound" && m.trigger === "instant_ack";
const judged = (l: Lead) => l.conversation.filter((m) => !isAck(m)).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
const last = (l: Lead) => judged(l).at(-1);
const open = (l: Lead) => l.stage !== "won" && l.stage !== "lost";

/** The real customer to show the example for, newest first; `skip` is who was shown already. */
export function pickExampleLead(leads: Lead[], rule: ExampleRule, skip: string[] = []): Lead | null {
  const pool = leads.filter((l) => open(l) && !skip.includes(l.id) && l.conversation.length > 0);
  const byRecent = (a: Lead, b: Lead) => Date.parse(b.lastContacted) - Date.parse(a.lastContacted);
  switch (rule) {
    case "instant_ack":
      return pool.filter((l) => l.conversation.some((m) => m.direction === "inbound")).sort(byRecent)[0] ?? null;
    case "unanswered":
      return pool.filter((l) => last(l)?.direction === "inbound").sort(byRecent)[0] ?? null;
    case "silence":
      return pool.filter((l) => last(l)?.direction === "outbound").sort(byRecent)[0] ?? null;
    default:
      // The one who has been quiet longest.
      return pool.filter((l) => last(l)?.direction === "outbound").sort((a, b) => -byRecent(a, b))[0] ?? null;
  }
}

function timeline(l: Lead): TimelineMessage[] {
  return l.conversation.map((m) => ({ direction: m.direction, at: Date.parse(m.date), trigger: m.trigger ?? null, quickReplyPayload: m.quickReplyPayload ?? null }));
}

/** Writes the example. Throws if the model call fails; the caller says so. */
export async function writeRuleExample(
  businessId: string,
  lead: Lead,
  rule: ExampleRule,
  opts: { followUpPlans?: FollowUpPlans; deadLeadDays?: number } = {},
  now: Date = new Date()
): Promise<{ text: string; what: string }> {
  const language = (lead.languageRead ?? null) as Partial<LeadLanguage> | null;
  if (rule === "instant_ack") {
    const inbound = lead.conversation.filter((m) => m.direction === "inbound").sort((a, b) => Date.parse(a.date) - Date.parse(b.date))[0];
    const text = await generateInstantReply({
      leadFirstName: greetingFirstName(lead.name),
      ownerFirstName: await getSenderFirstName(businessId),
      inboundText: inbound?.body ?? "",
    });
    return { text, what: "the first thank-you" };
  }

  const daysQuiet = Math.max(1, Math.round((now.getTime() - Date.parse(lead.lastContacted)) / DAY));
  let hint: string | undefined;
  let what = "the reply";
  if (rule === "silence") {
    // The customer's own plan and where they are in it (A-245); a plan that
    // has finished or stopped shows its first message.
    const state = followUpState(timeline(lead), Date.parse(lead.lastContacted), opts.followUpPlans ?? {}, lead.followUp ?? {}, now.getTime(), opts.deadLeadDays ?? DEAD_LEAD_DEFAULT_DAYS);
    const shown = state && state.kind !== null ? state : { step: 0, total: Math.max(1, state?.total ?? 5), kind: "open" as const, final: false };
    hint = stepHint(shown, daysQuiet);
    // "the first check-in", "check-in 3 of 10", "the last check-in".
    const name = checkInName(shown);
    what = /^Check-in \d/.test(name) ? name.toLowerCase() : `the ${name[0].toLowerCase()}${name.slice(1)}`;
  } else if (rule === DEAD_LEAD_ACTION) {
    hint = deadLeadMessageHint(daysQuiet);
    what = "the welcome-back message";
  }

  const voiceSamples = await getVoiceSamples(businessId);
  const lastInbound = [...lead.conversation].reverse().find((m) => m.direction === "inbound");
  if (lastInbound && (lastInbound.channel === "instagram" || lastInbound.channel === "messenger")) {
    const { trade, facts } = await draftingContext(businessId);
    const dm = await draftDm(lead.name, lead.conversation, voiceSamples, hint, undefined, language, facts, null, trade);
    return { text: dm.body, what };
  }
  const draft = await generateFollowUpMessage({ name: lead.name, conversation: lead.conversation, ...(await draftingContext(businessId)) }, voiceSamples, hint, undefined, language);
  return { text: draft.body, what };
}
