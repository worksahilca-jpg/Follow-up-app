import { prisma } from "@/lib/db";

/**
 * Can this business send anything at all right now?
 *
 * Found on 2026-09-19 in a real account: the owner connected Gmail, got
 * two automatic follow-ups the next day, and disconnected Gmail that
 * evening. For the twelve days after, the hourly automation kept drafting
 * follow-ups for his eleven old leads and holding them for approval — 97
 * holds, each an OpenAI call or two — for an inbox that could not send a
 * single one. Drafting for a business with no way to send is pure spend.
 *
 * The rule: a business with no connected send channel gets no automated
 * drafting. It resumes on its own the moment something is connected,
 * because this is read fresh on every run, never cached on the business.
 *
 * Coarse on purpose. It asks "is anything connected", not "is the right
 * channel for this lead connected" — a business with Instagram connected
 * but Gmail dropped will still draft for its email leads and fail at send
 * time. That finer check belongs with the per-lead channel choice in
 * src/lib/sending.ts and is a later step; this closes the case where
 * nothing at all can go out, which is the one that costs money for nothing.
 */
export async function hasAnySendChannel(businessId: string): Promise<boolean> {
  const [business, inbox] = await Promise.all([
    prisma.business.findUnique({
      where: { id: businessId },
      select: {
        instagramUserId: true,
        instagramAccessToken: true,
        facebookPageId: true,
        facebookPageAccessToken: true,
        whatsappPhoneNumberId: true,
        whatsappAccessToken: true,
        twilioAccountSid: true,
        twilioAuthToken: true,
        twilioPhoneNumber: true,
        whatsappPhoneNumber: true,
      },
    }),
    prisma.integration.findFirst({
      where: { status: "connected", provider: { in: ["gmail", "outlook"] }, user: { businessId } },
      select: { id: true },
    }),
  ]);
  if (inbox) return true;
  if (!business) return false;
  if (business.instagramUserId && business.instagramAccessToken) return true;
  if (business.facebookPageId && business.facebookPageAccessToken) return true;
  if (business.whatsappPhoneNumberId && business.whatsappAccessToken) return true;
  if (business.twilioAccountSid && business.twilioAuthToken && (business.twilioPhoneNumber || business.whatsappPhoneNumber)) return true;
  return false;
}
