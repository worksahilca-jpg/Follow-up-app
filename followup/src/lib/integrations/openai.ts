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

const PROSPECT_CLASSIFICATION_SCHEMA = {
  name: "prospect_classification",
  strict: true,
  schema: {
    type: "object",
    properties: {
      isProspect: {
        type: "boolean",
        description:
          "True only if this is a genuine sales conversation with someone showing interest in buying the " +
          "business's product or service. False for personal correspondence, recruiters and job applications, " +
          "vendors/suppliers pitching the business, an existing customer's support or logistics message that " +
          "isn't about a new purchase, or a newsletter/notification sent from a real-looking address.",
      },
      reason: {
        type: "string",
        description: "One short sentence explaining the call.",
      },
    },
    required: ["isProspect", "reason"],
    additionalProperties: false,
  },
} as const;

/**
 * Triage step for Gmail sync: "is this thread actually a sales conversation
 * with a prospect" as opposed to any other real two-way email exchange
 * (personal, recruiting, vendors, support, a person-signed newsletter).
 * Kept separate from scoreLead — that scores urgency for a thread already
 * accepted as a lead; this decides whether it should become one at all.
 */
export async function classifyAsProspect(
  conversation: Message[]
): Promise<{ isProspect: boolean; reason: string }> {
  const client = getClient();

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You triage a small business owner's inbox before it reaches their CRM. Decide whether this email " +
          "thread is a genuine sales conversation with a prospective customer, as opposed to personal " +
          "correspondence, a recruiter or job application, a vendor or supplier pitching the business, an " +
          "existing customer's support/logistics message unrelated to a new sale, or a newsletter/notification " +
          "sent from a real-looking address. Lean toward true only for genuinely ambiguous business inquiries " +
          "about the business's own product or service.",
      },
      {
        role: "user",
        content: `Conversation:\n${formatTranscript(conversation)}`,
      },
    ],
    response_format: { type: "json_schema", json_schema: PROSPECT_CLASSIFICATION_SCHEMA },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned no content for classifyAsProspect.");

  return JSON.parse(raw) as { isProspect: boolean; reason: string };
}

const SEND_RISK_SCHEMA = {
  name: "send_risk_assessment",
  strict: true,
  schema: {
    type: "object",
    properties: {
      riskLevel: {
        type: "string",
        enum: ["low", "medium", "high"],
        description:
          "'low' only for a plain, low-stakes check-in that makes no new claims, promises, or commitments. " +
          "'medium' or 'high' if the draft or the recent conversation mentions pricing, discounts, contract " +
          "terms, deadlines, or any commitment, or if the lead's recent tone reads frustrated, upset, or like " +
          "they're comparing competitors or pushing back.",
      },
      reason: {
        type: "string",
        description: "One short sentence a human can read in 3 seconds to decide whether to approve it.",
      },
    },
    required: ["riskLevel", "reason"],
    additionalProperties: false,
  },
} as const;

/**
 * Trust-tiered execution gate: "safe enough to send with no human in the
 * loop, or does this need a human to look at it first." Separate from
 * scoreLead (urgency, already-accepted lead) and classifyAsProspect
 * (whether to become a lead at all) — this is the last check, run only
 * right before an automated send, on the specific drafted message.
 */
export async function assessSendRisk(
  lead: Pick<Lead, "conversation">,
  draftMessage: string
): Promise<{ riskLevel: "low" | "medium" | "high"; reason: string }> {
  const client = getClient();

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You decide whether a drafted follow-up email is safe to send completely automatically, with no " +
          "human review. When genuinely unsure, prefer 'medium' over 'low' — the cost of an unnecessary human " +
          "review is much lower than an autonomous message that overpromises, quotes a number, or mishandles a " +
          "sensitive moment with a real prospect.",
      },
      {
        role: "user",
        content:
          `Conversation so far:\n${formatTranscript(lead.conversation)}\n\n` +
          `Drafted follow-up (the message being considered for auto-send):\n${draftMessage}`,
      },
    ],
    response_format: { type: "json_schema", json_schema: SEND_RISK_SCHEMA },
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("OpenAI returned no content for assessSendRisk.");

  return JSON.parse(raw) as { riskLevel: "low" | "medium" | "high"; reason: string };
}

/**
 * Drafts only the body paragraph of a follow-up — no greeting, no
 * sign-off. Those get added by the caller (src/lib/sender.ts +
 * whoever calls this) using the real sender's name, so the email always
 * has an actual signature instead of the AI guessing or omitting one.
 *
 * `voiceSamples` (see src/lib/voice.ts) are a few of the account's own
 * past sent emails, used purely as a style reference — sentence length,
 * formality, how they open/close a thought — never as content to copy
 * into this specific reply. Optional: with none, this falls back to the
 * same generic-but-competent tone it always used.
 */
export async function generateFollowUpMessage(
  lead: Pick<Lead, "name" | "conversation">,
  voiceSamples: string[] = []
): Promise<string> {
  const client = getClient();

  const voiceBlock =
    voiceSamples.length > 0
      ? "\n\nHere are a few real emails this account has sent before — match their tone, formality, and " +
        "sentence rhythm, but write entirely new content about the current conversation, never reuse their " +
        "specific wording or details:\n" +
        voiceSamples.map((s, i) => `--- sample ${i + 1} ---\n${s}`).join("\n")
      : "";

  const completion = await client.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "system",
        content:
          "You draft the body of a follow-up email. You represent the business that was CONTACTED — the person " +
          "in this conversation reached out about the business's services. You are not the one requesting " +
          "anything; never write as if you're the one who needs a vendor, contractor, or service. Reference " +
          "something concrete and specific from the conversation so it doesn't read as generic. Write 2-4 " +
          "complete sentences: proper capitalization, no sentence fragments, no trailing off mid-thought, no run-on " +
          "clauses joined by a dash. Warm but professional — not stiff corporate jargon, but not overly casual " +
          "either. Do not include a greeting ('Hi ...', 'Dear ...') or a sign-off/signature of any kind — output " +
          "only the body paragraph itself." +
          voiceBlock,
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
