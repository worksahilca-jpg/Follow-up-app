import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";

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
 * channel for this lead connected" — that finer question is canSendOn
 * below, asked per lead once its channel is known. This one closes the
 * case where nothing at all can go out, cheaply, before any lead is loaded.
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

export type SendChannel = "email" | "text" | "whatsapp" | "instagram" | "messenger";

// "Stored" for a credential column. Tested in the WHERE clause rather than
// selected, so no token is decrypted to answer a yes/no question — db.ts
// decrypts whatever a query returns (audit 2026-09-25 daily path, F12).
const STORED = { not: null } as const;

// Each entry is the same test the provider wrapper makes before it calls
// out, so canSendOn never says yes to a send the wire would refuse for want
// of credentials, and never says no to one it would make.
const BUSINESS_CAN_SEND: Record<Exclude<SendChannel, "email">, Prisma.BusinessWhereInput> = {
  // sendInstagramMessage needs only the token; without a user id it posts
  // to /me/messages.
  instagram: { instagramAccessToken: STORED },
  // facebook.ts pageToken(): both, or "Facebook isn't connected yet".
  messenger: { facebookPageId: STORED, facebookPageAccessToken: STORED },
  // sendSms: SID, token and a number to send from.
  text: { twilioAccountSid: STORED, twilioAuthToken: STORED, twilioPhoneNumber: STORED },
  // sendFollowUpToLead uses the Cloud API connection when there is one and
  // the older Twilio WhatsApp sender otherwise — either can carry it.
  whatsapp: {
    OR: [
      { whatsappPhoneNumberId: STORED, whatsappAccessToken: STORED },
      { twilioAccountSid: STORED, twilioAuthToken: STORED, whatsappPhoneNumber: STORED },
    ],
  },
};

/**
 * Can this business send on THIS channel right now?
 *
 * The per-lead half of hasAnySendChannel (daily-path bug hunt 2026-09-25,
 * F5). "Is anything connected" let a business whose Gmail had died, but
 * whose Instagram token was still stored, straight through the gate above
 * — and from there every email lead was drafted, risk-checked, held and
 * announced every ~20 hours by the silence rule, and every hour by a
 * workflow step, for a message sendEmail then refused with "No Gmail
 * account is connected". That is where every beta account lands on day 7,
 * when Google expires a Testing app's refresh token (same audit, F6).
 * Asked before the draft, it costs one query; left to the send, it cost two
 * OpenAI calls and a notification each time.
 *
 * Email is judged per business, as the finding scoped it: a connected
 * Gmail or Outlook, the only rows gmail.ts and outlook.ts will send from.
 * A lead whose thread lives in a dead Gmail while Outlook is still
 * connected passes here and is still refused by the send — the rare
 * two-inbox case. The one that matters is an account with no inbox left.
 *
 * Read fresh on every call and never cached, like hasAnySendChannel, so a
 * reconnect is picked up on the next pass without anyone doing anything.
 */
export async function canSendOn(businessId: string, channel: SendChannel): Promise<boolean> {
  if (channel === "email") {
    const inbox = await prisma.integration.findFirst({
      where: { status: "connected", provider: { in: ["gmail", "outlook"] }, user: { businessId } },
      select: { id: true },
    });
    return inbox != null;
  }
  const business = await prisma.business.findFirst({
    where: { id: businessId, ...BUSINESS_CAN_SEND[channel] },
    select: { id: true },
  });
  return business != null;
}
