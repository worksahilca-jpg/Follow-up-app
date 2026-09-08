/**
 * De-identifies conversation text before it could ever be used to train
 * FollowUp's models — see docs/security-roadmap.md, "Training on customer
 * data — the rules", rule 2: "Names, emails, phone numbers, addresses, and
 * any free-text identifier are stripped or replaced before a message
 * leaves the production database." This file is that boundary: nothing
 * downstream of buildDeidentifiedTrainingSet() ever sees a raw message.
 *
 * Two layers, applied in order:
 *
 *  1. Targeted substitution. Who's actually in a given conversation is
 *     already known structurally — the lead's own name/email/phone/company,
 *     the agent assigned to them — so each of those is looked up and
 *     replaced with a role-tagged placeholder ([LEAD_NAME], [AGENT_EMAIL],
 *     ...) everywhere it appears in the text. Far more reliable than
 *     pattern-matching alone: a plain first name like "Sam" or "Alex"
 *     would never survive a generic redaction pass, but exact substitution
 *     catches it every time because we know in advance exactly what to
 *     look for.
 *  2. Generic pattern backstop (reusing the same EMAIL_RE/PHONE_RE as
 *     src/lib/sentryScrub.ts, so the app's two PII scrubbers can't quietly
 *     drift apart, plus a street-address heuristic). Catches anyone the
 *     structured data doesn't know about — a referral's number, a spouse's
 *     email, a different agent mentioned by name with no record here.
 *
 * What this deliberately does NOT do yet: there is no separate training
 * store with its own retention/access-log (rule 3), and this only covers
 * Message.body — Lead.notes, scoreReason, and AIInsight.summary are free
 * text too but are out of scope for this pass (see docs/security-roadmap.md
 * for what's tracked as still open). Nothing here is wired into an actual
 * training job — FollowUp doesn't have one yet — this is the boundary
 * that has to exist before one safely could.
 */

import { prisma } from "@/lib/db";
import { EMAIL_RE, PHONE_RE } from "@/lib/sentryScrub";

// "123 Main Street", "456 Oak Ave, Apt 2" — a best-effort heuristic, not a
// real address parser. A missed address (no house number, a PO box, a
// non-US format) is a real gap; a false-positive redaction elsewhere costs
// nothing, so this stays broad.
const ADDRESS_RE =
  /\b\d{1,6}\s+[A-Za-z0-9.'-]+(?:\s+[A-Za-z0-9.'-]+){0,3}\s+(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Lane|Ln|Drive|Dr|Court|Ct|Way|Place|Pl|Circle|Cir|Terrace|Ter|Highway|Hwy|Parkway|Pkwy|Trail|Trl|Square|Sq)\.?\b/gi;

export interface KnownIdentifier {
  value: string;
  placeholder: string;
}

export function leadIdentifiers(lead: {
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
}): KnownIdentifier[] {
  const ids: KnownIdentifier[] = [];
  if (lead.name) ids.push({ value: lead.name, placeholder: "[LEAD_NAME]" });
  if (lead.email) ids.push({ value: lead.email, placeholder: "[LEAD_EMAIL]" });
  if (lead.phone) ids.push({ value: lead.phone, placeholder: "[LEAD_PHONE]" });
  if (lead.company) ids.push({ value: lead.company, placeholder: "[LEAD_COMPANY]" });
  return ids;
}

export function agentIdentifiers(user: { name: string | null; email: string } | null | undefined): KnownIdentifier[] {
  if (!user) return [];
  const ids: KnownIdentifier[] = [];
  if (user.name) ids.push({ value: user.name, placeholder: "[AGENT_NAME]" });
  if (user.email) ids.push({ value: user.email, placeholder: "[AGENT_EMAIL]" });
  return ids;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A phone number almost never shows up in free text byte-for-byte
 * identical to how it's stored — "(860) 935-8202" vs "8609358202" vs
 * "+1 860-935-8202" are all the same number. Matches on the digits alone,
 * with any punctuation/whitespace allowed (or not) between them, so
 * reformatting doesn't let it slip through.
 */
function phoneDigitsPattern(raw: string): RegExp | null {
  let digits = raw.replace(/\D/g, "");
  if (digits.length > 10 && digits.startsWith("1")) digits = digits.slice(1); // drop a US country code
  if (digits.length < 7) return null; // too short to fuzzy-match safely — skip rather than risk mangling ordinary numbers
  const spaced = digits.split("").join("[\\s.\\-()]*");
  return new RegExp(`\\+?1?[\\s.\\-()]*${spaced}`, "g");
}

function isPhoneShaped(value: string): boolean {
  return /^[\d\s().+-]+$/.test(value) && value.replace(/\D/g, "").length >= 7;
}

function replaceKnownValue(text: string, id: KnownIdentifier): string {
  if (!id.value.trim()) return text;
  if (isPhoneShaped(id.value)) {
    const pattern = phoneDigitsPattern(id.value);
    return pattern ? text.replace(pattern, id.placeholder) : text;
  }
  return text.replace(new RegExp(escapeRegExp(id.value), "gi"), id.placeholder);
}

/** The de-identification boundary itself — see the file header. */
export function deidentifyText(text: string, identifiers: KnownIdentifier[]): string {
  let result = text;
  for (const id of identifiers) {
    result = replaceKnownValue(result, id);
  }
  return result.replace(EMAIL_RE, "[EMAIL]").replace(PHONE_RE, "[PHONE]").replace(ADDRESS_RE, "[ADDRESS]");
}

export interface TrainingMessage {
  role: "lead" | "business";
  channel: string;
  text: string;
  sentAt: string;
}

export interface TrainingRecord {
  // Internal reference only, for the training store's own governance (so
  // a later business/lead deletion can find and remove rows derived from
  // it — rule 5) — never itself personal information, and never meant to
  // travel any further than that store's own access-controlled system.
  leadId: string;
  businessId: string;
  industry: string | null;
  messages: TrainingMessage[];
}

/**
 * The only function anything resembling a training job should ever call.
 * Returns [] outright for a business that hasn't opted in — de-identified
 * or not, its conversations are never even read for this purpose (rule 1)
 * — and de-identifies every message it does return (rule 2) before this
 * function's return value exists anywhere.
 */
export async function buildDeidentifiedTrainingSet(businessId: string): Promise<TrainingRecord[]> {
  const business = await prisma.business.findUnique({
    where: { id: businessId },
    select: { allowModelTraining: true, industry: true },
  });
  if (!business?.allowModelTraining) return [];

  const leads = await prisma.lead.findMany({
    where: { businessId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      assignedTo: { select: { name: true, email: true } },
      conversations: {
        select: {
          channel: true,
          messages: { select: { direction: true, body: true, sentAt: true }, orderBy: { sentAt: "asc" } },
        },
      },
    },
  });

  const records: TrainingRecord[] = [];
  for (const lead of leads) {
    const identifiers = [...leadIdentifiers(lead), ...agentIdentifiers(lead.assignedTo)];
    const messages: TrainingMessage[] = [];
    for (const conversation of lead.conversations) {
      for (const message of conversation.messages) {
        messages.push({
          role: message.direction === "inbound" ? "lead" : "business",
          channel: conversation.channel,
          text: deidentifyText(message.body, identifiers),
          sentAt: message.sentAt.toISOString(),
        });
      }
    }
    if (messages.length === 0) continue; // nothing to learn from
    records.push({ leadId: lead.id, businessId, industry: business.industry, messages });
  }
  return records;
}
