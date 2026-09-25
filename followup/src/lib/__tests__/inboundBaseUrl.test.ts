/**
 * The address FollowUp hands to other services must be one they can post
 * to without a redirect.
 *
 * 2026-09-25: production's NEXTAUTH_URL is the apex, Vercel redirects the
 * apex to www, and Meta's webhook POSTs to the apex arrived at www as GETs
 * and were refused — no WhatsApp or Instagram webhook had been processed
 * since Sep 19. Stripe and Pub/Sub push do not follow redirects at all.
 * Settings was printing the apex as the address to register.
 */
import { describe, it, expect, afterEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { inboundBaseUrl } from "@/lib/siteUrl";

const saved = { app: process.env.NEXTAUTH_URL, site: process.env.NEXT_PUBLIC_SITE_URL };
afterEach(() => {
  process.env.NEXTAUTH_URL = saved.app;
  process.env.NEXT_PUBLIC_SITE_URL = saved.site;
  if (saved.app === undefined) delete process.env.NEXTAUTH_URL;
  if (saved.site === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
});

describe("inboundBaseUrl", () => {
  it("hands out www when the app's own address is the apex that redirects to it", () => {
    process.env.NEXTAUTH_URL = "https://followupbase.io/";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(inboundBaseUrl()).toBe("https://www.followupbase.io");
  });

  it("keeps a preview deployment's own address", () => {
    process.env.NEXTAUTH_URL = "https://follow-up-app-git-branch.vercel.app";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(inboundBaseUrl()).toBe("https://follow-up-app-git-branch.vercel.app");
  });

  it("keeps localhost", () => {
    process.env.NEXTAUTH_URL = "http://localhost:3000";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(inboundBaseUrl()).toBe("http://localhost:3000");
  });

  it("keeps the app's address when it already is the public site", () => {
    process.env.NEXTAUTH_URL = "https://www.followupbase.io";
    delete process.env.NEXT_PUBLIC_SITE_URL;
    expect(inboundBaseUrl()).toBe("https://www.followupbase.io");
  });
});

describe("every address handed to another service uses it", () => {
  // The routes that print or register a URL for Meta, Zapier or Twilio to
  // call. appUrl() stays right for OAuth redirect URIs (a browser follows
  // the redirect, and those URIs are registered on the apex).
  const files = [
    "app/api/instagram/config/route.ts",
    "app/api/facebook/config/route.ts",
    "app/api/whatsapp/config/route.ts",
    "app/api/webhooks/config/route.ts",
    "app/api/twilio/config/route.ts",
    "app/api/twilio/number/route.ts",
    "app/api/twilio/voice/[secret]/route.ts",
  ];
  for (const f of files) {
    it(f, () => {
      const src = readFileSync(join(__dirname, "..", "..", f), "utf8");
      expect(src).not.toMatch(/\$\{appUrl\(\)\}\/api\//);
      expect(src).toMatch(/\$\{inboundBaseUrl\(\)\}\/api\//);
    });
  }
});
