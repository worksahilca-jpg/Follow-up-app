import { describe, it, expect } from "vitest";
import { deriveConsentBasis } from "@/lib/consent";

describe("deriveConsentBasis", () => {
  it("recognizes a website form submission as implied consent", () => {
    const c = deriveConsentBasis("Website form");
    expect(c.label).toBe("Submitted a form");
    expect(c.explanation).toMatch(/filled out a form/i);
  });

  it("recognizes inbound email as its own consent basis", () => {
    expect(deriveConsentBasis("Gmail").label).toBe("Emailed you first");
    expect(deriveConsentBasis("Gmail (spam)").label).toBe("Emailed you first");
    expect(deriveConsentBasis("Outlook").label).toBe("Emailed you first");
  });

  it("recognizes inbound SMS/voice as their own consent basis", () => {
    expect(deriveConsentBasis("Twilio SMS").label).toBe("Texted your number");
    expect(deriveConsentBasis("Voicemail").label).toBe("Called your number");
  });

  it("flags a CRM sync with the actual CRM's name in the explanation", () => {
    const c = deriveConsentBasis("HubSpot");
    expect(c.label).toBe("Synced from your CRM");
    expect(c.explanation).toContain("HubSpot");
  });

  it("flags sources with no first-contact basis for review", () => {
    const c = deriveConsentBasis("Referral");
    expect(c.label).toBe("Outside relationship");
    expect(c.explanation).toMatch(/didn't contact you first/i);
  });

  it("never returns a blank explanation for an unrecognized source", () => {
    const c = deriveConsentBasis("Some Weird Custom Source");
    expect(c.explanation.length).toBeGreaterThan(0);
    expect(c.explanation).toContain("Some Weird Custom Source");
  });

  it("handles a missing source without throwing", () => {
    expect(deriveConsentBasis(null).label).toBe("Not recorded");
    expect(deriveConsentBasis(undefined).label).toBe("Not recorded");
    expect(deriveConsentBasis("Unknown").label).toBe("Not recorded");
  });
});
