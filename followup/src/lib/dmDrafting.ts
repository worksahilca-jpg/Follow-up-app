/**
 * Drafting an Instagram/Messenger DM end to end: pick the situation from
 * the thread (src/lib/dmDrafts.ts), ask the model (src/lib/integrations/
 * openai.ts), shape-check the answer, retry once, hand back the draft and
 * its buttons. Shared by the automation pass, the scoring pass and the
 * regenerate route so all three write the same kind of DM.
 */

import { generateFollowUpMessage } from "@/lib/integrations/openai";
import type { LeadLanguage } from "@/lib/leadLanguage";
import { checkDmDraftShape, conversationText, pickDmSituation, type DmTouch } from "@/lib/dmDrafts";
import type { StoredQuickReplies } from "@/lib/quickReplies";
import type { Message } from "@/lib/types";

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
  leadLanguage?: Partial<LeadLanguage> | null
): Promise<{ body: string; quickReplies: StoredQuickReplies; shapeFailed: string | null }> {
  const situation = pickDmSituation(conversation, touch);
  const text = conversationText(conversation);
  let lastRule: string | null = null;
  for (let attempt = 0; attempt < 2; attempt++) {
    const draft = await generateFollowUpMessage({ name: leadName, conversation }, voiceSamples, messageHint, situation, leadLanguage);
    const buttons = draft.buttons ?? [];
    const shape = checkDmDraftShape({ body: draft.body, buttons }, text);
    if (shape.ok) return { body: draft.body, quickReplies: { question: situation.id, buttons }, shapeFailed: null };
    lastRule = shape.rule;
    if (attempt === 1) return { body: draft.body, quickReplies: { question: situation.id, buttons: [] }, shapeFailed: lastRule };
  }
  /* istanbul ignore next -- unreachable, the loop always returns */
  throw new Error("draftDm: unreachable");
}
