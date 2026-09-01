/**
 * AI scoring + message generation — real implementation.
 *
 * Uses OpenAI's Structured Outputs (a JSON schema the model is constrained
 * to match) for scoring, so we always get back a well-formed
 * { score, reason, factors } instead of parsing free text.
 */

import OpenAI from "openai";
import { Lead, Message, ScoreFactor } from "@/lib/types";

const MODEL = "gpt-4o-mini";

function getClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set — add it to .env to enable AI scoring.");
  }
  return new OpenAI({ apiKey });
}

function formatTranscript(conversation: Message[]): string {
  if (conversation.length === 0) return "(no messages yet)";
  return conversation
    .map((m) => `[${m.direction} · ${m.channel} · ${new Date(m.date).toISOString().slice(0, 10)}] ${m.body}`)
    .join("\n");
}

const SCORE_JSON_SCHEMA = {
  name: "lead_score",
  strict: true,
  schema: {
    type: "object",
    properties: {
      score: {
        type: "integer",
        description: "0 (cold, no urgency) to 100 (extremely hot, follow up now)",
      },
      reason: {
        type: "string",
        description: "One or two sentences a busy salesperson can read in 3 seconds.",
      },
      factors: {
        type: "array",
        description: "3-5 short factors explaining the score, each with a contribution weight (can be negative).",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            weight: { type: "integer" },
          },
          required: ["label", "weight"],
          additionalProperties: false,
        },
      },
    },
    required: ["score", "reason", "factors"],
    additionalProperties: false,
  },
} as const;

export async function scoreLead(
  lead: Pick<Lead, "conversation" | "dealValue" | "lastContacted">
): Promise<{ score: number; reason: string; factors: ScoreFactor[] }> {
  const client = getClient();

  const daysSinceContact = Math.floor(
    (Date.now() - new Date(lead.lastContacted).getTime()) / 86400000
  );

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You are a sales follow-up assistant for a small business owner. Score how urgently they should " +
          "follow up with this lead TODAY, from 0 (cold, no urgency) to 100 (extremely hot, follow up now). " +
          "Weigh buying signals (pricing/timeline questions, opened emails, requests for a call), deal value, " +
          "and days since last contact — a long silence after a strong signal is often still warm, not cold. " +
          "Give 3-5 short factors explaining the score, each with a signed integer weight roughly summing to " +
          "the score. Write the reason in plain, concrete language — no corporate jargon.",
      },
      {
        role: "user",
        content:
          `Deal value: $${lead.dealValue}\n` +
          `Days since last contact: ${daysSinceContact}\n\n` +
          `Conversation:\n${formatTranscript(lead.conversation)}`,
      },
    ],
    response_format: { type: "json_schema", json_schema: SCORE_JSON_SCHEMA },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned no content for scoreLead.");

  const parsed = JSON.parse(raw) as { score: number; reason: string; factors: ScoreFactor[] };
  return {
    score: Math.max(0, Math.min(100, Math.round(parsed.score))),
    reason: parsed.reason,
    factors: parsed.factors,
  };
}

export async function generateFollowUpMessage(
  lead: Pick<Lead, "name" | "conversation">
): Promise<string> {
  const client = getClient();

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You draft short follow-up messages for a small-business owner to send to a sales lead, in their " +
          "voice. Reference something concrete from the conversation so it doesn't read as generic. Under 3 " +
          "sentences, warm but not pushy, no corporate jargon, no 'Dear ...' greeting and no sign-off/signature " +
          "— just the message body, ready to review and send.",
      },
      {
        role: "user",
        content:
          `Lead's first name: ${lead.name.split(" ")[0]}\n\n` +
          `Conversation so far:\n${formatTranscript(lead.conversation)}`,
      },
    ],
    max_tokens: 200,
  });

  const message = completion.choices[0]?.message?.content?.trim();
  if (!message) throw new Error("OpenAI returned no content for generateFollowUpMessage.");
  return message;
}
