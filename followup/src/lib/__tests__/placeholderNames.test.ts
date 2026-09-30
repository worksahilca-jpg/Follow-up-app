/**
 * A placeholder identity never reaches a customer.
 *
 * One rule, two halves, each of which shipped its own production
 * incident:
 *
 *   2026-09-19  "Hi! Instagram, I'll check on the availability for you
 *               shortly."  — the lead's own name was the row label
 *               findOrCreateLeadByInstagram writes before a handle is
 *               known. Fixed then, by greetingFirstName.
 *
 *   2026-09-20  "Thank you for contacting My Business."  — found in
 *               production, sent to four real people. That string comes
 *               from src/lib/auth.ts, which names a new workspace
 *               "<their name>'s Business" or, when Google hands over no
 *               name at all, the literal "My Business". It is a row
 *               label waiting to be replaced in Settings, and on the
 *               founder's own account it never was.
 *
 * The second half took a day longer than the first only because nobody
 * looked for it. They are tested together for the same reason they live
 * in one module: half a rule is how the other half gets forgotten.
 */
import { describe, it, expect } from "vitest";
import { greetingFirstName, businessDisplayName, isPlaceholderLeadName, customerGreetingName } from "@/lib/leadName";

describe("a business that has not named itself is not named at all", () => {
  it("refuses the literal default from auth.ts", () => {
    expect(businessDisplayName("My Business")).toBe("");
  });

  it("refuses it whatever the casing or padding", () => {
    expect(businessDisplayName("  my business  ")).toBe("");
    expect(businessDisplayName("MY BUSINESS")).toBe("");
  });

  it("refuses the other stand-ins that read as a label, not a name", () => {
    // "us" is acknowledge.ts's own fallback when the row is missing —
    // "Thank you for contacting us" is fine as a sentence, but reaching
    // it by NAMING the business "us" is the same bug wearing a hat.
    for (const n of ["us", "business", "Untitled", "unnamed", "", "   "]) {
      expect(businessDisplayName(n)).toBe("");
    }
  });

  it("returns null and undefined as no-name rather than throwing", () => {
    expect(businessDisplayName(null)).toBe("");
    expect(businessDisplayName(undefined)).toBe("");
  });

  it("keeps a real business name exactly as the owner typed it", () => {
    expect(businessDisplayName("MJ Homes")).toBe("MJ Homes");
    expect(businessDisplayName("Sahil's Business")).toBe("Sahil's Business");
    // Not a placeholder just because it contains the word.
    expect(businessDisplayName("Business Doctors Ltd")).toBe("Business Doctors Ltd");
    expect(businessDisplayName("My Business Solutions Inc")).toBe("My Business Solutions Inc");
  });
});

describe("the sentence is written without a name, never around a gap", () => {
  // The rule callers must follow: "" means rewrite the sentence, not
  // interpolate an empty string and ship "Thank you for contacting ."
  it("produces a complete sentence with a real name", () => {
    const named = businessDisplayName("MJ Homes");
    const line = named
      ? `Thank you for contacting ${named}. I've received your message and will get back to you shortly.`
      : "Thank you for your message. I've received it and will get back to you shortly.";
    expect(line).toBe("Thank you for contacting MJ Homes. I've received your message and will get back to you shortly.");
  });

  it("produces a complete sentence with no name, and no empty gap", () => {
    const named = businessDisplayName("My Business");
    const line = named
      ? `Thank you for contacting ${named}. I've received your message and will get back to you shortly.`
      : "Thank you for your message. I've received it and will get back to you shortly.";
    expect(line).toBe("Thank you for your message. I've received it and will get back to you shortly.");
    expect(line).not.toMatch(/contacting\s*\./);
    expect(line).not.toMatch(/My Business/);
  });
});

describe("the lead half, still holding", () => {
  it("still refuses the placeholder that shipped on 2026-09-19", () => {
    expect(greetingFirstName("Instagram DM")).toBe("");
  });

  it("still keeps a handle, which IS how you address someone on a DM channel", () => {
    expect(greetingFirstName("@sahildoes")).toBe("sahildoes");
  });

  it("still keeps a real first name", () => {
    expect(greetingFirstName("Priya Raman")).toBe("Priya");
  });
});

/**
 * Backlog b010: when Meta refuses the name lookup, findOrCreateLeadByMessenger
 * names the lead "Facebook Messenger". That label was not on the list, and
 * the drafting prompt took its first word, so drafts opened "Hi Facebook,".
 */
describe("every label a channel writes for an unnamed lead is no name at all", () => {
  // Each one is written by a real creation site — see the list's comment
  // in src/lib/leadName.ts for which.
  const createdByTheCode = ["Facebook Messenger", "Instagram DM", "Facebook lead", "WhatsApp contact"];
  const sameLabelOtherWords = ["Instagram User", "Messenger User", "Facebook User", "WhatsApp User", "WhatsApp lead", "SMS lead", "Messenger DM"];

  it.each([...createdByTheCode, ...sameLabelOtherWords])("%s", (label) => {
    expect(isPlaceholderLeadName(label)).toBe(true);
    expect(greetingFirstName(label)).toBe("");
    expect(greetingFirstName(label.toUpperCase())).toBe("");
    expect(greetingFirstName(`  ${label}  `)).toBe("");
  });

  it("refuses the first word of each label too, for callers that split before asking", () => {
    for (const label of [...createdByTheCode, ...sameLabelOtherWords]) {
      expect(greetingFirstName(label.split(" ")[0])).toBe("");
    }
  });

  it("still keeps real names that merely contain a channel word", () => {
    expect(greetingFirstName("Messenger Smith")).toBe("Messenger");
    expect(greetingFirstName("Faceboo Kim")).toBe("Faceboo");
    expect(isPlaceholderLeadName("@sahildoes")).toBe(false);
    expect(greetingFirstName("Test Lead (Sahil)")).toBe("Test");
  });

  it("treats no name at all as a placeholder", () => {
    expect(isPlaceholderLeadName("")).toBe(true);
    expect(isPlaceholderLeadName("   ")).toBe(true);
    expect(isPlaceholderLeadName(null)).toBe(true);
    expect(isPlaceholderLeadName(undefined)).toBe(true);
  });
});

/**
 * SMS and WhatsApp name a contact with no profile name by their phone
 * number, and a Lead Ad can fall back to an email address. The owner
 * reading an alert or a hold note should still see that number; a customer
 * must never be greeted by it. Two functions, one per reader.
 */
describe("a phone number or email is shown to the owner, never used to greet the customer", () => {
  const numbers = ["+14155551234", "+1 (415) 555-1234", "415.555.1234", "14155551234"];

  it("owner-facing: greetingFirstName leaves them exactly as before", () => {
    expect(greetingFirstName("+14155551234")).toBe("+14155551234");
    expect(greetingFirstName("jane.doe@example.com")).toBe("jane.doe@example.com");
    for (const n of numbers) expect(isPlaceholderLeadName(n)).toBe(false);
    expect(isPlaceholderLeadName("jane.doe@example.com")).toBe(false);
  });

  it("customer-facing: refuses a phone number, whole or already split on spaces", () => {
    for (const n of numbers) {
      expect(customerGreetingName(n)).toBe("");
      expect(customerGreetingName(n.split(" ")[0])).toBe("");
    }
  });

  it("customer-facing: refuses an email address", () => {
    expect(customerGreetingName("jane.doe@example.com")).toBe("");
  });

  it("customer-facing: refuses every channel label too", () => {
    for (const label of ["Facebook Messenger", "Facebook", "Instagram User", "Instagram DM", "WhatsApp contact", "SMS lead", ""]) {
      expect(customerGreetingName(label)).toBe("");
    }
  });

  it("customer-facing: keeps real names and handles, including ones with a number in them", () => {
    expect(customerGreetingName("Priya Raman")).toBe("Priya");
    expect(customerGreetingName("@sahildoes")).toBe("sahildoes");
    expect(customerGreetingName("Lucía")).toBe("Lucía");
    expect(customerGreetingName("सुनीता")).toBe("सुनीता");
    expect(customerGreetingName("Jo2 Smith")).toBe("Jo2");
  });
});
