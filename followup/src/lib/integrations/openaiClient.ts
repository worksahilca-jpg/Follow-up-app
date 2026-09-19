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

export const MODEL = "gpt-4o-mini";
export const TRANSCRIBE_MODEL = "gpt-4o-mini-transcribe";

export function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set — add it to .env to enable AI scoring.");
  }
  return new OpenAI({ apiKey });
}
