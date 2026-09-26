/**
 * The Monday email (design brain A-034, A-037, A-038). What it must always
 * do: open with a real win when there is one, else with who is waiting
 * for the owner's OK, by name; count customers, never messages; never
 * claim an answer that did not happen; and never let a customer's name
 * become markup in the owner's inbox.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/db", () => ({ prisma: { message: { findMany: vi.fn() } } }));
vi.mock("@/lib/pendingApprovals", () => ({ getPendingApprovals: vi.fn() }));
vi.mock("@/lib/rescued", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/rescued")>();
  return { ...real, getRescueReport: vi.fn() };
});

import { prisma } from "@/lib/db";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { getRescueReport, type RescueReport, type RescuedLead } from "@/lib/rescued";
import {
  countCustomersAnswered,
  gatherWeeklyDigest,
  getInboundMix,
  renderWeeklyDigest,
  type WeeklyDigestInput,
} from "@/lib/weeklyDigest";
import { mimeBody } from "@/lib/integrations/gmail";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const p = prisma as any;

// Monday 28 September 2026, 13:00 UTC — the scheduled run (vercel.json).
const NOW = new Date("2026-09-28T13:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000);

const EMPTY_REPORT: RescueReport = { days: 7, answeredForYou: 0, rescued: 0, booked: 0, won: 0, valueInPlay: 0, wonValue: 0, leads: [] };

function lead(over: Partial<RescuedLead> = {}): RescuedLead {
  return { id: "l1", name: "Tom Reid", trigger: "silence", repliedAfterHours: 5, dealValue: 0, stage: "CONTACTED", bookedFor: null, ...over };
}

function input(over: Partial<WeeklyDigestInput> = {}): WeeklyDigestInput {
  return {
    businessName: "Northside Plumbing",
    timeZone: "America/Toronto",
    appUrl: "https://followupbase.io",
    weekStart: new Date(NOW.getTime() - 7 * 86_400_000),
    weekEnd: NOW,
    report: EMPTY_REPORT,
    thisWeek: { answered: 12, cameBack: 0, booked: 0 },
    lastWeek: { answered: 8, cameBack: 0, booked: 0 },
    waiting: [],
    channels: [],
    busiest: null,
    ...over,
  };
}

const WAITING = [
  { name: "Priya Shah", channel: "instagram", lastMessageAt: hoursAgo(5 * 24 + 2) },
  { name: "Omar Haddad", channel: "email", lastMessageAt: hoursAgo(6 * 24 + 1) },
  { name: "Mike Alvarez", channel: "email", lastMessageAt: hoursAgo(3 * 24 + 5) },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe("the week with a win", () => {
  const booked = lead({ bookedFor: new Date("2026-10-01T14:00:00Z") }); // 10:00 AM in Toronto
  const d = input({
    report: { ...EMPTY_REPORT, rescued: 2, booked: 1, leads: [lead({ id: "l2", name: "Ana Gómez" }), booked] },
    thisWeek: { answered: 12, cameBack: 2, booked: 1 },
    waiting: WAITING,
  });

  it("leads the subject and both versions with the customer who booked", () => {
    const { subject, text, html } = renderWeeklyDigest(d);
    expect(subject).toBe("FollowUp this week: Tom Reid came back and booked");
    expect(text.split("\n")[0]).toBe("Tom Reid came back and booked.");
    expect(html).toContain("Tom Reid came back and booked.");
  });

  it("says how it happened without guessing a pronoun, and when they booked in the business's time", () => {
    const { text, html } = renderWeeklyDigest(d);
    expect(text).toContain("Tom had gone quiet. FollowUp checked in, and the reply came 5 hours later.");
    expect(text).toContain("Booked for Thursday, October 1 at 10:00 AM.");
    expect(html).toContain("Booked: Thu, Oct 1 · 10:00 AM");
    expect(text).not.toMatch(/\b(he|she|his|her)\b/i);
  });

  it("names who is waiting before the numbers in the text version (A-037)", () => {
    const { text } = renderWeeklyDigest(d);
    expect(text).toContain("3 replies are waiting for your OK:");
    expect(text).toContain("- Priya Shah, Instagram, waiting 5 days");
    expect(text.indexOf("Priya Shah")).toBeLessThan(text.indexOf("This week"));
    expect(text).toContain("Nothing goes out until you send it.");
  });

  it("puts the numbers beside last week's, in customers (A-038)", () => {
    const { html } = renderWeeklyDigest(d);
    expect(html).toContain("The week in customers");
    expect(html).toContain("Last week: 8");
    expect(html).not.toMatch(/messages sent/i);
  });
});

describe("a week with no win yet, replies waiting", () => {
  it("leads with the waiting replies, by name, channel and how long", () => {
    const { subject, text, html } = renderWeeklyDigest(input({ waiting: WAITING, thisWeek: { answered: 4, cameBack: 0, booked: 0 } }));
    expect(subject).toBe("FollowUp this week: 3 replies are waiting for your OK");
    expect(text.split("\n")[0]).toBe("3 replies are waiting for your OK.");
    expect(text).toContain("- Omar Haddad, Email, waiting 6 days");
    expect(text).toContain("This week, 4 customers were answered. Nobody has come back yet.");
    expect(html).toContain("3 replies are written and waiting.");
    expect(html).toContain("https://followupbase.io/dashboard");
  });

  it("counts one reply in the singular", () => {
    const { subject, text } = renderWeeklyDigest(input({ waiting: WAITING.slice(0, 1), thisWeek: { answered: 1, cameBack: 0, booked: 0 } }));
    expect(subject).toBe("FollowUp this week: 1 reply is waiting for your OK");
    expect(text).toContain("This week, 1 customer was answered.");
    expect(text).not.toMatch(/1 replies|1 customers/);
  });

  it("names five and counts the rest, so the email stays short on a phone", () => {
    const many = Array.from({ length: 8 }, (_, i) => ({ name: `Customer ${i + 1}`, channel: "email", lastMessageAt: hoursAgo(30) }));
    const { text, html } = renderWeeklyDigest(input({ waiting: many }));
    expect(text).toContain("- Customer 5,");
    expect(text).not.toContain("Customer 6");
    expect(text).toContain("- and 3 more");
    expect(html).toContain("and 3 more");
  });
});

describe("a quiet week", () => {
  it("says so plainly, and says nothing is waiting", () => {
    const { subject, text } = renderWeeklyDigest(input({ thisWeek: { answered: 2, cameBack: 0, booked: 0 } }));
    expect(subject).toBe("FollowUp this week: a quiet week");
    expect(text).toContain("This week, 2 customers were answered. Nobody has come back yet, and nothing is waiting for you.");
    expect(text).not.toMatch(/waiting for your OK/);
  });

  it("never claims leads were answered that were not", () => {
    // The line an earlier digest sent to holding accounts while their
    // replies sat unsent: "every lead that wrote in was still answered
    // within a minute". The report never knew how many leads wrote in.
    for (const d of [input({ thisWeek: { answered: 0, cameBack: 0, booked: 0 } }), input({ waiting: WAITING })]) {
      const { text, html } = renderWeeklyDigest(d);
      expect(text).not.toMatch(/within a minute/i);
      expect(html).not.toMatch(/within a minute/i);
    }
    expect(renderWeeklyDigest(input({ thisWeek: { answered: 0, cameBack: 0, booked: 0 } })).text).not.toMatch(/0 customers/);
  });
});

describe("the designed email", () => {
  it("escapes every name, so a customer can never put markup in the owner's inbox", () => {
    const { html } = renderWeeklyDigest(
      input({
        businessName: "Acme <b>",
        waiting: [{ name: '<img src=x onerror="alert(1)">', channel: "email", lastMessageAt: hoursAgo(30) }],
        report: { ...EMPTY_REPORT, rescued: 1, leads: [lead({ name: "<script>x</script>" })] },
      })
    );
    expect(html).not.toContain("<img src=x");
    expect(html).not.toContain("<script>x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
    expect(html).toContain("Acme &lt;b&gt;");
  });

  it("uses hosted images and no SVG or CSS gradient, which mail apps drop", () => {
    const { html } = renderWeeklyDigest(input({ waiting: WAITING }));
    expect(html).toContain("https://followupbase.io/email/week-header.jpg");
    expect(html).toContain("https://followupbase.io/email/followup-lockup.png");
    expect(html).not.toMatch(/<svg|gradient\(/);
  });

  it("shows where customers wrote from and the busiest time, only when there is something to show", () => {
    const withMix = renderWeeklyDigest(input({ channels: [{ channel: "instagram", customers: 5 }, { channel: "email", customers: 4 }], busiest: { from: 18, to: 21 } })).html;
    expect(withMix).toContain("Where customers wrote from");
    expect(withMix).toContain("Instagram");
    expect(withMix).toContain("Most messages came in between 6 and 9 PM.");
    const without = renderWeeklyDigest(input()).html;
    expect(without).not.toContain("Where customers wrote from");
    expect(without).not.toContain("Busiest time");
  });

  it("dates the week in the business's time zone", () => {
    expect(renderWeeklyDigest(input()).html).toContain("Sep 21 – 27");
  });
});

describe("the counts behind it", () => {
  it("counts customers answered, not messages, and never the instant 'got it' reply", async () => {
    p.message.findMany.mockResolvedValue([
      { conversation: { leadId: "a" } },
      { conversation: { leadId: "a" } }, // a second conversation with the same customer
      { conversation: { leadId: "b" } },
    ]);
    const from = hoursAgo(168);
    expect(await countCustomersAnswered("biz1", from, NOW)).toBe(2);
    const where = p.message.findMany.mock.calls[0][0].where;
    expect(where).toMatchObject({ direction: "outbound", sentAt: { gte: from, lt: NOW }, conversation: { lead: { businessId: "biz1" } } });
    // Both spelled out: a bare `not` would also drop an owner's own reply
    // synced from their inbox, whose trigger is null.
    expect(where.OR).toEqual([{ trigger: null }, { trigger: { not: "instant_ack" } }]);
  });

  it("counts customers per channel and finds the busiest three hours in the business's time", async () => {
    // 22:00–00:00 UTC is 6–8 PM in Toronto (EDT, UTC-4).
    const at = (utcHour: number) => new Date(Date.UTC(2026, 8, 25, utcHour, 10));
    p.message.findMany.mockResolvedValue([
      { sentAt: at(22), conversation: { channel: "instagram", leadId: "a" } },
      { sentAt: at(23), conversation: { channel: "instagram", leadId: "a" } },
      { sentAt: at(23), conversation: { channel: "instagram", leadId: "b" } },
      { sentAt: at(22), conversation: { channel: "email", leadId: "c" } },
      { sentAt: at(14), conversation: { channel: "whatsapp", leadId: "d" } },
    ]);
    const mix = await getInboundMix("biz1", hoursAgo(168), NOW, "America/Toronto");
    expect(mix.channels).toEqual([
      { channel: "instagram", customers: 2 },
      { channel: "email", customers: 1 },
      { channel: "whatsapp", customers: 1 },
    ]);
    expect(mix.busiest).toEqual({ from: 18, to: 21 });
  });

  it("gives no busiest time when there are too few messages to mean anything", async () => {
    p.message.findMany.mockResolvedValue([{ sentAt: NOW, conversation: { channel: "email", leadId: "a" } }]);
    expect((await getInboundMix("biz1", hoursAgo(168), NOW, "America/Toronto")).busiest).toBeNull();
  });

  it("puts this week beside last week, and falls back on a bad time zone instead of failing the run", async () => {
    vi.mocked(getRescueReport).mockImplementation(async (_b, _d, end) =>
      end && end.getTime() === NOW.getTime() ? { ...EMPTY_REPORT, rescued: 2, booked: 1 } : { ...EMPTY_REPORT, rescued: 1 }
    );
    vi.mocked(getPendingApprovals).mockResolvedValue([]);
    p.message.findMany.mockResolvedValue([]);
    const d = await gatherWeeklyDigest({ id: "biz1", name: "Northside", timezone: "Not/AZone" }, "https://followupbase.io", NOW);
    expect(d.timeZone).toBe("America/New_York");
    expect(d.thisWeek).toMatchObject({ cameBack: 2, booked: 1 });
    expect(d.lastWeek).toMatchObject({ cameBack: 1, booked: 0 });
  });
});

describe("sending it", () => {
  it("keeps a plain-text-only email exactly as it always was", () => {
    expect(mimeBody("hello")).toEqual(["Content-Type: text/plain; charset=utf-8", "", "hello"]);
  });

  it("sends the designed version beside the plain text, text first", () => {
    const lines = mimeBody("plain", "<p>" + "x".repeat(3000) + "</p>", "b1");
    const raw = lines.join("\r\n");
    expect(raw).toContain('Content-Type: multipart/alternative; boundary="b1"');
    expect(raw.indexOf("text/plain")).toBeLessThan(raw.indexOf("text/html"));
    expect(raw.trimEnd().endsWith("--b1--")).toBe(true);
    // No line past the 998-character limit, however long the HTML.
    expect(Math.max(...raw.split("\r\n").map((l) => l.length))).toBeLessThanOrEqual(76 + 2);
    const htmlPart = raw.split("--b1")[2].split("\r\n\r\n")[1];
    expect(Buffer.from(htmlPart.replace(/\r\n/g, ""), "base64").toString("utf-8")).toBe("<p>" + "x".repeat(3000) + "</p>");
  });
});
