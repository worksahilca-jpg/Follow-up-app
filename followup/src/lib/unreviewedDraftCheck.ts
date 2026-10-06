/**
 * The grounding check for a follow-up that goes out with nobody reading
 * it: the silence and unanswered rules (src/lib/automation.ts), a workflow
 * step (src/lib/sequences.ts), a reactivation batch (src/lib/reactivationSend.ts).
 *
 * inventedSpecific (src/lib/dmDrafts.ts) is the rule and stays pure; this
 * adds the inputs it can't compute from the thread — the business's own
 * configured details, which may appear as a link or address in the draft,
 * and what the business has told customers before (src/lib/businessFacts.ts).
 * Fetched only when the draft has a link or address at all, so the common
 * plain draft costs no query.
 */

import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/stripe";
import { inventedSpecific } from "@/lib/dmDrafts";
import { scanLinks } from "@/lib/grounding";
import { getBusinessFacts } from "@/lib/businessFacts";
import { factsText } from "@/lib/factLines";
import type { Message } from "@/lib/types";

/**
 * The links and addresses the business has configured, as strings for
 * scanLinks: every team member's sign-in address and connected Gmail or
 * Outlook address (what FollowUp sends from), and this lead's booking page
 * (/book/<leadId>, FollowUp's own).
 *
 * The business has no website or booking-link setting of its own; its
 * website counts once a person at the business has written it in the
 * thread, or put it in a step's note. The unsubscribe footer
 * (src/lib/suppression.ts) is not part of any draft at this stage.
 *
 * On any failure it returns nothing extra, so a link that needed one of
 * these is held rather than sent.
 */
export async function ownContactPoints(businessId: string, leadId: string): Promise<string[]> {
  try {
    // Plain columns only: Integration carries encrypted tokens
    // (ENCRYPTED_FIELDS in src/lib/db.ts) this has no use for.
    const users = await prisma.user.findMany({
      where: { businessId },
      select: { email: true, integrations: { where: { provider: { in: ["gmail", "outlook"] } }, select: { accountEmail: true } } },
    });
    const addresses = (users ?? []).flatMap((u) => [u.email, ...(u.integrations ?? []).map((i) => i.accountEmail)]);
    return [...addresses.filter((a): a is string => typeof a === "string" && a.length > 0), `${appUrl()}/book/${leadId}`];
  } catch (err) {
    console.error(`Could not read the business's own addresses for lead ${leadId}:`, err);
    return [];
  }
}

/**
 * inventedSpecific for a message about to go out unreviewed. `greeting` is
 * the composed email's greeting line (emailGreetingOf), when there is one.
 * Returns the failing rule, keyed like UNGROUNDED_DRAFT_REASONS, or null.
 */
export async function checkUnreviewedDraft(input: {
  text: string;
  conversation: Message[];
  businessId: string;
  leadId: string;
  locale?: string | null;
  ownerHint?: string | null;
  greeting?: string;
}): Promise<string | null> {
  const hasLink = scanLinks(`${input.text}\n${input.greeting ?? ""}`).links.length > 0;
  const configured = hasLink ? await ownContactPoints(input.businessId, input.leadId) : [];
  // What the business has told customers (src/lib/businessFacts.ts) is the
  // owner's own writing, like a step's note: a figure or link from it is
  // grounded, not invented.
  const facts = factsText(await getBusinessFacts(input.businessId));
  const ownerHint = [input.ownerHint, facts].filter((t): t is string => !!t && t.trim().length > 0).join("\n") || null;
  return inventedSpecific(input.text, input.conversation, input.locale, ownerHint, { configured, greeting: input.greeting });
}
