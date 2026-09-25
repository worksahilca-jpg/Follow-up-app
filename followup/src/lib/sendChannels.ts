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
    // The same four questions as before, asked in the WHERE clause, with
    // only the id selected. src/lib/db.ts decrypts every token column that
    // comes back in a row, so selecting four real credentials to test them
    // for null (twice per business per hour, and on lead pages) decrypted
    // them for nothing (daily-path audit 2026-09-25 F12). An IS NOT NULL
    // test on the stored ciphertext needs no decryption at all.
    //
    // Why not just the id columns, as the Facebook/WhatsApp config GETs do:
    // Twilio's Account SID and Auth Token are saved independently
    // (src/app/api/twilio/config), so a SID alone does not mean Twilio can
    // send. Testing the tokens here keeps every answer exactly what it was.
    prisma.business.findUnique({
      where: {
        id: businessId,
        OR: [
          { instagramUserId: { not: null }, instagramAccessToken: { not: null } },
          { facebookPageId: { not: null }, facebookPageAccessToken: { not: null } },
          { whatsappPhoneNumberId: { not: null }, whatsappAccessToken: { not: null } },
          {
            twilioAccountSid: { not: null },
            twilioAuthToken: { not: null },
            OR: [{ twilioPhoneNumber: { not: null } }, { whatsappPhoneNumber: { not: null } }],
          },
        ],
      },
      select: { id: true },
    }),
    prisma.integration.findFirst({
      where: { status: "connected", provider: { in: ["gmail", "outlook"] }, user: { businessId } },
      select: { id: true },
    }),
  ]);
  return !!inbox || !!business;
}
