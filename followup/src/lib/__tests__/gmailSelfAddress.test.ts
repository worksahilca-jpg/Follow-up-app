/**
 * "Me" in a Gmail mailbox is the inbox that was connected, not the address
 * the owner signs in to FollowUp with (daily-path audit 2026-09-25 F4).
 *
 * Signed in as sam.smith@gmail.com with info@samsplumbing.ca connected, the
 * sync used to file Sam's own replies from info@ as the customer's — so the
 * unanswered rule drafted a reply to Sam's words — and every thread Sam
 * started made a lead that is the business itself.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { gmailSelfAddress } from "@/lib/integrations/gmail";

describe("gmailSelfAddress", () => {
  it("is the connected inbox when it differs from the login", () => {
    expect(gmailSelfAddress({ accountEmail: "Info@SamsPlumbing.ca", user: { email: "sam.smith@gmail.com" } })).toBe("info@samsplumbing.ca");
  });

  it("falls back to the login for connections made before the inbox was stored", () => {
    expect(gmailSelfAddress({ accountEmail: null, user: { email: "Sam.Smith@gmail.com" } })).toBe("sam.smith@gmail.com");
  });
});

describe("the Gmail sync and send never key 'me' on the login email", () => {
  const src = readFileSync(join(__dirname, "..", "integrations", "gmail.ts"), "utf8");
  it("no selfEmail from the login", () => {
    expect(src).not.toMatch(/selfEmail\s*=\s*integration\.user\.email/);
  });
  it("no From: header from the login", () => {
    expect(src).not.toMatch(/From: \$\{integration\.user\.email\}/);
  });
});
