/**
 * A lead is named by how they sign, not by the account they wrote from
 * (backlog b033, founder 2026-10-01). The founder's own demo: "Priya"
 * wrote from his inbox and became a lead called "Sahil".
 */
import { describe, it, expect } from "vitest";
import { signOffName, customerDisplayName, threadCustomer } from "@/lib/sharedSenders";

describe("signOffName", () => {
  it("reads a name after a closing, on the same line or the next", () => {
    expect(signOffName("Is the 3-bedroom still available?\n\nThanks,\nPriya")).toBe("Priya");
    expect(signOffName("Is it available?\n\nThanks, Priya")).toBe("Priya");
    expect(signOffName("Hi there\n\nBest regards,\nPriya Sharma\nRE/MAX Hallmark\n416 555 0100")).toBe("Priya Sharma");
    expect(signOffName("Could you quote?\n\nCheers - Jean-Luc Picard")).toBe("Jean-Luc Picard");
    expect(signOffName("See you Saturday!\nKind regards\nAna María")).toBe("Ana María");
  });

  it("is null when there is no clear name", () => {
    expect(signOffName("Is it available? Thanks!")).toBeNull();
    expect(signOffName("Thanks,\n416-555-0100")).toBeNull();
    expect(signOffName("Regards,\npriya@example.com")).toBeNull();
    expect(signOffName("Best,\nThe Team")).toBeNull();
    expect(signOffName("thanks\nsent from my phone")).toBeNull();
    expect(signOffName("Thanks,\nSomeone who writes a whole sentence here instead")).toBeNull();
    expect(signOffName("")).toBeNull();
    expect(signOffName(null)).toBeNull();
  });

  it("ignores quoted history and phone footers", () => {
    expect(signOffName("Still interested.\n\nThanks,\nPriya\n\nOn Tue, Sam wrote:\n> Hi Priya,\n> Regards,\n> Sam")).toBe("Priya");
    expect(signOffName("Still interested\n\nSent from my iPhone\n\nThanks,\nSam")).toBeNull();
    expect(signOffName("Yes please.\n\n-- \nSam Smith\nSam's Plumbing")).toBeNull();
  });

  it("never takes a closing word or a label as the name", () => {
    expect(signOffName("Thanks,\nRegards")).toBeNull();
    expect(signOffName("Thanks,\nAdmin")).toBeNull();
  });

  // Code review, 2026-10-01: "Thanks Sahil" with only a space is the
  // customer thanking the owner by name, not signing. Only punctuation
  // between the closing and the name counts on one line.
  it("does not take the owner's name from 'Thanks Sahil' with no comma", () => {
    expect(signOffName("Is the house still available?\n\nThanks Sahil")).toBeNull();
    expect(signOffName("Thanks so much Sahil!")).toBeNull();
    expect(customerDisplayName("Priya", "Is it available?\n\nThanks Sahil")).toBe("Priya");
  });
});

describe("customerDisplayName", () => {
  it("uses the signed name when the account's name is someone else", () => {
    expect(customerDisplayName("Sahil", "Is it available?\n\nThanks,\nPriya")).toBe("Priya");
    expect(customerDisplayName("Mark Chen", "Hi!\nBest,\nPriya Chen")).toBe("Priya Chen");
  });
  it("keeps the fuller account name when it already carries the signed first name", () => {
    expect(customerDisplayName("Priya Sharma", "Thanks,\nPriya")).toBe("Priya Sharma");
    expect(customerDisplayName("priya.sharma", "Thanks,\nPriya")).toBe("priya.sharma");
  });
  it("keeps the account name when nothing is signed", () => {
    expect(customerDisplayName("Sahil", "Is it available? Thanks!")).toBe("Sahil");
  });
});

describe("threadCustomer names the lead by the sign-off", () => {
  const ours = (email: string) => email === "info@samsplumbing.ca";
  it("for a normal sender", () => {
    const from = { name: "Sahil", email: "sahil@example.com" };
    expect(threadCustomer([{ from, body: "Is the 3-bed still available?\n\nThanks,\nPriya" }], ours)).toEqual({ ...from, name: "Priya", shared: false });
  });
  it("for a form notifier's Reply-To person", () => {
    const replyTo = { name: "Website visitor", email: "priya@example.com" };
    const from = { name: "WordPress", email: "wordpress@site.com" };
    expect(threadCustomer([{ from, replyTo, body: "Please call me.\n\nRegards,\nPriya Sharma" }], ours)).toEqual({ ...replyTo, name: "Priya Sharma", shared: false });
  });
});
