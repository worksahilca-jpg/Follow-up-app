/**
 * Leads from lead marketplaces (backlog b007, founder 2026-09-29).
 *
 * Thumbtack, Angi, HomeAdvisor, Zillow, Realtor.com, Yelp, Houzz, Bark and
 * Porch pass a customer's request on as their own notification, usually
 * from a no-reply address. The Gmail and Outlook syncs skipped every
 * no-reply sender before the classifier ever saw it (threadCustomer with
 * isAutomatedAddress), and the classifier's own prompt called "automated
 * platform notifications" false. Either one was enough to lose the lead.
 *
 * Now a marketplace's notice that reads like one person's request reaches
 * the classifier, and the prompt counts it as customer business. The same
 * marketplace's receipts, reports and promotions, and every other no-reply
 * sender, are skipped exactly as before. No real OpenAI or Google call is
 * made here.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { threadsGet, threadsList, prismaMock, classifyWithSecondLook } = vi.hoisted(() => ({
  threadsGet: vi.fn(),
  threadsList: vi.fn(),
  classifyWithSecondLook: vi.fn(),
  prismaMock: {
    integration: { findFirst: vi.fn(), updateMany: vi.fn() },
    business: { findUnique: vi.fn() },
    filteredEmail: { deleteMany: vi.fn(), findUnique: vi.fn(), upsert: vi.fn() },
    lead: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), updateMany: vi.fn(), findUniqueOrThrow: vi.fn() },
    conversation: { findUnique: vi.fn(), create: vi.fn() },
    message: { upsert: vi.fn() },
  },
}));

vi.mock("googleapis", () => ({
  google: {
    auth: {
      OAuth2: class {
        setCredentials() {}
      },
    },
    gmail: () => ({ users: { threads: { get: threadsGet, list: threadsList } } }),
  },
}));
vi.mock("@/lib/db", () => ({ prisma: prismaMock }));
vi.mock("@/lib/integrations/openai", () => ({ classifyAsProspect: vi.fn(), classifyWithSecondLook }));
vi.mock("@/lib/assignment", () => ({ pickAssignee: vi.fn(async () => null) }));
vi.mock("@/lib/outboundWebhook", () => ({ notifyLeadEvent: vi.fn(async () => undefined) }));
vi.mock("@/lib/engagement", () => ({ checkRapidEngagement: vi.fn(async () => undefined) }));
vi.mock("@/lib/sourceRouting", () => ({ applySourceRouting: vi.fn(async () => undefined) }));
vi.mock("@/lib/acknowledge", () => ({ acknowledgeNewLead: vi.fn(async () => undefined) }));

import { fetchSalesConversations } from "@/lib/integrations/gmail";
import { fetchOutlookConversations } from "@/lib/integrations/outlook";
import {
  contactNameFromBody,
  contactPhoneFromBody,
  isAutomatedAddress,
  isLeadMarketplaceAddress,
  isMarketplaceLeadNotice,
  leadSiteLink,
  leadSiteOf,
  threadCustomer,
} from "@/lib/sharedSenders";
import { EVAL_CASES } from "@/lib/classifierEval";

const notice = (email: string, subject: string, body = "") => ({ from: { name: "x", email }, subject, body });

describe("isLeadMarketplaceAddress", () => {
  it.each([
    "no-reply@thumbtack.com",
    "noreply@mail.thumbtack.com",
    "leads@angi.com",
    "no-reply@homeadvisor.com",
    "no-reply@zillow.com",
    "leads-noreply@realtor.com",
    "no-reply@yelp.com",
    "no-reply@houzz.com",
    "team@bark.com",
    "noreply@porch.com",
    "no-reply@homestars.com",
    "noreply@kijiji.ca",
    "reply-3f9a@users.kijiji.ca",
    "no-reply@realtor.ca",
  ])("knows %s", (email) => expect(isLeadMarketplaceAddress(email)).toBe(true));

  it.each(["notifications@github.com", "no-reply@northernbank.com", "noreply@thumbtack.com.evil.example", "jane@example.com", "craigslist.org"])(
    "does not count %s",
    (email) => expect(isLeadMarketplaceAddress(email)).toBe(false)
  );
});

describe("isMarketplaceLeadNotice: the no-reply gate", () => {
  it.each([
    ["no-reply@thumbtack.com", "You have a new lead!"],
    ["no-reply@thumbtack.com", "Dana W. wants a quote for House Cleaning"],
    ["no-reply@thumbtack.com", "Marcus T. sent you a message"],
    ["noreply@angi.com", "New Lead: Lawn Care / Mowing - Priscilla N."],
    ["no-reply@homeadvisor.com", "You have a new opportunity"],
    ["no-reply@zillow.com", "New Zillow lead: Renee Park is interested in 14 Birch Lane"],
    ["leads-noreply@realtor.com", "A consumer requested information about 220 King St"],
    ["no-reply@yelp.com", "Hana L. requested a quote from Kings Auto Repair"],
    ["no-reply@yelp.com", "New message from Brooke M."],
    ["no-reply@houzz.com", "You have a new message from a homeowner"],
    ["team@bark.com", "Olivia Grant is looking for a bookkeeper"],
    ["noreply@porch.com", "New project request"],
    ["no-reply@homestars.com", "You have a new lead!"],
    ["noreply@kijiji.ca", "New message about your ad: Two movers + truck, GTA"],
    ["noreply@kijiji.ca", "Someone replied to your ad"],
    ["no-reply@realtor.ca", "Inquiry about 88 Queen St E, Unit 1204"],
  ])("lets a lead notice from %s through: %s", (email, subject) => {
    expect(isMarketplaceLeadNotice(notice(email, subject))).toBe(true);
  });

  it.each([
    ["no-reply@thumbtack.com", "Your receipt from Thumbtack"],
    ["no-reply@thumbtack.com", "You were charged $18.40 for a new lead"],
    ["no-reply@houzz.com", "Your profile got 5 views this week"],
    ["noreply@angi.com", "Save 20% on new leads this month"],
    ["noreply@angi.com", "Upgrade to get new leads first"],
    ["no-reply@zillow.com", "Your September statement is ready"],
    ["no-reply@yelp.com", "You have a new review"],
    ["no-reply@thumbtack.com", "5 tips to win more jobs"],
    ["team@bark.com", "Customers are looking for bookkeepers near you"],
    ["no-reply@thumbtack.com", "Reset your password"],
    ["no-reply@homestars.com", "You have a new review"],
    ["noreply@kijiji.ca", "Your ad expires in 3 days"],
    ["no-reply@realtor.ca", "Your monthly listing report"],
  ])("keeps the marketplace's own mail out, from %s: %s", (email, subject) => {
    expect(isMarketplaceLeadNotice(notice(email, subject))).toBe(false);
  });

  it("never lets other no-reply mail through, however it is worded", () => {
    for (const email of ["notifications@github.com", "no-reply@northernbank.com", "noreply@marketweekly.example", "no-reply@accounts.google.com"]) {
      expect(isAutomatedAddress(email)).toBe(true);
      expect(isMarketplaceLeadNotice(notice(email, "New request: you have a new lead", "Jane sent you a message"))).toBe(false);
    }
  });

  it("reads the body's opening only when the subject says nothing either way", () => {
    const body = "Marcus T. sent you a message: is your team free this week?";
    expect(isMarketplaceLeadNotice(notice("no-reply@thumbtack.com", "Thumbtack", body))).toBe(true);
    expect(isMarketplaceLeadNotice(notice("no-reply@thumbtack.com", "", body))).toBe(true);
    // A housekeeping subject wins over a lead-sounding body.
    expect(isMarketplaceLeadNotice(notice("no-reply@thumbtack.com", "Your receipt", body))).toBe(false);
    // A housekeeping body with no subject stays out.
    expect(isMarketplaceLeadNotice(notice("no-reply@thumbtack.com", "", "Your receipt: we charged $18 for a new lead."))).toBe(false);
    // A lead signal deep in the footer is not the opening.
    expect(isMarketplaceLeadNotice(notice("no-reply@thumbtack.com", "", `${"Hello. ".repeat(200)}New lead`))).toBe(false);
  });

  it("agrees with the lead-check eval's marketplace cases, read from the real domains", () => {
    const cases = EVAL_CASES.filter((c) => c.name.startsWith("marketplace:"));
    expect(cases.length).toBeGreaterThanOrEqual(13);
    for (const c of cases) {
      const email = c.sender.email.replace(/\.ca\.example$/, ".ca").replace(/\.example$/, ".com");
      const verdict = isMarketplaceLeadNotice({ from: { email }, subject: "", body: c.messages[0] });
      expect({ name: c.name, verdict }).toEqual({ name: c.name, verdict: c.expectLead });
    }
  });
});

describe("contactNameFromBody", () => {
  it("takes the name from a structured lead card with a phone or email", () => {
    expect(contactNameFromBody("You have a new lead!\n\nName: Dana Whitfield\nPhone: (555) 010-4471\nWhen: Friday")).toBe("Dana Whitfield");
    expect(contactNameFromBody("Customer name: Priscilla Nguyen\nEmail: p.nguyen@example.com")).toBe("Priscilla Nguyen");
    expect(contactNameFromBody("Customer Name:  José Álvarez \r\nMobile: +1 555 010 2290\r\n")).toBe("José Álvarez");
  });

  it("takes nothing when anything is unclear", () => {
    // No contact line: not a lead card.
    expect(contactNameFromBody("Name: Dana Whitfield\nWhen: Friday")).toBeNull();
    // HTML flattened onto one line: the value runs into the next label.
    expect(contactNameFromBody("Name: Dana Whitfield Phone: (555) 010-4471 Email: dana@example.com")).toBeNull();
    // Not a name.
    expect(contactNameFromBody("Name: dana@example.com\nPhone: (555) 010-4471")).toBeNull();
    expect(contactNameFromBody("Name: 5550104471\nPhone: (555) 010-4471")).toBeNull();
    expect(contactNameFromBody("Name: https://thumbtack.com/x\nPhone: (555) 010-4471")).toBeNull();
    expect(contactNameFromBody("Name: the customer who asked about the kitchen remodel\nPhone: (555) 010-4471")).toBeNull();
    // Prose that merely mentions a name.
    expect(contactNameFromBody("Her name: I forget.\nWe spoke on the phone yesterday.")).toBeNull();
    expect(contactNameFromBody("")).toBeNull();
    expect(contactNameFromBody(null)).toBeNull();
  });
});

describe("threadCustomer with marketplace notices", () => {
  const ours = (email: string) => email === "info@samsplumbing.ca" || isAutomatedAddress(email);
  const from = { name: "Thumbtack", email: "no-reply@thumbtack.com" };

  it("a no-reply lead notice is the thread's customer, shared, named from its card", () => {
    const body = "Name: Dana Whitfield\nPhone: (555) 010-4471\nDetails: deep clean";
    expect(threadCustomer([{ from, subject: "You have a new lead!", body }], ours)).toEqual({
      name: "Dana Whitfield",
      email: "no-reply@thumbtack.com",
      shared: true,
      site: { name: "Thumbtack", url: null },
    });
  });

  it("keeps the platform's name when the notice has no clear card", () => {
    expect(threadCustomer([{ from, subject: "Marcus T. sent you a message", body: "Is your team free this week?" }], ours)).toEqual({
      ...from,
      shared: true,
      site: { name: "Thumbtack", url: null },
    });
  });

  it("uses a Reply-To person over the card, as for any relay", () => {
    const replyTo = { name: "Renee Park", email: "renee.park@example.com" };
    const zillow = { name: "Zillow", email: "no-reply@zillow.com" };
    expect(threadCustomer([{ from: zillow, replyTo, subject: "New lead from Zillow", body: "Name: Someone Else\nPhone: 555 010 6620" }], ours)).toEqual({
      ...replyTo,
      shared: false,
    });
  });

  it("still skips the marketplace's receipts and every other no-reply sender", () => {
    expect(threadCustomer([{ from, subject: "Your receipt from Thumbtack", body: "Name: Dana\nPhone: (555) 010-4471" }], ours)).toBeNull();
    expect(threadCustomer([{ from: { name: "GitHub", email: "notifications@github.com" }, subject: "New request", body: "" }], ours)).toBeNull();
    expect(threadCustomer([{ from: { name: "Bank", email: "no-reply@northernbank.com" }, subject: "You have a new message" }], ours)).toBeNull();
  });

  it("leaves a normal sender exactly as it was", () => {
    const jane = { name: "Jane Doe", email: "jane@example.com" };
    expect(threadCustomer([{ from: jane, subject: "Name: x", body: "Name: Someone\nPhone: 555 010 1111" }], ours)).toEqual({ ...jane, shared: false });
  });
});

// ---- the syncs, end to end with mocks ----------------------------------

function leadRow(id: string, name: string, email: string | null) {
  return {
    id,
    businessId: "biz1",
    name,
    email,
    company: null,
    source: "Gmail",
    dealValue: 0,
    score: 0,
    scoreReason: null,
    lastContacted: new Date(),
    nextFollowUp: null,
    notes: null,
    automationTier: "HOLD",
  };
}

function gmailThread(id: string, from: string, subject: string, body: string) {
  return {
    data: {
      id,
      messages: [
        {
          id: `${id}-m1`,
          internalDate: String(Date.now()),
          payload: {
            mimeType: "text/plain",
            headers: [
              { name: "From", value: from },
              { name: "Subject", value: subject },
              { name: "Message-ID", value: `<${id}@mail.example>` },
            ],
            body: { data: Buffer.from(body).toString("base64") },
          },
        },
      ],
    },
  };
}

let created = 0;

beforeEach(() => {
  vi.clearAllMocks();
  created = 0;
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.stubEnv("GOOGLE_CLIENT_ID", "client");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "secret");
  vi.stubEnv("GOOGLE_REDIRECT_URI", "https://followupbase.io/api/integrations/gmail/callback");
  vi.stubEnv("OPENAI_API_KEY", "sk-test");

  classifyWithSecondLook.mockResolvedValue({ isProspect: true, reason: "a new lead passed on by the marketplace" });
  prismaMock.integration.findFirst.mockResolvedValue({
    id: "int1",
    refreshToken: "refresh",
    accessToken: "access",
    tokenExpiresAt: new Date(Date.now() + 3_600_000),
    deltaLink: null,
    accountEmail: "info@sparkleclean.example",
    watchExpiration: null,
    user: { email: "owner@sparkleclean.example" },
  });
  prismaMock.integration.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.business.findUnique.mockResolvedValue({ name: "Sparkle Cleaning", industry: "Cleaning", users: [] });
  prismaMock.filteredEmail.deleteMany.mockResolvedValue({ count: 0 });
  prismaMock.filteredEmail.findUnique.mockResolvedValue(null);
  prismaMock.conversation.findUnique.mockResolvedValue(null);
  prismaMock.conversation.create.mockImplementation(async ({ data }) => ({ id: `conv-${data.externalId}`, leadId: data.leadId }));
  prismaMock.message.upsert.mockResolvedValue({});
  prismaMock.lead.updateMany.mockResolvedValue({ count: 1 });
  prismaMock.lead.findUnique.mockResolvedValue(null);
  prismaMock.lead.create.mockImplementation(async ({ data }) => leadRow(`lead-new-${++created}`, data.name, data.email));
});

afterEach(() => vi.restoreAllMocks());

const LEAD_BODY = "You have a new lead!\n\nName: Dana Whitfield\nPhone: (555) 010-4471\nDetails: Deep clean, 3 bed / 2 bath.";

describe("Gmail: a marketplace lead from a no-reply address", () => {
  it("reaches the classifier and becomes a lead with no email, named from its card", async () => {
    threadsList.mockResolvedValue({ data: { threads: [{ id: "t1" }] } });
    threadsGet.mockResolvedValue(gmailThread("t1", "Thumbtack <no-reply@thumbtack.com>", "Dana W. wants a quote for House Cleaning", LEAD_BODY));

    const leads = await fetchSalesConversations("biz1");

    expect(classifyWithSecondLook).toHaveBeenCalledTimes(1);
    expect(classifyWithSecondLook.mock.calls[0][1]).toMatchObject({ name: "Dana Whitfield", email: "no-reply@thumbtack.com", shared: true });
    expect(prismaMock.lead.create).toHaveBeenCalledTimes(1);
    const { data } = prismaMock.lead.create.mock.calls[0][0];
    // No email: a reply to no-reply@ reaches nobody, so nothing is sent there.
    // The site is remembered, so the owner is sent there instead (b018).
    expect(data).toMatchObject({ name: "Dana Whitfield", email: null, viaSite: "Thumbtack", viaSiteUrl: null });
    expect(data.conversations.create).toMatchObject({ externalId: "t1", emailProvider: "gmail" });
    expect(leads.map((l) => l.id)).toEqual(["lead-new-1"]);
  });

  it("is still set aside, visibly, when the classifier says no", async () => {
    classifyWithSecondLook.mockResolvedValue({ isProspect: false, reason: "a platform notice with no request" });
    threadsList.mockResolvedValue({ data: { threads: [{ id: "t1" }] } });
    threadsGet.mockResolvedValue(gmailThread("t1", "Thumbtack <no-reply@thumbtack.com>", "You have a new lead!", LEAD_BODY));

    await fetchSalesConversations("biz1");

    expect(prismaMock.lead.create).not.toHaveBeenCalled();
    expect(prismaMock.filteredEmail.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ create: expect.objectContaining({ senderEmail: "no-reply@thumbtack.com", subject: "You have a new lead!" }) })
    );
  });

  it("skips the marketplace's receipts, and other no-reply mail, without asking the classifier", async () => {
    threadsList.mockResolvedValue({ data: { threads: [{ id: "t1" }, { id: "t2" }, { id: "t3" }] } });
    threadsGet.mockImplementation(async ({ id }) =>
      id === "t1"
        ? gmailThread("t1", "Thumbtack <no-reply@thumbtack.com>", "Your receipt from Thumbtack", "You were charged $18.40 for a new lead.")
        : id === "t2"
          ? gmailThread("t2", "GitHub <notifications@github.com>", "New request: review PR #12", "Jane sent you a message")
          : gmailThread("t3", "Northern Bank <no-reply@northernbank.com>", "You have a new message", "Sign in to read it.")
    );

    const leads = await fetchSalesConversations("biz1");

    expect(classifyWithSecondLook).not.toHaveBeenCalled();
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
    expect(prismaMock.filteredEmail.upsert).not.toHaveBeenCalled();
    expect(leads).toEqual([]);
  });
});

// Backlog b017 (founder said yes 2026-09-30): Gmail often files lead-site
// notices under Updates, which the main search skips.
describe("Gmail: lead-site notices in the Updates tab", () => {
  const queries = () => threadsList.mock.calls.map(([args]) => args.q as string);

  it("reads Updates for lead sites only, and still skips the rest of Updates", async () => {
    threadsList.mockResolvedValue({ data: { threads: [] } });

    await fetchSalesConversations("biz1");

    expect(threadsList).toHaveBeenCalledTimes(2);
    const [main, updates] = queries();
    expect(main).toContain("-category:updates");
    expect(updates).toMatch(/^category:updates from:\(/);
    for (const domain of ["thumbtack.com", "angi.com", "homeadvisor.com", "zillow.com", "realtor.com", "yelp.com", "houzz.com", "bark.com", "porch.com"]) {
      expect(updates).toContain(domain);
    }
    expect(updates).not.toMatch(/github|bank|google/);
    expect(updates).toContain("newer_than:90d");
  });

  it("turns a Thumbtack lead found only in Updates into a lead", async () => {
    threadsList.mockImplementation(async ({ q }) => ({
      data: { threads: String(q).startsWith("category:updates") ? [{ id: "u1" }] : [] },
    }));
    threadsGet.mockResolvedValue(gmailThread("u1", "Thumbtack <no-reply@thumbtack.com>", "Dana W. wants a quote for House Cleaning", LEAD_BODY));

    const leads = await fetchSalesConversations("biz1");

    expect(threadsGet).toHaveBeenCalledWith(expect.objectContaining({ id: "u1" }));
    expect(prismaMock.lead.create.mock.calls[0][0].data).toMatchObject({ name: "Dana Whitfield", email: null });
    expect(leads).toHaveLength(1);
  });

  it("reads a thread once when both searches find it", async () => {
    threadsList.mockResolvedValue({ data: { threads: [{ id: "t1" }] } });
    threadsGet.mockResolvedValue(gmailThread("t1", "Thumbtack <no-reply@thumbtack.com>", "Dana W. wants a quote for House Cleaning", LEAD_BODY));

    await fetchSalesConversations("biz1");

    expect(threadsGet).toHaveBeenCalledTimes(1);
    expect(prismaMock.lead.create).toHaveBeenCalledTimes(1);
  });

  it("keeps the automatic sync's time window on the Updates search", async () => {
    threadsList.mockResolvedValue({ data: { threads: [] } });
    const since = new Date("2026-09-30T12:00:00Z");

    await fetchSalesConversations("biz1", { since });

    for (const q of queries()) expect(q).toContain(`after:${Math.floor(since.getTime() / 1000)}`);
  });
});

describe("Outlook: a marketplace lead from a no-reply address", () => {
  function graph(subject: string, fromAddress: string, body: string) {
    vi.spyOn(global, "fetch").mockImplementation(async (input) => {
      const url = decodeURIComponent(String(input));
      if (url.includes("/delta")) {
        return new Response(
          JSON.stringify({ value: [{ id: "c1-m1", conversationId: "c1" }], "@odata.deltaLink": "https://graph.microsoft.com/v1.0/delta-next" }),
          { status: 200 }
        );
      }
      return new Response(
        JSON.stringify({
          value: [
            {
              id: "c1-m1",
              conversationId: "c1",
              subject,
              body: { contentType: "text", content: body },
              from: { emailAddress: { name: "Angi Leads", address: fromAddress } },
              receivedDateTime: new Date().toISOString(),
            },
          ],
        }),
        { status: 200 }
      );
    });
  }

  it("reaches the classifier and becomes a lead with no email", async () => {
    graph("New Lead: Lawn Care / Mowing", "noreply@angi.com", "Customer: Priscilla Nguyen\nName: Priscilla Nguyen\nEmail: p.nguyen@example.com");

    await fetchOutlookConversations("biz1");

    expect(classifyWithSecondLook).toHaveBeenCalledTimes(1);
    const { data } = prismaMock.lead.create.mock.calls[0][0];
    expect(data).toMatchObject({ name: "Priscilla Nguyen", email: null, viaSite: "Angi" });
    expect(data.conversations.create).toMatchObject({ externalId: "c1", emailProvider: "outlook" });
  });

  it("skips the marketplace's promotions without asking the classifier", async () => {
    graph("Save 20% on new leads this month", "noreply@angi.com", "Upgrade to Premium.");

    await fetchOutlookConversations("biz1");

    expect(classifyWithSecondLook).not.toHaveBeenCalled();
    expect(prismaMock.lead.create).not.toHaveBeenCalled();
  });
});

// Backlog b018 (A-075): which site to send the owner to, and how.
describe("the lead site behind a customer", () => {
  it("names the site from the sender's domain, subdomains included", () => {
    expect(leadSiteOf("no-reply@mail.thumbtack.com")).toEqual({ name: "Thumbtack", domain: "thumbtack.com" });
    expect(leadSiteOf("reply-3f9a@users.kijiji.ca")).toEqual({ name: "Kijiji", domain: "kijiji.ca" });
    expect(leadSiteOf("no-reply@homestars.com")?.name).toBe("HomeStars");
    expect(leadSiteOf("no-reply@realtor.ca")?.name).toBe("REALTOR.ca");
    expect(leadSiteOf("jane@example.com")).toBeNull();
    expect(leadSiteOf("no-reply@thumbtack.com.evil.example")).toBeNull();
  });

  it("takes the customer's link only when it points at that same site", () => {
    const body = "New lead!\nTrack: https://evil.example/thumbtack.com\nView lead: https://www.thumbtack.com/pro-inbox/messages/123?x=1.\nhttps://www.thumbtack.com/other";
    expect(leadSiteLink(body, "thumbtack.com")).toBe("https://www.thumbtack.com/pro-inbox/messages/123?x=1");
    expect(leadSiteLink("Open https://thumbtack.com.evil.example/lead", "thumbtack.com")).toBeNull();
    expect(leadSiteLink("http://www.thumbtack.com/lead (not https)", "thumbtack.com")).toBeNull();
    expect(leadSiteLink("https://user:pw@www.thumbtack.com/lead", "thumbtack.com")).toBeNull();
    expect(leadSiteLink(null, "thumbtack.com")).toBeNull();
  });

  it("reads a phone number from a clear Phone: line only, and never stores it", () => {
    expect(contactPhoneFromBody("Name: Dana\nPhone: (555) 010-4471\nDetails: x")).toBe("(555) 010-4471");
    expect(contactPhoneFromBody("Call me at 555 010 4471 anytime")).toBeNull();
    expect(contactPhoneFromBody("Phone: call me")).toBeNull();
    expect(contactPhoneFromBody(undefined)).toBeNull();
  });

  it("keeps the link on the lead Gmail creates", async () => {
    threadsList.mockResolvedValue({ data: { threads: [{ id: "t1" }] } });
    threadsGet.mockResolvedValue(
      gmailThread("t1", "Thumbtack <no-reply@thumbtack.com>", "Dana W. wants a quote for House Cleaning", `${LEAD_BODY}\nReply: https://www.thumbtack.com/pro-inbox/messages/987`)
    );

    await fetchSalesConversations("biz1");

    expect(prismaMock.lead.create.mock.calls[0][0].data).toMatchObject({ viaSite: "Thumbtack", viaSiteUrl: "https://www.thumbtack.com/pro-inbox/messages/987" });
  });

  it("leaves an ordinary customer without a site", async () => {
    threadsList.mockResolvedValue({ data: { threads: [{ id: "t1" }] } });
    threadsGet.mockResolvedValue(gmailThread("t1", "Jane Doe <jane@example.com>", "Quote for a deep clean?", "Hi, how much for a 3 bed?"));

    await fetchSalesConversations("biz1");

    expect(prismaMock.lead.create.mock.calls[0][0].data).not.toHaveProperty("viaSite");
  });
});
