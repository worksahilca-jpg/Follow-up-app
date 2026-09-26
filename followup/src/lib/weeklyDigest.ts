import { prisma } from "@/lib/db";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { formatMoney, getRescueReport, type RescueReport, type RescuedLead } from "@/lib/rescued";
import { renderWeeklyEmailHtml, type WeeklyEmailView } from "@/lib/weeklyDigestHtml";

/**
 * The Monday email (design brain A-034, A-037, A-038): what the week was,
 * sent from the owner's own Gmail to themselves.
 *
 * It is a designed HTML email with a plain-text version beside it. Both
 * open with the week's win, if there was one, else with the replies
 * waiting for the owner's OK, by name. On most weeks today that list is
 * the point: an owner who never opens the app still sees exactly which
 * customers are waiting on them, and that nothing goes out until they
 * send it.
 *
 * Counts customers, never messages (brand principle 7). Never claims an
 * answer that did not happen: an earlier digest told a holding account
 * "every lead that wrote in was still answered within a minute" while
 * those replies sat unsent in the owner's own queue.
 */

const DAY = 24 * 60 * 60 * 1000;

// Enough names to act on from a phone; the rest are one line.
const MAX_WAITING_NAMED = 5;

// Below this many messages a "busiest time" is noise, not a pattern.
const MIN_MESSAGES_FOR_BUSIEST = 5;

// The address the landing page and the beta sign-in already use (A-035).
const CONTACT_EMAIL = "contact@followupbase.io";

const CHANNEL_NAME: Record<string, string> = {
  email: "Email",
  text: "Text",
  call: "Call",
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  messenger: "Messenger",
};

export interface WeekNumbers {
  answered: number; // customers who got an answer, not messages
  cameBack: number; // customers who replied to a message FollowUp sent on its own
  booked: number; // bookings made by those customers
}

/** A reply written and waiting for the owner's OK, as the email names it. */
export interface WaitingCustomer {
  name: string;
  channel: string | null;
  // When they last wrote. "Waiting 5 days" is how long the CUSTOMER has
  // waited, not how long the draft has: a held draft is re-examined and
  // re-held, so the hold's own time keeps moving.
  lastMessageAt: Date | null;
}

export interface ChannelCount {
  channel: string;
  customers: number;
}

export interface WeeklyDigestInput {
  businessName: string;
  timeZone: string;
  appUrl: string;
  weekStart: Date;
  weekEnd: Date;
  report: RescueReport; // this week: the win comes from here
  thisWeek: WeekNumbers;
  lastWeek: WeekNumbers;
  waiting: WaitingCustomer[]; // in the approval queue's own order
  channels: ChannelCount[]; // most customers first
  busiest: { from: number; to: number } | null; // hours 0-23, business time
}

export async function gatherWeeklyDigest(
  business: { id: string; name: string; timezone?: string | null },
  appUrl: string,
  now: Date = new Date()
): Promise<WeeklyDigestInput> {
  const weekStart = new Date(now.getTime() - 7 * DAY);
  const lastWeekStart = new Date(now.getTime() - 14 * DAY);
  const timeZone = validTimeZone(business.timezone);
  const [report, lastReport, answered, answeredLastWeek, approvals, mix] = await Promise.all([
    getRescueReport(business.id, 7, now),
    getRescueReport(business.id, 7, weekStart),
    countCustomersAnswered(business.id, weekStart, now),
    countCustomersAnswered(business.id, lastWeekStart, weekStart),
    getPendingApprovals(business.id),
    getInboundMix(business.id, weekStart, now, timeZone),
  ]);
  return {
    businessName: business.name,
    timeZone,
    appUrl,
    weekStart,
    weekEnd: now,
    report,
    thisWeek: { answered, cameBack: report.rescued, booked: report.booked },
    lastWeek: { answered: answeredLastWeek, cameBack: lastReport.rescued, booked: lastReport.booked },
    waiting: approvals.map((a) => ({
      name: a.leadName,
      channel: a.leadLastMessageChannel,
      lastMessageAt: a.leadLastMessageAt ? new Date(a.leadLastMessageAt) : null,
    })),
    channels: mix.channels,
    busiest: mix.busiest,
  };
}

/**
 * Customers who got an answer in the window: distinct leads with any
 * outbound message, however it went out — sent from FollowUp, by the owner
 * from their own inbox (synced in), or on its own.
 *
 * The instant "got your message" reply is not an answer; it goes to
 * everyone (pendingApprovals.ts treats it the same way). A bare
 * `not: "instant_ack"` would also drop null triggers — an owner's reply
 * synced from their inbox — so both are spelled out.
 */
export async function countCustomersAnswered(businessId: string, from: Date, to: Date): Promise<number> {
  const rows = await prisma.message.findMany({
    where: {
      direction: "outbound",
      sentAt: { gte: from, lt: to },
      OR: [{ trigger: null }, { trigger: { not: "instant_ack" } }],
      conversation: { lead: { businessId } },
    },
    select: { conversation: { select: { leadId: true } } },
    distinct: ["conversationId"],
  });
  return new Set(rows.map((r) => r.conversation.leadId)).size;
}

/**
 * Where customers wrote from (customers per channel) and the three hours
 * most of their messages came in, in the business's own time zone. Counts
 * only; no message text leaves this function.
 */
export async function getInboundMix(
  businessId: string,
  from: Date,
  to: Date,
  timeZone: string
): Promise<{ channels: ChannelCount[]; busiest: { from: number; to: number } | null }> {
  const rows = await prisma.message.findMany({
    where: { direction: "inbound", sentAt: { gte: from, lt: to }, conversation: { lead: { businessId } } },
    select: { sentAt: true, conversation: { select: { channel: true, leadId: true } } },
    orderBy: { sentAt: "desc" },
    take: 5000,
  });

  const byChannel = new Map<string, Set<string>>();
  for (const r of rows) {
    const set = byChannel.get(r.conversation.channel) ?? new Set<string>();
    set.add(r.conversation.leadId);
    byChannel.set(r.conversation.channel, set);
  }
  const channels = [...byChannel.entries()]
    .map(([channel, leads]) => ({ channel, customers: leads.size }))
    .sort((a, b) => b.customers - a.customers || channelName(a.channel).localeCompare(channelName(b.channel)));

  let busiest: { from: number; to: number } | null = null;
  if (rows.length >= MIN_MESSAGES_FOR_BUSIEST) {
    const hours = new Array<number>(24).fill(0);
    for (const r of rows) hours[hourIn(r.sentAt, timeZone)] += 1;
    // Most messages wins; on a tie, the window that starts on a busy hour,
    // so messages at 6 and 7 PM read "between 6 and 9", not "5 and 8".
    let best = 0;
    let bestScore = -1;
    for (let h = 0; h < 24; h++) {
      const count = hours[h] + hours[(h + 1) % 24] + hours[(h + 2) % 24];
      const score = count * 2 + (hours[h] > 0 ? 1 : 0);
      if (score > bestScore) {
        best = h;
        bestScore = score;
      }
    }
    busiest = { from: best, to: (best + 3) % 24 };
  }
  return { channels, busiest };
}

/** The subject, the plain text and the designed HTML, from one set of facts. */
export function renderWeeklyDigest(d: WeeklyDigestInput): { subject: string; text: string; html: string } {
  const win = pickWin(d.report.leads);
  const n = d.waiting.length;
  const waitingCount = `${n} ${n === 1 ? "reply is" : "replies are"} waiting for your OK`;

  let subject: string;
  let highlight: WeeklyEmailView["highlight"];
  if (win) {
    const headline = winHeadline(win);
    subject = `FollowUp this week: ${headline}`;
    highlight = {
      label: "This week’s win",
      title: `${headline}.`,
      body: howItHappened(win),
      chip: win.bookedFor
        ? `Booked: ${formatAppointment(win.bookedFor, d.timeZone, "short")}`
        : win.stage === "WON" && win.dealValue > 0
          ? `Deal closed: ${formatMoney(win.dealValue)}`
          : null,
    };
  } else if (n > 0) {
    subject = `FollowUp this week: ${waitingCount}`;
    highlight = { label: "This week", title: `${waitingCount}.`, body: "Nobody has come back yet. Nothing goes out until you send it.", chip: null };
  } else {
    subject = "FollowUp this week: a quiet week";
    highlight = { label: "This week", title: "A quiet week.", body: "Nobody has come back yet, and nothing is waiting for you.", chip: null };
  }

  const view: WeeklyEmailView = {
    title: subject,
    preheader: highlight.body,
    businessName: d.businessName,
    dateRange: formatDateRange(d.weekStart, new Date(d.weekEnd.getTime() - DAY), d.timeZone),
    highlight,
    numbers: [
      { label: "Answered", value: d.thisWeek.answered, lastWeek: d.lastWeek.answered },
      { label: "Came back", value: d.thisWeek.cameBack, lastWeek: d.lastWeek.cameBack },
      { label: "Booked", value: d.thisWeek.booked, lastWeek: d.lastWeek.booked },
    ],
    waitingTitle: n === 0 ? "Nothing is waiting for your OK." : `${n} ${n === 1 ? "reply is" : "replies are"} written and waiting.`,
    waiting: d.waiting.slice(0, MAX_WAITING_NAMED).map((w) => ({
      initials: initials(w.name),
      name: w.name,
      channel: w.channel ? channelName(w.channel) : null,
      waited: w.lastMessageAt ? waitedFor(w.lastMessageAt, d.weekEnd) : null,
    })),
    waitingMore: Math.max(0, n - MAX_WAITING_NAMED),
    channels: d.channels.map((c) => ({ label: channelName(c.channel), customers: c.customers })),
    busiest: d.busiest ? `Most messages came in ${formatHours(d.busiest.from, d.busiest.to)}.` : null,
    links: {
      app: `${d.appUrl}/dashboard`,
      website: d.appUrl,
      privacy: `${d.appUrl}/privacy`,
      terms: `${d.appUrl}/terms`,
      contact: `mailto:${CONTACT_EMAIL}`,
      writeToSahil: `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("About FollowUp")}`,
      headerImage: `${d.appUrl}/email/week-header.jpg`,
      footerImage: `${d.appUrl}/email/week-footer.jpg`,
      logo: `${d.appUrl}/email/followup-lockup.png`,
    },
  };

  return { subject, text: renderText(d, win, waitingCount), html: renderWeeklyEmailHtml(view) };
}

/**
 * The plain-text version (A-037): for mail apps that block images or HTML,
 * and the version a screen reader or a smartwatch gets.
 */
function renderText(d: WeeklyDigestInput, win: RescuedLead | null, waitingCount: string): string {
  const n = d.waiting.length;
  const lines: string[] = [];
  const link = `${d.appUrl}/dashboard`;
  const waitingBlock = (lead: string): string[] => [
    lead,
    ...(lead.endsWith(":") ? [] : [""]),
    ...d.waiting.slice(0, MAX_WAITING_NAMED).map((w) => `- ${describeWaiting(w, d.weekEnd)}`),
    ...(n > MAX_WAITING_NAMED ? [`- and ${n - MAX_WAITING_NAMED} more`] : []),
    "",
    "Nothing goes out until you send it.",
    link,
    "",
  ];

  if (win) {
    lines.push(`${winHeadline(win)}.`, "");
    const how = [howItHappened(win)];
    if (win.bookedFor) how.push(`Booked for ${formatAppointment(win.bookedFor, d.timeZone, "long")}.`);
    lines.push(how.join(" "), "");
    if (n > 0) lines.push(...waitingBlock(`${waitingCount}:`));
    lines.push("This week", `- Customers answered: ${d.thisWeek.answered}`, `- Came back: ${d.thisWeek.cameBack}`, `- Booked: ${d.thisWeek.booked}`, "");
    if (n === 0) lines.push(link, "");
  } else if (n > 0) {
    lines.push(...waitingBlock(`${waitingCount}.`));
    lines.push([answeredSentence(d.thisWeek.answered), "Nobody has come back yet."].filter(Boolean).join(" "), "");
  } else {
    lines.push("A quiet week.", "");
    lines.push([answeredSentence(d.thisWeek.answered), "Nobody has come back yet, and nothing is waiting for you."].filter(Boolean).join(" "), "", link, "");
  }
  lines.push(`FollowUp for ${d.businessName}`);
  return lines.join("\n");
}

/**
 * The one customer the email opens with: someone who booked, else someone
 * whose deal closed, else whoever came back most recently. Only customers
 * in the report, so only replies to a message FollowUp sent on its own —
 * a reply to the owner's own send is the owner's win, never claimed here.
 */
function pickWin(leads: RescuedLead[]): RescuedLead | null {
  return leads.find((l) => l.bookedFor) ?? leads.find((l) => l.stage === "WON") ?? leads[0] ?? null;
}

function winHeadline(l: RescuedLead): string {
  if (l.bookedFor) return `${l.name} came back and booked`;
  if (l.stage === "WON") return `${l.name} came back, and the deal closed`;
  return `${l.name} came back`;
}

// No pronouns: the email never guesses how a customer is referred to.
function howItHappened(l: RescuedLead): string {
  const first = l.name.trim().split(/\s+/)[0] || l.name;
  const later = `the reply came ${formatDuration(l.repliedAfterHours)} later`;
  switch (l.trigger) {
    case "silence":
    case "sequence":
      return `${first} had gone quiet. FollowUp checked in, and ${later}.`;
    case "dead_lead_reactivation":
      return `${first} had gone cold. FollowUp reached back out, and ${later}.`;
    case "unanswered":
      return `${first}’s message was waiting on you. FollowUp answered, and ${later}.`;
    case "instant_ack":
      return `FollowUp sent ${first} a quick “got your message”, and ${later}.`;
    default:
      return `FollowUp followed up, and ${later}.`;
  }
}

function describeWaiting(w: WaitingCustomer, now: Date): string {
  const parts = [w.name];
  if (w.channel) parts.push(channelName(w.channel));
  if (w.lastMessageAt) parts.push(waitedFor(w.lastMessageAt, now));
  return parts.join(", ");
}

function waitedFor(since: Date, now: Date): string {
  const hours = (now.getTime() - since.getTime()) / 3_600_000;
  return hours < 1 ? "waiting less than an hour" : `waiting ${formatDuration(hours)}`;
}

function answeredSentence(count: number): string | null {
  if (count === 0) return null;
  return count === 1 ? "This week, 1 customer was answered." : `This week, ${count} customers were answered.`;
}

function channelName(channel: string): string {
  return CHANNEL_NAME[channel] ?? channel.charAt(0).toUpperCase() + channel.slice(1);
}

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .map((w) => w.match(/\p{L}/u)?.[0] ?? "")
    .filter(Boolean);
  return (letters.length > 1 ? letters[0] + letters[letters.length - 1] : letters[0] ?? "?").toUpperCase();
}

function formatDuration(hours: number): string {
  if (hours < 24) {
    const h = Math.max(1, Math.round(hours));
    return h === 1 ? "1 hour" : `${h} hours`;
  }
  const days = Math.floor(hours / 24);
  return days === 1 ? "1 day" : `${days} days`;
}

// long: "Thursday, October 1 at 10:00 AM"; short: "Thu, Oct 1 · 10:00 AM".
function formatAppointment(at: Date, timeZone: string, style: "long" | "short"): string {
  const day = new Intl.DateTimeFormat("en-US", {
    weekday: style,
    month: style,
    day: "numeric",
    timeZone,
  }).format(at);
  const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone }).format(at);
  return style === "long" ? `${day} at ${time}` : `${day} · ${time}`;
}

// "Sep 21 – 27", or "Sep 28 – Oct 4" across a month.
function formatDateRange(from: Date, to: Date, timeZone: string): string {
  const month = (d: Date) => new Intl.DateTimeFormat("en-US", { month: "short", timeZone }).format(d);
  const day = (d: Date) => new Intl.DateTimeFormat("en-US", { day: "numeric", timeZone }).format(d);
  return month(from) === month(to) ? `${month(from)} ${day(from)} – ${day(to)}` : `${month(from)} ${day(from)} – ${month(to)} ${day(to)}`;
}

// "between 6 and 9 PM", "between 11 AM and 2 PM".
function formatHours(from: number, to: number): string {
  const part = (h: number) => ({ n: h % 12 === 0 ? 12 : h % 12, ap: h < 12 ? "AM" : "PM" });
  const a = part(from);
  const b = part(to);
  return a.ap === b.ap ? `between ${a.n} and ${b.n} ${b.ap}` : `between ${a.n} ${a.ap} and ${b.n} ${b.ap}`;
}

function hourIn(at: Date, timeZone: string): number {
  const hour = new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone })
    .formatToParts(at)
    .find((p) => p.type === "hour")?.value;
  return Number(hour ?? 0) % 24;
}

// Business.timezone is an IANA name with a default, but it is still a
// stored string; one bad value must not stop the whole Monday run.
function validTimeZone(zone: string | null | undefined): string {
  if (zone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: zone });
      return zone;
    } catch {
      // fall through
    }
  }
  return "America/New_York";
}
