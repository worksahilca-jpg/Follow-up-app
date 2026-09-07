import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * Encryption at rest for third-party credentials FollowUp holds on a
 * customer's behalf — Gmail OAuth tokens, a business's Twilio Auth Token,
 * its Instagram access token. Applied transparently by the Prisma client
 * extension in src/lib/db.ts, so call sites read and write plain strings
 * and never see ciphertext.
 *
 * AES-256-GCM with a random 12-byte IV per value; the stored form is
 * "enc:v1:<iv>:<tag>:<ciphertext>" (base64url). Anything without that
 * prefix is treated as legacy plaintext and passed through, so turning
 * this on is safe against existing rows — the sweep in
 * src/lib/secretsSweep.ts re-writes those within minutes.
 *
 * Key: TOKEN_ENCRYPTION_KEY, 32 bytes base64 (openssl rand -base64 32).
 * Without it, values are stored as they are today and a warning is logged
 * once — the app keeps working, just without this protection. With it set
 * and a row that was encrypted under a DIFFERENT key, decryption fails
 * loudly: that is a misconfiguration, not something to paper over.
 */
const PREFIX = "enc:v1:";

let warned = false;
function loadKey(): Buffer | null {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) {
    if (!warned) {
      warned = true;
      console.warn("TOKEN_ENCRYPTION_KEY is not set — third-party credentials are being stored unencrypted.");
    }
    return null;
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must be 32 bytes, base64-encoded.");
  return key;
}

export function isEncrypted(value: string): boolean {
  return value.startsWith(PREFIX);
}

export function encryptionEnabled(): boolean {
  return Boolean(process.env.TOKEN_ENCRYPTION_KEY);
}

export function encryptSecret(plain: string): string {
  if (isEncrypted(plain)) return plain;
  const key = loadKey();
  if (!key) return plain;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString("base64url")}:${tag.toString("base64url")}:${ct.toString("base64url")}`;
}

export function decryptSecret(stored: string): string {
  if (!isEncrypted(stored)) return stored;
  const key = loadKey();
  if (!key) throw new Error("A stored credential is encrypted but TOKEN_ENCRYPTION_KEY is not set.");
  const [ivB64, tagB64, ctB64] = stored.slice(PREFIX.length).split(":");
  if (!ivB64 || !tagB64 || !ctB64) throw new Error("Malformed encrypted credential.");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivB64, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, "base64url")), decipher.final()]).toString("utf8");
}
