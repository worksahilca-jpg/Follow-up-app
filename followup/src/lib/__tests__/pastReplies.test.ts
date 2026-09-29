/**
 * "Write like me": which of the owner's sent Gmail replies are kept, how
 * they're cleaned and de-identified, and that the job only ever runs with
 * the owner's yes and stops leaving nothing behind when they say no.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    business: { findUnique: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
    user: { findMany: vi.fn() },
    message: { findMany: vi.fn() },
    followUp: { findMany: vi.fn() },
    pastReply: { createMany: vi.fn(), count: vi.fn(), deleteMany: vi.fn() },
    $transaction: vi.fn(async (ops: unknown[]) => ops),
  },
}));
vi.mock("@/lib/integrations/gmail", () => ({
  listSentReplies: vi.fn(),
  isAuthRevoked: (err: unknown) => err instanceof Error && err.message.includes("invalid_grant"),
}));

import { prisma } from "@/lib/db";
import { listSentReplies } from "@/lib/integrations/gmail";
import {
  cleanReplyBody,
  deidentifyReply,
  parseAddressList,
  readPastRepliesPage,
  recipientKey,
  replyRecipient,
  setPastRepliesAllowed,
} from "@/lib/pastReplies";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;
const list = listSentReplies as unknown as ReturnType<typeof vi.fn>;

const ALLOWED_AT = new Date("2026-09-28T19:00:00Z");
const BODY =
  "Hi Priya,\n\nYes we can do Thursday after 3. I'll bring the samples so you can pick the finish.\n\nThanks,\nDave\n\n" +
  "On Mon, Sep 21, 2026 at 9:14 AM Priya Shah <priya@example.com> wrote:\n> Could you come by this week?";

function reply(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: "g1",
    to: "Priya Shah <priya@example.com>",
    cc: "",
    subject: "Re: Deck quote",
    inReplyTo: "<abc@mail.gmail.com>",
    sentAt: new Date("2026-09-21T15:00:00Z"),
    body: BODY,
    ...over,
  };
}

const ctx = { ownAddresses: new Set(["dave@davesdecks.ca", "helper@davesdecks.ca"]), companyDomain: "davesdecks.ca" };

describe("cleanReplyBody", () => {
  it("keeps what the owner wrote and cuts the quoted history", () => {
    const out = cleanReplyBody(BODY);
    expect(out).toContain("Yes we can do Thursday after 3.");
    expect(out).not.toContain("wrote:");
    expect(out).not.toContain("Could you come by");
  });

  it("cuts a signature, a phone footer and an Outlook original-message block", () => {
    expect(cleanReplyBody("Sounds good, see you then.\n-- \nDave Smith\n555-0100")).toBe("Sounds good, see you then.");
    expect(cleanReplyBody("On my way now.\n\nSent from my iPhone")).toBe("On my way now.");
    expect(cleanReplyBody("Done.\n-----Original Message-----\nFrom: x")).toBe("Done.");
  });
});

describe("replyRecipient — only real replies to an outside person", () => {
  it("keeps a reply to a customer", () => {
    expect(replyRecipient(reply(), ctx)).toEqual({ name: "Priya Shah", email: "priya@example.com" });
  });

  it("skips a message that isn't a reply, and a forward", () => {
    expect(replyRecipient(reply({ inReplyTo: "" }), ctx)).toBeNull();
    expect(replyRecipient(reply({ subject: "Fwd: Deck quote" }), ctx)).toBeNull();
  });

  it("skips mail to the business itself, a teammate, and a colleague on the company domain", () => {
    expect(replyRecipient(reply({ to: "dave@davesdecks.ca" }), ctx)).toBeNull();
    expect(replyRecipient(reply({ to: "Helper <helper@davesdecks.ca>" }), ctx)).toBeNull();
    expect(replyRecipient(reply({ to: "office@davesdecks.ca" }), ctx)).toBeNull();
  });

  it("does not treat a shared free-mail domain as a colleague", () => {
    const gmailCtx = { ownAddresses: new Set(["dave@gmail.com"]), companyDomain: null };
    expect(replyRecipient(reply({ to: "sam@gmail.com" }), gmailCtx)).toEqual({ name: "", email: "sam@gmail.com" });
  });

  it("skips automated addresses and group emails", () => {
    expect(replyRecipient(reply({ to: "no-reply@shop.com" }), ctx)).toBeNull();
    expect(replyRecipient(reply({ to: "a@x.com, b@x.com", cc: "c@x.com, d@x.com" }), ctx)).toBeNull();
  });
});

describe("deidentifyReply", () => {
  it("replaces both people's names and addresses, and any other contact detail", () => {
    const out = deidentifyReply(
      "Hi Priya, Priya Shah here is the plan. Call me on 416-555-0199 or dave@davesdecks.ca. Cheers, Dave. Sample attached.",
      { recipientName: "Priya Shah", recipientEmail: "priya@example.com", ownerName: "Dave Smith", ownerEmail: "dave@davesdecks.ca" }
    );
    expect(out).not.toMatch(/Priya|Dave|416|davesdecks/);
    expect(out).toContain("[LEAD_NAME]");
    expect(out).toContain("[OWNER_NAME]");
    // A first name is replaced on word boundaries only.
    expect(out).toContain("Sample attached.");
  });

  const noNames = { recipientName: "", recipientEmail: "sam@example.com", ownerName: null, ownerEmail: "dave@davesdecks.ca" };

  it("takes the name out of the greeting when the To line carried only an address", () => {
    expect(deidentifyReply("Hi Sam,\n\nThursday works.", noNames)).toBe("Hi [LEAD_NAME],\n\nThursday works.");
    expect(deidentifyReply("Dear Mr. Patel,\nThanks for the photos.", noNames)).toBe("Dear Mr. [LEAD_NAME],\nThanks for the photos.");
    expect(deidentifyReply("Good morning Anne Marie!\nSee you then.", noNames)).toBe("Good morning [LEAD_NAME]!\nSee you then.");
  });

  it("leaves a greeting to a group or to nobody alone", () => {
    expect(deidentifyReply("Hi all,\nUpdate below.", noNames)).toBe("Hi all,\nUpdate below.");
    expect(deidentifyReply("Hi there, thanks for asking.", noNames)).toBe("Hi there, thanks for asking.");
    expect(deidentifyReply("Hi Team,\nUpdate below.", noNames)).toBe("Hi Team,\nUpdate below.");
  });

  it("replaces accented names and every part of a 'Last, First' name, as whole words", () => {
    const out = deidentifyReply("Zoë, thanks. Émile will call. Priya and Shah both fine. Zoëtrope stays.", {
      recipientName: "Shah, Priya",
      recipientEmail: "priya@example.com",
      ownerName: "Émile Zoë",
      ownerEmail: "e@x.ca",
    });
    expect(out).toBe("[OWNER_NAME], thanks. [OWNER_NAME] will call. [LEAD_NAME] and [LEAD_NAME] both fine. Zoëtrope stays.");
  });

  // Audit 2026-09-29: names went through the substring matcher, so they ate ordinary words.
  describe("never eats ordinary words (audit 2026-09-29)", () => {
    it("keeps words that contain a name", () => {
      const out = deidentifyReply("Here's the estimate for the time we discussed. A sample of the tile. Samples ship Monday.", {
        recipientName: "Tim",
        recipientEmail: "tim@example.com",
        ownerName: "Sam",
        ownerEmail: "sam@x.ca",
      });
      expect(out).toBe("Here's the estimate for the time we discussed. A sample of the tile. Samples ship Monday.");
    });

    it("leaves an owner named Will Don's everyday words alone, and still catches the full name", () => {
      const out = deidentifyReply("I will send it over, and I don't mind. Thanks, Will Don", {
        recipientName: "Mark Ed",
        recipientEmail: "mark@example.com",
        ownerName: "Will Don",
        ownerEmail: "will@x.ca",
      });
      expect(out).toBe("I will send it over, and I don't mind. Thanks, [OWNER_NAME]");
    });

    it("only matches a name as it's written, capitalised", () => {
      const out = deidentifyReply("I asked about the parts you wanted. Ed will call.", {
        recipientName: "Ed",
        recipientEmail: "ed@example.com",
        ownerName: "Art",
        ownerEmail: "a@x.ca",
      });
      expect(out).toBe("I asked about the parts you wanted. [LEAD_NAME] will call.");
    });
  });

  describe("catches the name in more greetings (audit 2026-09-29)", () => {
    it("two people, lowercase greetings and a bare name opener", () => {
      expect(deidentifyReply("Hi Sam and Jo,\nSee you Friday.", noNames)).toBe("Hi [LEAD_NAME],\nSee you Friday.");
      expect(deidentifyReply("hi sam,\nsee you friday", noNames)).toBe("hi [LEAD_NAME],\nsee you friday");
      expect(deidentifyReply("Sam,\n\nThanks for the photos.", noNames)).toBe("[LEAD_NAME],\n\nThanks for the photos.");
    });

    it("leaves ordinary openers alone", () => {
      expect(deidentifyReply("Thanks,\n\nSee you then.", noNames)).toBe("Thanks,\n\nSee you then.");
      expect(deidentifyReply("hi there, thanks", noNames)).toBe("hi there, thanks");
      expect(deidentifyReply("Great,\nbooked.", noNames)).toBe("Great,\nbooked.");
    });
  });
});

describe("parseAddressList / recipientKey", () => {
  it("reads names and addresses, ignoring commas inside quotes", () => {
    expect(parseAddressList('"Shah, Priya" <priya@example.com>, bob@x.com')).toEqual([
      { name: "Shah, Priya", email: "priya@example.com" },
      { name: "", email: "bob@x.com" },
    ]);
  });

  it("is short, stable and never the address", () => {
    expect(recipientKey("Priya@Example.com")).toBe(recipientKey("priya@example.com"));
    expect(recipientKey("priya@example.com")).toHaveLength(16);
    expect(recipientKey("priya@example.com")).not.toContain("priya");
  });
});

describe("readPastRepliesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    p.business.findUnique.mockResolvedValue({
      pastRepliesAllowedAt: ALLOWED_AT,
      pastRepliesStatus: "reading",
      pastRepliesPageToken: null,
      pastRepliesScanned: 0,
    });
    p.business.findFirst.mockResolvedValue({ id: "biz1" });
    p.business.updateMany.mockResolvedValue({ count: 1 });
    p.user.findMany.mockResolvedValue([{ email: "dave@davesdecks.ca" }]);
    p.message.findMany.mockResolvedValue([]);
    p.followUp.findMany.mockResolvedValue([]);
    p.pastReply.count.mockResolvedValue(1);
    list.mockResolvedValue({ replies: [reply()], nextPageToken: "next", selfEmail: "dave@davesdecks.ca", ownerName: "Dave Smith" });
  });

  it("does nothing without the owner's yes", async () => {
    p.business.findUnique.mockResolvedValue({ pastRepliesAllowedAt: null, pastRepliesStatus: null, pastRepliesScanned: 0 });
    expect((await readPastRepliesPage("biz1")).status).toBe("skipped");
    expect(list).not.toHaveBeenCalled();
  });

  it("keeps a cleaned, de-identified copy and carries on from the next page", async () => {
    const result = await readPastRepliesPage("biz1");
    expect(result.status).toBe("reading");
    const rows = p.pastReply.createMany.mock.calls[0][0].data;
    expect(rows).toHaveLength(1);
    expect(rows[0].businessId).toBe("biz1");
    expect(rows[0].body).toContain("[LEAD_NAME]");
    expect(rows[0].body).not.toMatch(/Priya|Dave|wrote:/);
    expect(rows[0].recipientKey).toBe(recipientKey("priya@example.com"));
    expect(p.business.updateMany).toHaveBeenCalledWith({
      where: { id: "biz1", pastRepliesAllowedAt: ALLOWED_AT },
      data: expect.objectContaining({ pastRepliesPageToken: "next", pastRepliesStatus: "reading", pastRepliesScanned: 1 }),
    });
  });

  it("never keeps a message FollowUp itself sent", async () => {
    const sentAt = new Date("2026-09-21T15:00:00Z");
    p.message.findMany.mockResolvedValue([{ externalId: "g1", body: "x", sentAt, conversation: { leadId: "lead1" } }]);
    p.followUp.findMany.mockResolvedValue([{ leadId: "lead1", message: "x", sentAt }]);
    await readPastRepliesPage("biz1");
    expect(p.pastReply.createMany).not.toHaveBeenCalled();
  });

  it("finishes on the last page", async () => {
    list.mockResolvedValue({ replies: [reply()], nextPageToken: null, selfEmail: "dave@davesdecks.ca", ownerName: null });
    expect((await readPastRepliesPage("biz1")).status).toBe("done");
    expect(p.business.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pastRepliesStatus: "done", pastRepliesPageToken: null }) })
    );
  });

  it("says Gmail needs reconnecting when the grant is revoked", async () => {
    list.mockRejectedValue(new Error("invalid_grant"));
    expect((await readPastRepliesPage("biz1")).status).toBe("failed");
    expect(p.business.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ pastRepliesStatus: "failed" }) })
    );
  });

  it("switched off mid-page: writes nothing", async () => {
    p.business.findFirst.mockResolvedValue(null);
    expect((await readPastRepliesPage("biz1")).status).toBe("skipped");
    expect(p.pastReply.createMany).not.toHaveBeenCalled();
  });

  it("switched off between writing and recording progress: deletes what it wrote", async () => {
    p.business.updateMany.mockResolvedValue({ count: 0 });
    expect((await readPastRepliesPage("biz1")).status).toBe("skipped");
    expect(p.pastReply.deleteMany).toHaveBeenCalledWith({ where: { businessId: "biz1" } });
  });
});

describe("setPastRepliesAllowed", () => {
  beforeEach(() => vi.clearAllMocks());

  it("on starts reading from the newest sent mail", async () => {
    await setPastRepliesAllowed("biz1", true);
    expect(p.business.update).toHaveBeenCalledWith({
      where: { id: "biz1" },
      data: expect.objectContaining({ pastRepliesStatus: "reading", pastRepliesPageToken: null, pastRepliesScanned: 0 }),
    });
    expect(p.pastReply.deleteMany).not.toHaveBeenCalled();
  });

  it("off deletes every kept reply, together with clearing the switch", async () => {
    await setPastRepliesAllowed("biz1", false);
    expect(p.$transaction).toHaveBeenCalled();
    expect(p.pastReply.deleteMany).toHaveBeenCalledWith({ where: { businessId: "biz1" } });
    expect(p.business.update).toHaveBeenCalledWith({
      where: { id: "biz1" },
      data: expect.objectContaining({ pastRepliesAllowedAt: null, pastRepliesStatus: null }),
    });
  });
});
