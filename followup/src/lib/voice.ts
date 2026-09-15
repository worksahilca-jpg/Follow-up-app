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

type Candidate = { leadId: string; body: string };

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
async function machineSentIndex(leadIds: string[]) {
  const sends = await prisma.followUp.findMany({
    where: { leadId: { in: leadIds } },
    select: { leadId: true, message: true, sentAt: true },
  });

  const index = new Map<string, { bodies: Set<string>; times: number[] }>();
  for (const s of sends) {
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

function isMachineSent(
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

/**
 * Up to MAX_SAMPLES of this business's own recent, human-written outbound
 * messages. An empty array is a real and expected answer — a brand-new
 * account, or one where every outbound message so far was sent by FollowUp
 * itself — and callers pass it straight through to
 * generateFollowUpMessage, whose no-samples branch states its own default
 * style. Never return a placeholder or a machine-written sample to avoid
 * returning nothing: no samples beats misleading samples.
 */
export async function getVoiceSamples(businessId: string): Promise<string[]> {
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
      select: { id: true, body: true, sentAt: true, conversation: { select: { leadId: true } } },
      take: SCAN_PAGE_SIZE,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (page.length === 0) break;
    scanned += page.length;
    cursor = page[page.length - 1].id;

    const leadIds = [...new Set(page.map((m) => m.conversation.leadId))];
    const machineSends = await machineSentIndex(leadIds);

    for (const m of page) {
      const leadId = m.conversation.leadId;
      if (isMachineSent(machineSends, leadId, m.body, m.sentAt)) continue;
      const body = m.body.trim();
      if (body.length < MIN_SAMPLE_LENGTH) continue;
      candidates.push({ leadId, body: body.slice(0, MAX_SAMPLE_LENGTH) });
    }

    if (pickSamples(candidates).length >= MAX_SAMPLES) break;
    if (page.length < SCAN_PAGE_SIZE) break;
  }

  return pickSamples(candidates);
}
