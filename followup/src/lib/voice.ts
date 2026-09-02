/**
 * Voice sampling: pulls a few of the account's own past sent emails to use
 * as a style reference when drafting, so follow-ups read like the person
 * who'd actually send them instead of a generic AI tone.
 *
 * Best-effort, not a guarantee of "pre-AI" authorship: an outbound Message
 * can come from a real email a person sent through Gmail directly (picked
 * up by sync) or one FollowUp itself drafted and sent earlier — nothing
 * distinguishes the two today. In practice this still works well: every
 * account starts with a backlog of real historical sent mail from before
 * FollowUp existed, and ordering oldest-first weights toward that backlog
 * rather than FollowUp's own recent drafts.
 */

import { prisma } from "@/lib/db";

const MAX_SAMPLES = 5;
const MIN_SAMPLE_LENGTH = 40; // skip "Thanks!" / "Sounds good" — no style signal
const MAX_SAMPLE_LENGTH = 500; // keep the prompt bounded regardless of how long a real email ran

export async function getVoiceSamples(businessId: string): Promise<string[]> {
  const messages = await prisma.message.findMany({
    where: {
      direction: "outbound",
      conversation: { lead: { businessId } },
    },
    orderBy: { sentAt: "asc" }, // oldest first — most likely to predate FollowUp itself
    select: { body: true },
    take: 100, // over-fetch, then filter by length below
  });

  const samples: string[] = [];
  for (const m of messages) {
    const body = m.body.trim();
    if (body.length < MIN_SAMPLE_LENGTH) continue;
    samples.push(body.slice(0, MAX_SAMPLE_LENGTH));
    if (samples.length >= MAX_SAMPLES) break;
  }
  return samples;
}
