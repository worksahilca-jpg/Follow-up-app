/**
 * The OpenAI client and the model name, on their own.
 *
 * Extracted from openai.ts (2026-09-19) for one structural reason: the
 * drafting prompts in that file now take a language instruction from
 * src/lib/leadLanguage.ts, and leadLanguage.ts itself needs a client to
 * run its detection call. Leaving both in openai.ts makes those two
 * modules import each other. A leaf module with no dependencies of its
 * own is the standard way out, and it is the same shape src/lib/
 * instagramId.ts and src/lib/leadName.ts already use here.
 */

import OpenAI from "openai";
import * as Sentry from "@sentry/nextjs";

/**
 * Which model writes (founder, 2026-10-04: "we should use newer models
 * every time"). The model is a setting, not code: OPENAI_MODEL in Vercel
 * picks it, so moving to a newer one is a change there, not a release of
 * new code. Unset, it is the model FollowUp has always run on.
 *
 * Never "always the newest automatically": a new model can reject a
 * setting the old one took, or change how replies read, and every reply
 * here goes out under a business owner's name. So a newer model is tried
 * on purpose, and if it fails, FollowUp falls back to the known-good one
 * for that call (see getClient) and reports it once, so a wrong or
 * unavailable model name can never stop replies being written.
 */
export const FALLBACK_MODEL = "gpt-4o-mini";
export const MODEL = process.env.OPENAI_MODEL?.trim() || FALLBACK_MODEL;
export const TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";

/**
 * GPT-5-family and o-series models think before they answer. They take
 * only the default temperature, and want max_completion_tokens instead of
 * max_tokens, where the budget also has to cover that thinking: the short
 * caps the drafting calls use (100-260) would be spent before a word of
 * the reply is written.
 */
export function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o\d)/.test(model);
}

const REASONING_MIN_BUDGET = 4000;

type ChatBody = Record<string, unknown> & { model: string };

/** The same request, in the shape this model accepts. */
export function adaptForModel(body: ChatBody, model: string): ChatBody {
  const out: ChatBody = { ...body, model };
  if (!isReasoningModel(model)) return out;
  delete out.temperature;
  delete out.top_p;
  const cap = (body.max_completion_tokens ?? body.max_tokens) as number | undefined;
  delete out.max_tokens;
  out.max_completion_tokens = Math.max(cap ?? 0, REASONING_MIN_BUDGET);
  return out;
}

let reportedFallback = false;

export function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set — add it to .env to enable AI scoring.");
  }
  const client = new OpenAI({ apiKey });
  const completions = client.chat.completions;
  const create = completions.create.bind(completions) as unknown as (body: ChatBody, options?: unknown) => Promise<unknown>;

  // Every chat call goes through here: adapted to the chosen model, and
  // retried once on the known-good model if the chosen one refuses the
  // request (an unknown name, a setting it doesn't take).
  (completions as unknown as { create: unknown }).create = async (body: ChatBody, options?: unknown) => {
    const model = body.model;
    try {
      return await create(adaptForModel(body, model), options);
    } catch (err) {
      const status = (err as { status?: number }).status;
      if (model === FALLBACK_MODEL || (status !== 400 && status !== 404)) throw err;
      if (!reportedFallback) {
        reportedFallback = true;
        console.warn(`OpenAI model "${model}" refused a request (${status}); using ${FALLBACK_MODEL} instead.`);
        Sentry.captureMessage(`OpenAI model "${model}" refused a request (${status}); fell back to ${FALLBACK_MODEL}`, {
          level: "warning",
          fingerprint: ["openai-model-fallback", model],
        });
      }
      return create(adaptForModel(body, FALLBACK_MODEL), options);
    }
  };
  return client;
}
