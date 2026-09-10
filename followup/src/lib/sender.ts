/**
 * Real greeting + signature, assembled here rather than trusted to the AI
 * (which would otherwise have to guess a name, or get told to omit one
 * entirely — the previous behavior, which read as an unsigned, abrupt
 * message). Whatever this returns is exactly what lands in the composer,
 * so it's still fully editable before anything sends.
 *
 * The frame follows the lead's language, not just the body: task #63's
 * live test sent a Spanish lead a Spanish-capable body wrapped in an
 * English "Hi Lucía," / "Best, Sahil" — every AI draft is already written
 * in the lead's language (generateFollowUpMessage / generateInstantReply
 * prompts), so this fixed frame was the one English thing left in every
 * non-English email FollowUp sent. Callers pass the lead's most recent
 * inbound message as `languageSample`; the frame alone (never the body,
 * which is already in-language and must not be re-generated) goes
 * through localizeFixedText once. No sample, or an English lead, means
 * the plain English frame — same output as before for the common case.
 */

import { prisma } from "@/lib/db";
import { localizeFixedText } from "@/lib/integrations/openai";
import type { Message } from "@/lib/types";

export async function getSenderFirstName(businessId: string): Promise<string> {
  const user = await prisma.user.findFirst({
    where: { businessId },
    orderBy: { createdAt: "asc" },
  });
  if (user?.name) return user.name.trim().split(" ")[0];
  if (user?.email) return user.email.split("@")[0];

  const business = await prisma.business.findUnique({ where: { id: businessId } });
  return business?.name ?? "the team";
}

/**
 * The lead's most recent inbound message — the one thing that decides
 * which language a reply (and its greeting/sign-off) should be in. Only
 * the latest inbound counts: a lead who switched languages mid-thread is
 * answered in the language they're writing in now, matching the rule the
 * drafting prompts already follow. Undefined when the lead has never
 * written anything (e.g. a CSV import), which callers treat as "no
 * localization, plain English frame."
 */
export function latestInboundText(conversation: Message[]): string | undefined {
  for (let i = conversation.length - 1; i >= 0; i--) {
    if (conversation[i].direction === "inbound" && conversation[i].body.trim()) return conversation[i].body;
  }
  return undefined;
}

/**
 * Greeting and sign-off, localized to match `languageSample` when one is
 * given. Translated as one small fixed string (one model call, no body
 * included) and split back apart; anything that doesn't come back in the
 * same two-part shape with the sender's name intact is treated as "the
 * model helped too much" and the English frame is used instead — an
 * English greeting is a cosmetic miss, a mangled signature is not.
 */
async function localizedFrame(
  leadFirstName: string,
  senderName: string,
  languageSample: string | undefined
): Promise<{ greeting: string; signOff: string }> {
  const greeting = `Hi ${leadFirstName},`;
  const signOff = `Best,\n${senderName}`;
  if (!languageSample?.trim()) return { greeting, signOff };

  const localized = await localizeFixedText(`${greeting}\n\n${signOff}`, languageSample);
  const parts = localized.split("\n\n");
  if (parts.length !== 2) return { greeting, signOff };
  const [g, s] = parts.map((p) => p.trim());
  if (!g || !s.includes(senderName)) return { greeting, signOff };
  return { greeting: g, signOff: s };
}

export async function composeFollowUpEmail(
  leadFirstName: string,
  businessId: string,
  body: string,
  options: { languageSample?: string } = {}
): Promise<string> {
  const senderName = await getSenderFirstName(businessId);
  const frame = await localizedFrame(leadFirstName, senderName, options.languageSample);
  return `${frame.greeting}\n\n${body}\n\n${frame.signOff}`;
}
