/**
 * validateMetaSignature() (src/lib/instagram.ts) — the authenticity gate
 * on POST /api/instagram/webhook, the single callback URL that receives
 * Instagram DMs, Facebook Messenger DMs and Facebook Lead Ads submissions.
 *
 * Two properties are load-bearing here, and neither held before:
 *
 *  1. It must accept a payload signed with EITHER of the app's two secrets.
 *     docs/meta-oauth-setup.md is explicit that the one "FollowUp" Meta app
 *     exposes "two separate products with two separate credential pairs":
 *     Instagram API with Instagram Login (INSTAGRAM_APP_SECRET) and
 *     Facebook Login for Business (FACEBOOK_APP_SECRET). Checking only the
 *     Instagram secret 403'd every `object: "page"` delivery — Messenger
 *     and Lead Ads, two entire inbound lead channels — which Meta retries
 *     for a while and then disables the subscription over.
 *
 *  2. It must fail CLOSED when neither secret is configured. It used to
 *     `return true`: entry[0].id is matched against Business.instagramUserId
 *     / facebookPageId, both public identifiers, so anyone could forge
 *     inbound "lead" messages into a stranger's account — each one spending
 *     the platform's OpenAI budget on scoring/drafting and firing a real
 *     outbound instant-acknowledgement DM.
 */
import { createHmac } from "crypto";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { recordAuthFailure } = vi.hoisted(() => ({ recordAuthFailure: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure }));
vi.mock("@/lib/db", () => ({ prisma: {} }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn() }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn() }));
vi.mock("@/lib/conversations", () => ({ findOrCreateConversation: vi.fn() }));

import { validateMetaSignature } from "@/lib/instagram";

const IG_SECRET = "instagram-app-secret";
const FB_SECRET = "facebook-app-secret";

const PAGE_BODY = JSON.stringify({ object: "page", entry: [{ id: "page-1", messaging: [] }] });
const IG_BODY = JSON.stringify({ object: "instagram", entry: [{ id: "ig-1", messaging: [] }] });

function sign(secret: string, body: string): string {
  return `sha256=${createHmac("sha256", secret).update(body, "utf8").digest("hex")}`;
}

beforeEach(() => {
  recordAuthFailure.mockClear();
  vi.stubEnv("INSTAGRAM_APP_SECRET", IG_SECRET);
  vi.stubEnv("FACEBOOK_APP_SECRET", FB_SECRET);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("validateMetaSignature", () => {
  it("accepts an Instagram payload signed with the Instagram app secret", () => {
    expect(validateMetaSignature(IG_BODY, sign(IG_SECRET, IG_BODY))).toBe(true);
  });

  it("accepts a Facebook Page payload signed with the Facebook app secret", () => {
    // The regression: Messenger DMs and Lead Ads arrive on this same URL
    // signed with the Facebook credential pair, not the Instagram one.
    expect(validateMetaSignature(PAGE_BODY, sign(FB_SECRET, PAGE_BODY))).toBe(true);
  });

  it("still accepts the Facebook secret when only FACEBOOK_APP_SECRET is configured", () => {
    vi.stubEnv("INSTAGRAM_APP_SECRET", "");
    expect(validateMetaSignature(PAGE_BODY, sign(FB_SECRET, PAGE_BODY))).toBe(true);
  });

  it("rejects a payload signed with a secret that is neither of ours", () => {
    expect(validateMetaSignature(PAGE_BODY, sign("attacker-guess", PAGE_BODY))).toBe(false);
  });

  it("rejects a tampered body even when the signature is well-formed", () => {
    const signature = sign(IG_SECRET, IG_BODY);
    expect(validateMetaSignature(IG_BODY.replace("ig-1", "ig-2"), signature)).toBe(false);
  });

  it("rejects a missing or malformed signature header", () => {
    expect(validateMetaSignature(IG_BODY, null)).toBe(false);
    expect(validateMetaSignature(IG_BODY, "sha1=deadbeef")).toBe(false);
    expect(validateMetaSignature(IG_BODY, "")).toBe(false);
  });

  it("fails CLOSED when neither app secret is configured, and records the auth failure", () => {
    vi.stubEnv("INSTAGRAM_APP_SECRET", "");
    vi.stubEnv("FACEBOOK_APP_SECRET", "");

    // An unsigned request from anyone on the internet.
    expect(validateMetaSignature(IG_BODY, null)).toBe(false);
    // ...and a plausibly-signed one, so "we got the header shape right"
    // is never on its own enough to be trusted.
    expect(validateMetaSignature(IG_BODY, sign("anything", IG_BODY))).toBe(false);

    expect(recordAuthFailure).toHaveBeenCalledWith("meta_webhook_verify", { reason: "not_configured" });
  });
});
