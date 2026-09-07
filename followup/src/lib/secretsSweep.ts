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

  const businesses = await prisma.business.findMany({
    where: {
      OR: [
        { twilioAuthToken: { not: { startsWith: PREFIX } } },
        { instagramAccessToken: { not: { startsWith: PREFIX } } },
      ],
    },
    select: { id: true, twilioAuthToken: true, instagramAccessToken: true },
    take: BATCH,
  });
  for (const b of businesses) {
    await prisma.business.update({
      where: { id: b.id },
      data: { twilioAuthToken: b.twilioAuthToken, instagramAccessToken: b.instagramAccessToken },
    });
  }

  return { integrations: integrations.length, businesses: businesses.length };
}
