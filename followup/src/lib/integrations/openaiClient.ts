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
import { AsyncLocalStorage } from "node:async_hooks";
import { createHash } from "node:crypto";

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
 * The model every customer's work runs on (founder, 2026-10-29: "I don't want to compromise the quality"; 2026-10-30:
 * "We don't have to do cost cutting... I want the best quality"). On the reply test of 2026-10-29 GPT-5.5 passed 20 of
 * 20, gpt-5.4-mini 18 and 19 on two runs, gpt-5.4 16. It wrote only the reply drafts until 2026-10-30; from then on it
 * also sorts, reads, scores, checks and writes every other message. Roughly five times slower and seven times the
 * price of gpt-5.4-mini: about $50 a month for a very busy inbox, almost all of it the email sorting.
 * A setting like OPENAI_MODEL: OPENAI_BEST_MODEL in Vercel (or its older name, OPENAI_REPLY_MODEL) changes it without
 * a release.
 */
export const BEST_MODEL = process.env.OPENAI_BEST_MODEL?.trim() || process.env.OPENAI_REPLY_MODEL?.trim() || "gpt-5.5";
/**
 * The jobs that stay on MODEL. The test graders, so a score still means what it meant before and the best model is
 * never marking its own work; and the demo box on the public website, which strangers can run and no customer reads.
 */
const USUAL_JOBS = new Set(["grade_reply", "grade_rule", "demo_reply"]);

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

/**
 * One AI call, as the decision log keeps it (src/lib/aiDecisionLog.ts, step 1 of the plan in
 * research/product/2026-10-23-self-improving-loop.md). Ids, models, counts and fingerprints only: never the words of
 * the prompt or the answer.
 */
export interface AiCall {
  /** Which job: the name the calling function gives getClient(). */
  purpose: string;
  businessId: string | null;
  leadId: string | null;
  modelRequested: string;
  /** The dated version that actually answered (OpenAI's own answer), or null when the call failed. */
  modelUsed: string | null;
  fellBack: boolean;
  ok: boolean;
  errorStatus: number | null;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  /** A fingerprint of the messages sent: the same prompt twice has the same one, and it can't be read back. */
  promptHash: string;
  /** A fingerprint of the rules and examples the prompt carried, when it carried any. */
  lessonsHash: string | null;
  rules: number | null;
  examples: number | null;
  /** OpenAI's id for the answer, so what it decided can be added once the caller has read it (noteAiChoice). */
  responseId: string | null;
}

export interface AiCallSink {
  call(call: AiCall): Promise<void>;
  choice(responseId: string, choice: string): Promise<void>;
}

/** The rules and examples a drafting call carries, so the log can tell one set of lessons from another. */
export interface AiLessons {
  rules?: readonly string[];
  examples?: readonly unknown[];
}

// On globalThis: instrumentation.ts installs the log once per server, and its copy of this module may not be the one
// a route's bundle loads.
const SINK = Symbol.for("followup.aiCallSink");
const CONTEXT = Symbol.for("followup.aiCallContext");
/**
 * Who a call is for; `tag` marks a run that isn't a real customer's ("test" for the reply tests, "train" for the founder's
 * practice). `writeWith` is the reply test's side-by-side run: the jobs that write a reply use that model, and everything
 * else runs on the model it always does (the grader on the usual one).
 */
type Where = { businessId?: string | null; leadId?: string | null; tag?: string; writeWith?: string };

/** The jobs that write the words a customer reads; `writeWith` changes only these. */
const WRITING = new Set(["draft_reply", "draft_first_reply"]);
const shared = globalThis as unknown as { [SINK]?: AiCallSink | null; [CONTEXT]?: AsyncLocalStorage<Where> };
const where = (shared[CONTEXT] ??= new AsyncLocalStorage<Where>());

export function setAiCallSink(sink: AiCallSink | null): void {
  shared[SINK] = sink;
}

/** Every AI call made inside `run` is logged against this business and customer. */
export function withAiContext<T>(context: Where, run: () => Promise<T>): Promise<T> {
  return where.run({ ...where.getStore(), ...context }, run);
}

/** The log must never hold up or break a reply: it gets two seconds, and its errors stay here. */
const LOG_WAIT_MS = 2000;

async function toLog(write: (sink: AiCallSink) => Promise<void>): Promise<void> {
  const sink = shared[SINK];
  if (!sink) return;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      write(sink),
      new Promise<void>((done) => {
        timer = setTimeout(done, LOG_WAIT_MS);
        timer.unref?.();
      }),
    ]);
  } catch (err) {
    console.warn("AI decision log: couldn't save a row:", err instanceof Error ? err.message : err);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/** What a call that decides something decided ("hot", "hold", "customer"), added to its row. A short label only. */
export async function noteAiChoice(responseId: string | null | undefined, choice: string): Promise<void> {
  if (!responseId) return;
  await toLog((sink) => sink.choice(responseId, choice));
}

const fingerprint = (value: unknown): string => createHash("sha256").update(JSON.stringify(value ?? null)).digest("hex");

type Answer = { id?: string; model?: string; usage?: { prompt_tokens?: number; completion_tokens?: number } };

export function getClient(purpose = "other", lessons?: AiLessons): OpenAI {
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
  // Every call is also handed to the decision log (src/lib/aiDecisionLog.ts), answered or not.
  (completions as unknown as { create: unknown }).create = async (body: ChatBody, options?: unknown) => {
    const here = where.getStore();
    const trying = here?.writeWith && WRITING.has(purpose) ? here.writeWith : null;
    // A job asked for the usual model gets the best one; a caller that named another model keeps it.
    const best = !trying && !USUAL_JOBS.has(purpose) && body.model === MODEL && BEST_MODEL !== MODEL;
    const model = trying ?? (best ? BEST_MODEL : body.model);
    const started = Date.now();
    const log = (fellBack: boolean, answer: Answer | null, err?: unknown) =>
      toLog((sink) =>
        sink.call({
          purpose: here?.tag ? `${here.tag}:${purpose}` : purpose,
          businessId: here?.businessId ?? null,
          leadId: here?.leadId ?? null,
          modelRequested: model,
          modelUsed: answer?.model ?? null,
          fellBack,
          ok: answer !== null,
          errorStatus: answer ? null : ((err as { status?: number } | undefined)?.status ?? null),
          latencyMs: Date.now() - started,
          inputTokens: answer?.usage?.prompt_tokens ?? null,
          outputTokens: answer?.usage?.completion_tokens ?? null,
          promptHash: fingerprint(body.messages),
          lessonsHash: lessons ? fingerprint({ rules: lessons.rules ?? [], examples: lessons.examples ?? [] }) : null,
          rules: lessons ? (lessons.rules?.length ?? 0) : null,
          examples: lessons ? (lessons.examples?.length ?? 0) : null,
          responseId: answer?.id ?? null,
        })
      );
    try {
      const answer = await create(adaptForModel(body, model), options);
      await log(false, answer as Answer);
      return answer;
    } catch (err) {
      const status = (err as { status?: number }).status;
      // A model being tried never falls back: the test would score the known-good model under the new one's name.
      // The best model falls back on any failure (a refusal, a rate limit, an outage) to the usual model, so a
      // customer is sorted and answered either way; any other model only on a refusal, to the known-good one.
      const fallbackTo = trying
        ? null
        : best
          ? body.model
          : model !== FALLBACK_MODEL && (status === 400 || status === 404)
            ? FALLBACK_MODEL
            : null;
      if (!fallbackTo) {
        await log(false, null, err);
        throw err;
      }
      if (!reportedFallback) {
        reportedFallback = true;
        console.warn(`OpenAI model "${model}" failed a request (${status ?? "no status"}); using ${fallbackTo} instead.`);
        Sentry.captureMessage(`OpenAI model "${model}" failed a request (${status ?? "no status"}); fell back to ${fallbackTo}`, {
          level: "warning",
          fingerprint: ["openai-model-fallback", model],
        });
      }
      try {
        const answer = await create(adaptForModel(body, fallbackTo), options);
        await log(true, answer as Answer);
        return answer;
      } catch (again) {
        await log(true, null, again);
        throw again;
      }
    }
  };
  return client;
}
