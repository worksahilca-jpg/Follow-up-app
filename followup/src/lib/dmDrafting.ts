/**
 * Drafting an Instagram/Messenger DM end to end: pick the situation from
 * the thread (src/lib/dmDrafts.ts), ask the model (src/lib/integrations/
 * openai.ts), shape-check the answer, retry once, hand back the draft and
 * its buttons. Shared by the automation pass, the scoring pass and the
 * regenerate route so all three write the same kind of DM.
 */

import { generateFollowUpMessage } from "@/lib/integrations/openai";
import type { LeadLanguage } from "@/lib/leadLanguage";
import { businessText, checkDmDraftShape, conversationText, pickDmSituation, type DmTouch } from "@/lib/dmDrafts";
import type { StoredQuickReplies } from "@/lib/quickReplies";
import type { Message } from "@/lib/types";
import { factsText, type FactLine } from "@/lib/factLines";
import type { Criterion } from "@/lib/qualification";

/** Lead.suggestedQuickReplies as stored, or null for anything that isn't the shape. */
export function readStoredQuickReplies(value: unknown): StoredQuickReplies | null {
  if (!value || typeof value !== "object") return null;
  const v = value as { question?: unknown; buttons?: unknown };
  if (typeof v.question !== "string" || !Array.isArray(v.buttons)) return null;
  const buttons = v.buttons
    .filter((b): b is { title: string; exit?: unknown } => !!b && typeof b === "object" && typeof (b as { title?: unknown }).title === "string")
    .map((b) => ({ title: b.title, exit: b.exit === true }));
  return { question: v.question, buttons };
}

/**
 * Drafts an Instagram/Messenger DM: the situation is picked from the
 * thread (src/lib/dmDrafts.ts), the model writes to it, and the result is
 * shape-checked. One retry on a shape failure, then the caller holds it —
 * a draft with two questions or a chip nobody asked for never goes out
 * unreviewed. Returns the draft either way so the owner sees what was
 * attempted rather than nothing.
 */
export async function draftDm(
  leadName: string,
  conversation: Message[],
  voiceSamples: string[],
  messageHint: string | undefined,
  touch: DmTouch = "reply",
  // How this lead writes, decided once (src/lib/leadLanguage.ts).
  // Passed straight through; absent changes nothing.
  leadLanguage?: Partial<LeadLanguage> | null,
  // What the business has told customers (src/lib/businessFacts.ts, A-096):
  // in the draft's instructions, and counted as the business's own words by
  // the shape check, so "My commission is 2.5%" is grounded, not invented.
  facts: readonly FactLine[] = [],
  // The one thing still to learn from this customer (src/lib/qualification.ts),
  // which the reply may end by asking about. Null asks nothing new.
  qualify: Criterion | null = null
): Promise<{ body: string; quickReplies: StoredQuickReplies; shapeFailed: string | null }> {
  const situation = pickDmSituation(conversation, touch);
  const known = factsText(facts);
  const text = known ? `${conversationText(conversation)}\n${known}` : conversationText(conversation);
  const saidByBusiness = known ? `${businessText(conversation)}\n${known}` : businessText(conversation);
  let lastRule: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const draft = await generateFollowUpMessage({ name: leadName, conversation, facts, qualify }, voiceSamples, messageHint, situation, leadLanguage);
    const buttons = draft.buttons ?? [];
    // The draft is written in the lead's language, so the calendar rule
    // has to read it in that language — an English-only day list would be
    // the exact shortcut the founder rejected on the WhatsApp filter.
    const shape = checkDmDraftShape({ body: draft.body, buttons }, text, leadLanguage?.language, saidByBusiness);
    if (shape.ok) return { body: draft.body, quickReplies: { question: situation.id, buttons }, shapeFailed: null };
    lastRule = shape.rule;
    if (attempt === 1) return { body: draft.body, quickReplies: { question: situation.id, buttons: [] }, shapeFailed: lastRule };
  }
  /* istanbul ignore next -- unreachable, the loop always returns */
  throw new Error("draftDm: unreachable");
}
