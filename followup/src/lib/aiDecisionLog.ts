import { prisma } from "@/lib/db";
import { setAiCallSink, type AiCall } from "@/lib/integrations/openaiClient";

/**
 * The decision log: one row per AI call (step 1 of the plan in research/product/2026-10-23-self-improving-loop.md).
 * Which job it was, for which business and customer, which model was asked and which dated version answered, how long
 * it took, what it cost and, for the calls that decide something, what it decided. Without it no change to FollowUp's
 * prompts, lessons or model can be measured or undone precisely, and the model can change underneath FollowUp unseen.
 *
 * Never the customer's words: the prompt is kept only as a fingerprint (the same prompt twice has the same one), and
 * the rules and examples it carried as a fingerprint and two counts.
 *
 * Installed once per server from instrumentation.ts, so tests and scripts never write here; every AI call goes
 * through getClient() (src/lib/integrations/openaiClient.ts), which hands each one to this file.
 */

/**
 * USD per 1M tokens, at the time of writing (2026-10-23), for the models FollowUp has run or been set up to try. An
 * estimate for the founder's eyes, never a bill: check it against OpenAI's pricing page before trusting a total. A
 * model not listed gets no cost rather than a guessed one.
 */
export const RATES_PER_MTOK: Readonly<Record<string, { input: number; output: number }>> = {
  "gpt-4o-mini": { input: 0.15, output: 0.6 },
  "gpt-4o": { input: 2.5, output: 10 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "gpt-4.1-nano": { input: 0.1, output: 0.4 },
  "gpt-5": { input: 1.25, output: 10 },
  "gpt-5-mini": { input: 0.25, output: 2 },
  "gpt-5-nano": { input: 0.05, output: 0.4 },
};

/** "gpt-4o-mini" or a dated version of it ("gpt-4o-mini-2024-07-18"); never a different model sharing a prefix. */
function rateFor(model: string): { input: number; output: number } | null {
  if (RATES_PER_MTOK[model]) return RATES_PER_MTOK[model];
  const dated = /^(.+)-\d{4}-\d{2}-\d{2}$/.exec(model);
  return (dated && RATES_PER_MTOK[dated[1]]) || null;
}

/** The call's estimated cost in millionths of a US dollar, or null when the model or the token counts are unknown. */
export function estimateCostMicros(model: string, inputTokens: number | null, outputTokens: number | null): number | null {
  const rate = rateFor(model);
  if (!rate || inputTokens == null || outputTokens == null) return null;
  return Math.round(inputTokens * rate.input + outputTokens * rate.output);
}

/** A decision is a short label ("hot", "hold"), never text a customer or the model wrote at length. */
const CHOICE_MAX = 40;

export async function saveAiCall(call: AiCall): Promise<void> {
  await prisma.aiDecision.create({
    data: { ...call, costMicros: estimateCostMicros(call.modelUsed ?? call.modelRequested, call.inputTokens, call.outputTokens) },
  });
}

export async function saveAiChoice(responseId: string, choice: string): Promise<void> {
  await prisma.aiDecision.updateMany({ where: { responseId }, data: { choice: choice.slice(0, CHOICE_MAX) } });
}

export function installAiDecisionLog(): void {
  setAiCallSink({ call: saveAiCall, choice: saveAiChoice });
}
