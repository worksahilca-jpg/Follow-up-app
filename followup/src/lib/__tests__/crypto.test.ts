/**
 * Guarantee: third-party credentials are unreadable at rest without the key.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const { captureMessage } = vi.hoisted(() => ({ captureMessage: vi.fn() }));
vi.mock("@sentry/nextjs", () => ({ captureMessage }));

const KEY_A = Buffer.alloc(32, 1).toString("base64");
const KEY_B = Buffer.alloc(32, 2).toString("base64");

async function load(key: string | undefined) {
  vi.resetModules();
  if (key === undefined) vi.stubEnv("TOKEN_ENCRYPTION_KEY", "");
  else vi.stubEnv("TOKEN_ENCRYPTION_KEY", key);
  return await import("@/lib/crypto");
}

describe("credential encryption", () => {
  beforeEach(() => vi.resetModules());

  it("encrypts to a prefixed ciphertext that decrypts back to the original", async () => {
    const c = await load(KEY_A);
    const enc = c.encryptSecret("ya29.token/with=symbols");
    expect(c.isEncrypted(enc)).toBe(true);
    expect(enc).not.toContain("ya29");
    expect(c.decryptSecret(enc)).toBe("ya29.token/with=symbols");
  });

  it("uses a fresh IV every time and never double-encrypts", async () => {
    const c = await load(KEY_A);
    const a = c.encryptSecret("same");
    const b = c.encryptSecret("same");
    expect(a).not.toBe(b);
    expect(c.encryptSecret(a)).toBe(a);
  });

  it("passes legacy plaintext through unchanged on read", async () => {
    const c = await load(KEY_A);
    expect(c.decryptSecret("legacy-plain-token")).toBe("legacy-plain-token");
  });

  it("fails loudly when a row was encrypted under a different key", async () => {
    const a = await load(KEY_A);
    const enc = a.encryptSecret("secret");
    const b = await load(KEY_B);
    expect(() => b.decryptSecret(enc)).toThrow();
  });

  it("without a key: stores as-is and refuses to pretend an encrypted row is readable", async () => {
    const c = await load(undefined);
    expect(c.encryptionEnabled()).toBe(false);
    expect(c.encryptSecret("plain")).toBe("plain");
    expect(() => c.decryptSecret("enc:v1:a:b:c")).toThrow(/TOKEN_ENCRYPTION_KEY/);
  });
});

// Audits 2026-09-16 M-3 / 2026-09-26 A-8: a production deploy without the
// key used to store every credential in plaintext with one console line
// nobody reads. It must raise a security alert — once per process, and
// never in development where running without a key is normal.
describe("a missing key in production", () => {
  beforeEach(() => {
    vi.resetModules();
    captureMessage.mockClear();
  });

  it("raises one Sentry security alert, however many credentials are written", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const c = await load(undefined);
    c.encryptSecret("a");
    c.encryptSecret("b");
    expect(captureMessage).toHaveBeenCalledTimes(1);
    expect(captureMessage).toHaveBeenCalledWith(
      expect.stringContaining("TOKEN_ENCRYPTION_KEY"),
      expect.objectContaining({ level: "error", tags: expect.objectContaining({ security_alert: "true" }) })
    );
  });

  it("stays quiet in development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    const c = await load(undefined);
    c.encryptSecret("a");
    expect(captureMessage).not.toHaveBeenCalled();
  });

  it("stays quiet when the key is set", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const c = await load(KEY_A);
    c.encryptSecret("a");
    expect(captureMessage).not.toHaveBeenCalled();
  });
});
