import { channelFromSource, LEAD_AD_SOURCE } from "@/lib/displayChannel";
import { greetingFirstName, isPlaceholderLeadName } from "@/lib/leadName";
import type { NewCrmPerson } from "@/lib/crm/types";

/**
 * "Missed by your CRM" (A-315), the pure half: who wrote to the owner by email, DM or form and still isn't in their
 * CRM, said in the owner's words. The CRM never sees the inbox or the DMs, so this is the one count it can't give
 * (founder, 2026-10-22: "I don't want CRMs to get all these features and eat us").
 *
 * The data half (src/lib/missedByCrmData.ts) decides who is eligible: a real customer (not the practice one) who
 * wrote in the last 30 days, has an email or a phone, hasn't said no or stop, and was already here when FollowUp last
 * finished checking the whole CRM. Everyone else the CRM sync (src/lib/crmSync.ts) links by email and phone.
 */

export const MISSED_WINDOW_DAYS = 30;
/** People added in one tap of "Add all", so a long list can't hold the request open. The rest wait for the next tap. */
export const ADD_ALL_MAX = 25;
/** New customers added by themselves in one CRM sync run (every 10 minutes). */
export const AUTO_ADD_PER_RUN = 10;
/** Their words that go into the CRM note: the latest few, each cut short. */
export const NOTE_MESSAGES = 5;
export const NOTE_MESSAGE_CHARS = 500;

export interface MissedLead {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  createdAt: Date;
  crmId: string | null;
  crmAddedAt: Date | null;
  /** The first conversation's channel and, for email, Gmail or Outlook. */
  channel: string | null;
  emailProvider: string | null;
  /** The first thing they wrote, and when. */
  firstWords: string | null;
  wroteAt: Date | null;
}

export interface Place {
  label: string;
  count: number;
}

export type MissedState =
  | { kind: "none" }
  | { kind: "missing"; missing: MissedLead[]; places: Place[] }
  | { kind: "all_in"; caught: number; places: Place[] };

/** Where they wrote, as the owner calls it: "Gmail", "Instagram", "Website form". */
export function placeLabel(channel: string | null, emailProvider: string | null, source: string | null): string {
  const c = channel ?? channelFromSource(source);
  if (c === "email") {
    const p = (emailProvider ?? source ?? "").toLowerCase();
    if (p.includes("gmail")) return "Gmail";
    if (p.includes("outlook")) return "Outlook";
    return "Email";
  }
  if (c === "web") return source === LEAD_AD_SOURCE ? "Facebook lead form" : "Website form";
  if (c === "lead_form") return "Facebook lead form";
  if (c === "instagram") return "Instagram";
  if (c === "messenger") return "Messenger";
  if (c === "whatsapp") return "WhatsApp";
  if (c === "text") return "Text";
  if (c === "call") return "Phone call";
  return "Other";
}

/** Not yet in the CRM: FollowUp hasn't linked them to anyone there. */
export function isMissing(lead: Pick<MissedLead, "crmId">): boolean {
  return !lead.crmId;
}

/** One row per place, the most first; ties keep the order they came in. */
export function placesOf(leads: MissedLead[]): Place[] {
  const counts = new Map<string, number>();
  for (const l of leads) {
    const label = placeLabel(l.channel, l.emailProvider, l.source);
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  return [...counts.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count);
}

/**
 * What Results shows. `leads` are the eligible customers of the last 30 days: still missing, or added by FollowUp.
 * Nobody missing and nobody added: nothing to show. Everyone added: the after state, counting who FollowUp caught.
 */
export function missedState(leads: MissedLead[]): MissedState {
  const missing = leads.filter(isMissing);
  if (missing.length) return { kind: "missing", missing, places: placesOf(missing) };
  const caught = leads.filter((l) => l.crmAddedAt);
  if (!caught.length) return { kind: "none" };
  return { kind: "all_in", caught: caught.length, places: placesOf(caught) };
}

/**
 * The name the CRM gets. A real name splits into first and last; an "@handle" stays whole as the first name, which
 * is how the owner knows them on Instagram. A placeholder ("Instagram DM"), an email or a phone number is not a name:
 * both halves are "", and the CRM shows the email or phone instead.
 */
export function crmName(name: string): Pick<NewCrmPerson, "firstName" | "lastName"> {
  const trimmed = name.trim();
  if (isPlaceholderLeadName(trimmed) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) || !/\p{L}/u.test(trimmed)) return { firstName: "", lastName: "" };
  if (trimmed.startsWith("@")) return { firstName: trimmed.split(/\s+/)[0], lastName: "" };
  if (!greetingFirstName(trimmed)) return { firstName: "", lastName: "" };
  const [first, ...rest] = trimmed.split(/\s+/);
  return { firstName: first, lastName: rest.join(" ") };
}

/** "Oct 19", in the owner's time zone. */
export function shortDate(at: Date, timeZone?: string): string {
  return at.toLocaleDateString("en-US", { month: "short", day: "numeric", ...(timeZone ? { timeZone } : {}) });
}

/** One message's words for a note: spaces tidied, cut at a word with "…" when long. */
export function noteWords(body: string, max = NOTE_MESSAGE_CHARS): string {
  const flat = body.replace(/\s+/g, " ").trim();
  if (flat.length <= max) return flat;
  const cut = flat.slice(0, max);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/**
 * The note on their new CRM record: who, where they wrote, and their own words, latest last.
 *
 *   FollowUp added Priya Shah. They wrote on Instagram and weren't in Follow Up Boss.
 *   Oct 19: "Looking for a 2-bed condo near Square One"
 *   Oct 20: "Is Saturday ok?"
 */
export function addedNote(
  input: { name: string; place: string; crmLabel: string; messages: Array<{ body: string; sentAt: Date }> },
  timeZone?: string
): string {
  const who = crmName(input.name).firstName ? input.name.trim() : "this customer";
  const head = `FollowUp added ${who}. They wrote on ${input.place} and weren't in ${input.crmLabel}.`;
  const lines = [...input.messages]
    .sort((a, b) => a.sentAt.getTime() - b.sentAt.getTime())
    .slice(-NOTE_MESSAGES)
    .map((m) => `${shortDate(m.sentAt, timeZone)}: "${noteWords(m.body)}"`)
    .filter((l) => !l.endsWith(': ""'));
  return [head, ...lines].join("\n");
}

/** "just now", "4 min ago", "2 h ago", "Oct 19": when FollowUp last finished checking the whole CRM. */
export function checkedAgo(at: Date, now: Date, timeZone?: string): string {
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return shortDate(at, timeZone);
}
