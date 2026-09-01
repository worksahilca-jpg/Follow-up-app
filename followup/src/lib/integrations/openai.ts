/**
 * AI scoring + message generation — service abstraction.
 *
 * Demo mode uses the pre-written scores/messages in demo-data.ts. To go live:
 *
 *   1. Set OPENAI_API_KEY in .env
 *   2. Replace the bodies below with real chat completion calls.
 *   3. Keep the same function signatures so no page code needs to change.
 *
 * Suggested prompt shape for scoreLead: pass the conversation thread and ask
 * for a JSON object { score, reason, factors } — see README for a starter prompt.
 */

import { Lead, ScoreFactor } from "@/lib/types";

export async function scoreLead(
  _lead: Pick<Lead, "conversation" | "dealValue" | "lastContacted">
): Promise<{ score: number; reason: string; factors: ScoreFactor[] }> {
  // TODO(real API): send `lead.conversation` to the model and parse its score.
  return {
    score: 50,
    reason: "Demo mode: connect OpenAI to generate a real follow-up score.",
    factors: [{ label: "Demo placeholder", weight: 0 }],
  };
}

export async function generateFollowUpMessage(
  lead: Pick<Lead, "name" | "conversation">
): Promise<string> {
  // TODO(real API): send the conversation + lead name to the model and ask
  // for a short, contextual follow-up message in the business owner's voice.
  return `Hey ${lead.name.split(" ")[0]}, just checking in — let me know if you have any questions!`;
}
