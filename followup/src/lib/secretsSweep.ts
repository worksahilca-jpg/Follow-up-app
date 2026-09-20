import { prisma } from "@/lib/db";
import { encryptionEnabled } from "@/lib/crypto";

/**
 * One-way migration of legacy plaintext credentials to encrypted form.
 * Runs from the every-ten-minutes Gmail cron once TOKEN_ENCRYPTION_KEY is
 * set: finds rows whose credential columns don't carry the "enc:v1:"
 * prefix and re-saves them (the client extension in src/lib/db.ts does
 * the actual encrypting on write). Becomes a no-op within a couple of
 * ticks; safe to leave in place forever.
 */
const PREFIX = "enc:v1:";
const BATCH = 50;

export async function encryptPlaintextSecrets(): Promise<{ integrations: number; businesses: number }> {
  if (!encryptionEnabled()) return { integrations: 0, businesses: 0 };

  const integrations = await prisma.integration.findMany({
    where: {
      OR: [{ accessToken: { not: { startsWith: PREFIX } } }, { refreshToken: { not: { startsWith: PREFIX } } }],
    },
    select: { id: true, accessToken: true, refreshToken: true },
    take: BATCH,
  });
  for (const i of integrations) {
    // Values come back decrypted (plain) either way; writing them back
    // stores them encrypted.
    await prisma.integration.update({
      where: { id: i.id },
      data: { accessToken: i.accessToken, refreshToken: i.refreshToken },
    });
  }

  // All FOUR of the Business token fields src/lib/db.ts encrypts. This
  // swept only the first two until 2026-09-20, so a Page token or a
  // WhatsApp business token written while TOKEN_ENCRYPTION_KEY was unset
  // stayed plaintext in the database forever — the sweep that exists to
  // catch exactly that walked straight past them. Keep this list and
  // ENCRYPTED_FIELDS in db.ts in step; a fifth field needs a line here.
  const businesses = await prisma.business.findMany({
    where: {
      OR: [
        { twilioAuthToken: { not: { startsWith: PREFIX } } },
        { instagramAccessToken: { not: { startsWith: PREFIX } } },
        { facebookPageAccessToken: { not: { startsWith: PREFIX } } },
        { whatsappAccessToken: { not: { startsWith: PREFIX } } },
      ],
    },
    select: {
      id: true,
      twilioAuthToken: true,
      instagramAccessToken: true,
      facebookPageAccessToken: true,
      whatsappAccessToken: true,
    },
    take: BATCH,
  });
  for (const b of businesses) {
    await prisma.business.update({
      where: { id: b.id },
      data: {
        twilioAuthToken: b.twilioAuthToken,
        instagramAccessToken: b.instagramAccessToken,
        facebookPageAccessToken: b.facebookPageAccessToken,
        whatsappAccessToken: b.whatsappAccessToken,
      },
    });
  }

  return { integrations: integrations.length, businesses: businesses.length };
}
