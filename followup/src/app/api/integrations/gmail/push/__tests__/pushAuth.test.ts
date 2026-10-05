/**
 * Security review L8 (2026-10-05): Gmail push can be checked with Google's signed token instead
 * of a secret in the URL. Until that is switched on, the URL secret is still required.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const { verifyIdToken } = vi.hoisted(() => ({ verifyIdToken: vi.fn() }));
vi.mock("googleapis", () => ({
  google: { auth: { OAuth2: class { verifyIdToken = verifyIdToken; } } },
}));
vi.mock("@/lib/integrations/gmail", () => ({ findBusinessIdByGmailAddress: vi.fn(async () => null) }));
vi.mock("@/lib/gmailSync", () => ({ syncGmailForBusinessFromPush: vi.fn() }));
vi.mock("@/lib/monitoring", () => ({ recordAuthFailure: vi.fn() }));

import { POST } from "../route";

const SA = "push@project.iam.gserviceaccount.com";
const body = JSON.stringify({ message: { data: Buffer.from(JSON.stringify({ emailAddress: "a@b.test" })).toString("base64") } });
const req = (url: string, auth?: string) =>
  new NextRequest(url, { method: "POST", body, headers: auth ? { authorization: auth } : {} });

beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.GMAIL_PUSH_AUDIENCE;
  delete process.env.GMAIL_PUSH_SERVICE_ACCOUNT;
  process.env.GMAIL_PUSH_SECRET = "s3cret";
});
afterEach(() => {
  delete process.env.GMAIL_PUSH_SECRET;
});

describe("Gmail push authentication", () => {
  it("still uses the URL secret while signed push isn't set up", async () => {
    expect((await POST(req("https://x.test/api/integrations/gmail/push?secret=wrong"))).status).toBe(403);
    expect((await POST(req("https://x.test/api/integrations/gmail/push?secret=s3cret"))).status).toBe(204);
  });

  describe("with signed push set up", () => {
    beforeEach(() => {
      process.env.GMAIL_PUSH_AUDIENCE = "https://x.test/api/integrations/gmail/push";
      process.env.GMAIL_PUSH_SERVICE_ACCOUNT = SA;
    });

    it("accepts Google's token for the right service account", async () => {
      verifyIdToken.mockResolvedValue({ getPayload: () => ({ email: SA, email_verified: true }) });
      expect((await POST(req("https://x.test/api/integrations/gmail/push", "Bearer tok"))).status).toBe(204);
      expect(verifyIdToken).toHaveBeenCalledWith({ idToken: "tok", audience: "https://x.test/api/integrations/gmail/push" });
    });

    it("refuses a token from another account, a bad token, or none", async () => {
      verifyIdToken.mockResolvedValueOnce({ getPayload: () => ({ email: "someone@else.test", email_verified: true }) });
      expect((await POST(req("https://x.test/api/integrations/gmail/push", "Bearer tok"))).status).toBe(403);
      verifyIdToken.mockRejectedValueOnce(new Error("bad signature"));
      expect((await POST(req("https://x.test/api/integrations/gmail/push", "Bearer tok"))).status).toBe(403);
      expect((await POST(req("https://x.test/api/integrations/gmail/push"))).status).toBe(403);
    });

    it("no longer accepts the URL secret alone", async () => {
      expect((await POST(req("https://x.test/api/integrations/gmail/push?secret=s3cret"))).status).toBe(403);
    });
  });
});
