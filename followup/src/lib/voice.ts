/**
 * Voice sampling: pulls a few of the account's own past sent emails to use
 * as a style reference when drafting, so follow-ups read like the person
 * who'd actually send them instead of a generic AI tone.
 *
 * The corpus has to be written by a HUMAN at this business. An outbound
 * Message can be one of four things, and only the first belongs here:
 *
 *   1. real mail the owner typed themselves, picked up by Gmail/Outlook
 *      sync — the signal;
 *   2. a message FollowUp drafted and sent (sendFollowUpToLead,
 *      src/lib/sending.ts), which is a model's output wrapped in
 *      composeFollowUpEmail's fixed "Hi <name>," / "Best, <sender>" frame
 *      (src/lib/sender.ts);
 *   3. an outbound webhook echo from Meta (captureDirectReply,
 *      src/lib/instagram.ts) — most often Meta's own Business AI answering
 *      a DM, indistinguishable from a teammate typing in the native app;
 *   4. the voice agent's own spoken turns, written into a "voice-agent"
 *      conversation as outbound messages by the call callback.
 *
 * Feeding 2, 3 or 4 back in as "how this business writes" is a loop: the
 * model reads its own previous output, matches it, and the account's voice
 * drifts toward the machine — the exact opposite of what this feature
 * exists to do. Each is excluded below by structure, never by inspecting
 * the text for machine-sounding phrasing.
 *
 * Ordering is newest-first. It used to be oldest-first, on the theory that
 * the oldest 100 outbound messages predate FollowUp and are therefore
 * human — but that also meant the corpus was frozen at whatever the
 * account's very first thread looked like (one chatty old thread could
 * supply all five samples) and never reflected how the owner writes now.
 * With FollowUp's own sends filtered out properly, recent is strictly
 * better: it is still human, and it is current.
 *
 * Deliberately NOT done here: stripping greetings and sign-offs off the
 * samples. A sign-off a person actually typed is real voice signal and
 * can't be told apart from the one sender.ts adds; the drafting prompt is
 * told to ignore a sample's frame instead (see the voice block in
 * src/lib/integrations/openai.ts, commit f50d9ad).
 */

import { prisma } from "@/lib/db";

const MAX_SAMPLES = 5;
const MIN_SAMPLE_LENGTH = 40; // skip "Thanks!" / "Sounds good" — no style signal
const MAX_SAMPLE_LENGTH = 500; // keep the prompt bounded regardless of how long a real email ran

// At most this many samples from any one lead before others get a turn —
// five replies pulled out of a single long thread describe that thread,
// not how the business writes. Relaxed at the end if there genuinely
// isn't anything else to draw on.
const MAX_SAMPLES_PER_LEAD = 2;

// An account that automates heavily can have hundreds of FollowUp-sent
// messages sitting on top of its human mail, so one fixed page of recent
// outbound isn't enough to find the human ones. Walk back in pages until
// there are enough samples, with a hard ceiling so this stays a bounded
// amount of work on an account that has no human outbound at all.
const SCAN_PAGE_SIZE = 200;
const MAX_SCANNED = 1000;

// Conversations whose "outbound" messages are speech, not writing: the
// voice agent's turns, and call transcripts. Nothing said out loud tells
// us how this person writes an email.
const NON_WRITTEN_CHANNELS = ["voice-agent", "call"];

// How far apart a FollowUp row's sentAt and a Message's sentAt can be and
// still be the same send. sending.ts writes both within milliseconds of
// each other, but a send FollowUp made through Outlook is re-ingested by
// sync as a second row carrying the provider's own timestamp and the
// provider's own rendering of the body, which won't match byte-for-byte.
// This catches that copy.
const SAME_SEND_WINDOW_MS = 5 * 60 * 1000;

// `language` and `script` are the lead's, as last read (Lead.language,
// src/lib/leadLanguage.ts): the language the owner was writing in when
// they sent this. Absent for a lead never read and for "Write like me"
// history, which has no lead.
type Candidate = { leadId: string; body: string; language?: string | null; script?: string | null };

/** The language a draft is about to be written in; only these two fields matter here. */
export type VoiceLanguage = { language?: string | null; script?: string | null } | null | undefined;

/**
 * Everything this business has sent THROUGH FollowUp, keyed by lead.
 *
 * sending.ts writes a Message and a FollowUp row from the same `body`
 * variable for every send it makes (src/lib/sending.ts), and FollowUp.message
 * holds that exact composed text — so an exact body match against this
 * business's own FollowUp rows identifies a FollowUp-sent message
 * structurally, from the send record, rather than by judging the prose.
 * The timestamps cover the re-ingested-copy case above.
 */
export async function machineSentIndex(leadIds: string[], { ownerWordsAreHuman = false }: { ownerWordsAreHuman?: boolean } = {}) {
  const sends = await prisma.followUp.findMany({
    where: { leadId: { in: leadIds } },
    select: { leadId: true, message: true, sentAt: true, automated: true, draftEdited: true },
  });

  const index = new Map<string, { bodies: Set<string>; times: number[] }>();
  for (const s of sends) {
    // Learning from edits (founder, 2026-10-05, the "investment" idea from Hooked): a reply the
    // owner changed before sending, or typed themselves inside FollowUp, is their own writing,
    // not the machine's. For the voice samples it counts as human, so FollowUp's next drafts
    // learn from how the owner corrects them. Only what went out unchanged stays "machine".
    if (ownerWordsAreHuman && (s.draftEdited === true || (!s.automated && s.draftEdited === null))) continue;
    let entry = index.get(s.leadId);
    if (!entry) {
      entry = { bodies: new Set(), times: [] };
      index.set(s.leadId, entry);
    }
    const body = s.message?.trim();
    if (body) entry.bodies.add(body);
    if (s.sentAt) entry.times.push(s.sentAt.getTime());
  }
  return index;
}

export function isMachineSent(
  index: Map<string, { bodies: Set<string>; times: number[] }>,
  leadId: string,
  body: string,
  sentAt: Date
): boolean {
  const entry = index.get(leadId);
  if (!entry) return false;
  if (entry.bodies.has(body.trim())) return true;
  const at = sentAt.getTime();
  return entry.times.some((t) => Math.abs(t - at) <= SAME_SEND_WINDOW_MS);
}

/**
 * Newest-first, no more than MAX_SAMPLES_PER_LEAD from one lead — then, if
 * that leaves fewer than MAX_SAMPLES, fill the rest from what was skipped
 * (still newest-first). The cap improves the spread when the account has
 * plenty of human mail and costs nothing when it doesn't.
 */
function pickSamples(candidates: Candidate[]): string[] {
  const picked: string[] = [];
  const perLead = new Map<string, number>();
  const overflow: string[] = [];

  for (const c of candidates) {
    const used = perLead.get(c.leadId) ?? 0;
    if (used >= MAX_SAMPLES_PER_LEAD) {
      overflow.push(c.body);
      continue;
    }
    perLead.set(c.leadId, used + 1);
    picked.push(c.body);
    if (picked.length >= MAX_SAMPLES) return picked;
  }

  for (const body of overflow) {
    if (picked.length >= MAX_SAMPLES) break;
    picked.push(body);
  }
  return picked;
}

const sameLanguage = (c: Candidate, prefer: VoiceLanguage) =>
  !!prefer?.language && c.language?.toLowerCase() === prefer.language.toLowerCase();

/**
 * pickSamples, a tier at a time: the draft's language and script, then its
 * language in another script (romanized Punjabi and Gurmukhi are the same
 * language written very differently), then the rest. Each tier keeps the
 * one-person cap and newest-first order within itself.
 */
function pickPreferred(candidates: Candidate[], prefer: VoiceLanguage): string[] {
  if (!prefer?.language) return pickSamples(candidates);
  const script = prefer.script?.toLowerCase();
  const tiers: Candidate[][] = [[], [], []];
  for (const c of candidates) {
    if (!sameLanguage(c, prefer)) tiers[2].push(c);
    else if (script && c.script?.toLowerCase() === script) tiers[0].push(c);
    else tiers[1].push(c);
  }
  const picked: string[] = [];
  for (const tier of tiers) {
    for (const body of pickSamples(tier)) {
      if (picked.length >= MAX_SAMPLES) return picked;
      picked.push(body);
    }
  }
  return picked;
}

/**
 * Up to MAX_SAMPLES of this business's own recent, human-written outbound
 * messages. An empty array is a real and expected answer — a brand-new
 * account, or one where every outbound message so far was sent by FollowUp
 * itself — and callers pass it straight through to
 * generateFollowUpMessage, whose no-samples branch states its own default
 * style. Never return a placeholder or a machine-written sample to avoid
 * returning nothing: no samples beats misleading samples.
 *
 * `prefer` is the language the draft will be written in (founder,
 * 2026-10-14: "it should be learning from all those replies too, in every
 * language"). An owner who writes to one customer in Punjabi and another
 * in English writes differently in each, so their replies in the same
 * language and script come first, then the same language in another
 * script, then everything else to fill. Never only the same language: a
 * new Punjabi customer still gets the owner's English habits rather than
 * none. Absent keeps the order it always had.
 */
export async function getVoiceSamples(businessId: string, prefer?: VoiceLanguage): Promise<string[]> {
  const candidates: Candidate[] = [];
  let cursor: string | undefined;
  let scanned = 0;

  while (scanned < MAX_SCANNED) {
    const page = await prisma.message.findMany({
      where: {
        direction: "outbound",
        // Non-null means FollowUp captured this from another app rather
        // than sending it (instagram_direct / messenger_direct, i.e.
        // Meta's Business AI or the native app) — see Message.source in
        // prisma/schema.prisma.
        source: null,
        conversation: {
          channel: { notIn: NON_WRITTEN_CHANNELS },
          lead: { businessId },
        },
      },
      orderBy: [{ sentAt: "desc" }, { id: "desc" }],
      select: {
        id: true,
        body: true,
        sentAt: true,
        conversation: { select: { leadId: true, lead: { select: { language: true, languageScript: true } } } },
      },
      take: SCAN_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (page.length === 0) break;
    scanned += page.length;
    cursor = page[page.length - 1].id;

    const leadIds = [...new Set(page.map((m) => m.conversation.leadId))];
    const machineSends = await machineSentIndex(leadIds, { ownerWordsAreHuman: true });

    for (const m of page) {
      const leadId = m.conversation.leadId;
      if (isMachineSent(machineSends, leadId, m.body, m.sentAt)) continue;
      const body = m.body.trim();
      if (body.length < MIN_SAMPLE_LENGTH) continue;
      const lead = m.conversation.lead;
      candidates.push({ leadId, body: body.slice(0, MAX_SAMPLE_LENGTH), language: lead?.language, script: lead?.languageScript });
    }

    // With a language to prefer, keep walking back until there are enough
    // in it, or MAX_SCANNED says stop: a Punjabi customer on a mostly
    // English account is exactly when the older Punjabi replies matter.
    if (pickSamples(candidates.filter((c) => sameLanguage(c, prefer))).length >= MAX_SAMPLES) break;
    if (!prefer?.language && pickSamples(candidates).length >= MAX_SAMPLES) break;
    if (page.length < SCAN_PAGE_SIZE) break;
  }

  if (pickPreferred(candidates, prefer).length >= MAX_SAMPLES) return pickPreferred(candidates, prefer);

  // "Write like me" (src/lib/pastReplies.ts): replies this owner sent from
  // Gmail over the last year, kept de-identified with their yes. Only this
  // business's own, and only after its lead conversations, which are the
  // closest match to a reply FollowUp is about to draft. Empty unless the
  // owner turned it on; deleted when they turn it off.
  const past = await prisma.pastReply.findMany({
    where: { businessId },
    orderBy: { sentAt: "desc" },
    take: 60,
    select: { recipientKey: true, body: true },
  });
  return pickPreferred([
    ...candidates,
    // Keyed apart from any lead id, so the one-person cap still spreads
    // the samples across different people.
    ...past.map((p) => ({ leadId: `past:${p.recipientKey}`, body: p.body.slice(0, MAX_SAMPLE_LENGTH) })),
  ], prefer);
}
