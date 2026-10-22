import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { CRM_PROVIDERS, isCrmProvider, type CrmProvider } from "@/lib/crm";
import { writeToCrm } from "@/lib/crm/writes";
import { normalizeCrmEmail, normalizeCrmPhone } from "@/lib/crmSync";
import { REAL_CUSTOMER } from "@/lib/pilotNumbersData";
import {
  ADD_ALL_MAX,
  AUTO_ADD_PER_RUN,
  MISSED_WINDOW_DAYS,
  NOTE_MESSAGES,
  addedNote,
  crmName,
  missedState,
  placeLabel,
  type MissedLead,
  type MissedState,
} from "@/lib/missedByCrm";

/**
 * "Missed by your CRM" (A-315), the data half: who is missing, adding them, and adding new ones by themselves.
 * Every read and write is scoped to the business it was asked for.
 */

const DAY = 86_400_000;

export interface MissedView {
  provider: CrmProvider;
  crmLabel: string;
  /** When FollowUp last finished checking the whole CRM. Only customers already here then are counted. */
  checkedAt: Date;
  /** New customers go in by themselves. */
  autoAdd: boolean;
  /** Writing to the CRM is paused in Settings (A-252): nothing can be added until it's back on. */
  paused: boolean;
  state: MissedState;
  timeZone: string;
}

interface Conn {
  provider: CrmProvider;
  apiKey: string;
  lastSyncedAt: Date;
  autoAddSince: Date | null;
  autoAddOff: boolean;
  writesPausedAt: Date | null;
}

/** Connected, with a key, and checked end to end at least once. Before that, nobody can be called missing. */
async function connection(businessId: string): Promise<Conn | null> {
  const conn = await prisma.crmConnection.findUnique({
    where: { businessId },
    select: { provider: true, apiKey: true, lastSyncedAt: true, autoAddSince: true, autoAddOff: true, writesPausedAt: true },
  });
  if (!conn?.apiKey || !isCrmProvider(conn.provider) || !conn.lastSyncedAt) return null;
  return { ...conn, provider: conn.provider, apiKey: conn.apiKey, lastSyncedAt: conn.lastSyncedAt };
}

/**
 * Someone who could be missed: a real customer (not the practice one) who wrote to the owner themselves, created in
 * the window and before the last full check of the CRM, with an email or phone to add them by, who hasn't said no or
 * stop (the owner's CRM may write to a new contact on its own; FollowUp never hands it someone who asked not to hear).
 */
export function eligibleWhere(businessId: string, from: Date, checkedAt: Date): Prisma.LeadWhereInput {
  return {
    businessId,
    createdAt: { gte: from, lte: checkedAt },
    optedOutAt: null,
    saidNoAt: null,
    conversations: { some: { messages: { some: { direction: "inbound" } } } },
    AND: [
      REAL_CUSTOMER,
      { OR: [{ email: { not: null } }, { phone: { not: null } }, { dmEmail: { not: null } }, { dmPhone: { not: null } }] },
    ],
  };
}

const LEAD_SELECT = {
  id: true,
  name: true,
  email: true,
  phone: true,
  dmEmail: true,
  dmPhone: true,
  source: true,
  createdAt: true,
  crmId: true,
  crmAddedAt: true,
  conversations: {
    orderBy: { createdAt: "asc" as const },
    take: 1,
    select: {
      channel: true,
      emailProvider: true,
      messages: { where: { direction: "inbound" }, orderBy: { sentAt: "asc" as const }, take: 1, select: { body: true, sentAt: true } },
    },
  },
} satisfies Prisma.LeadSelect;

type LeadRow = Prisma.LeadGetPayload<{ select: typeof LEAD_SELECT }>;

function toMissed(l: LeadRow): MissedLead {
  const convo = l.conversations[0];
  const first = convo?.messages[0];
  return {
    id: l.id,
    name: l.name,
    email: l.email ?? l.dmEmail,
    phone: l.phone ?? l.dmPhone,
    source: l.source,
    createdAt: l.createdAt,
    crmId: l.crmId,
    crmAddedAt: l.crmAddedAt,
    channel: convo?.channel ?? null,
    emailProvider: convo?.emailProvider ?? null,
    firstWords: first?.body.replace(/\s+/g, " ").trim().slice(0, 160) || null,
    wroteAt: first?.sentAt ?? null,
  };
}

/** What Results shows, or null when there is no CRM to compare with yet. */
export async function loadMissedByCrm(businessId: string, now: Date = new Date()): Promise<MissedView | null> {
  const conn = await connection(businessId);
  if (!conn) return null;
  const from = new Date(now.getTime() - MISSED_WINDOW_DAYS * DAY);
  const [rows, business] = await Promise.all([
    prisma.lead.findMany({
      where: { ...eligibleWhere(businessId, from, conn.lastSyncedAt), OR: [{ crmId: null }, { crmAddedAt: { not: null } }] },
      orderBy: { createdAt: "desc" },
      take: 200,
      select: LEAD_SELECT,
    }),
    prisma.business.findUnique({ where: { id: businessId }, select: { timezone: true } }),
  ]);
  return {
    provider: conn.provider,
    crmLabel: CRM_PROVIDERS[conn.provider].label,
    checkedAt: conn.lastSyncedAt,
    autoAdd: Boolean(conn.autoAddSince),
    paused: Boolean(conn.writesPausedAt),
    state: missedState(rows.map(toMissed)),
    timeZone: business?.timezone ?? "America/New_York",
  };
}

export interface AddResult {
  added: number;
  /** Who couldn't be added, and the CRM's reason, for the owner to try again. */
  failed: Array<{ id: string; message: string }>;
}

/**
 * Adds these customers to the owner's CRM, each with their messages as a note. `ids: "all"` is everyone missing
 * (at most ADD_ALL_MAX a tap). Only customers who are still missing and eligible are touched, so a stale screen or a
 * forged id can't add anyone else. The first Add turns on "new ones go in by themselves", unless the owner turned it
 * off before (A-315, the founder's yes to the recommendation).
 */
export async function addMissedToCrm(businessId: string, ids: string[] | "all", now: Date = new Date()): Promise<AddResult | { error: string }> {
  const conn = await connection(businessId);
  if (!conn) return { error: "No CRM is connected." };
  const label = CRM_PROVIDERS[conn.provider].label;
  if (conn.writesPausedAt) return { error: `Writing to ${label} is paused. Turn it back on in Settings, then add them.` };
  const from = new Date(now.getTime() - MISSED_WINDOW_DAYS * DAY);
  const leads = await prisma.lead.findMany({
    where: { ...eligibleWhere(businessId, from, conn.lastSyncedAt), crmId: null, ...(ids === "all" ? {} : { id: { in: ids } }) },
    orderBy: { createdAt: "asc" },
    take: ADD_ALL_MAX,
    select: LEAD_SELECT,
  });
  const result = await addLeads(businessId, conn, leads, now);
  if (result.added && !conn.autoAddSince && !conn.autoAddOff) {
    await prisma.crmConnection.update({ where: { businessId }, data: { autoAddSince: now } });
  }
  return result;
}

/** "New customers go in by themselves": on (from now) or off (the owner's own choice, kept). */
export async function setAutoAdd(businessId: string, on: boolean, now: Date = new Date()): Promise<boolean> {
  const conn = await connection(businessId);
  if (!conn) return false;
  await prisma.crmConnection.update({ where: { businessId }, data: on ? { autoAddSince: now, autoAddOff: false } : { autoAddSince: null, autoAddOff: true } });
  return true;
}

/**
 * After a CRM sync run that checked the whole CRM (src/lib/crmSync.ts): new customers since "by themselves" was turned
 * on, who still aren't there, go in. A few per run; never anyone from before the switch, so turning it on never
 * empties an old list behind the owner's back.
 */
export async function autoAddMissed(businessId: string, now: Date = new Date()): Promise<AddResult> {
  const conn = await connection(businessId);
  if (!conn?.autoAddSince || conn.writesPausedAt) return { added: 0, failed: [] };
  const from = new Date(Math.max(conn.autoAddSince.getTime(), now.getTime() - MISSED_WINDOW_DAYS * DAY));
  const leads = await prisma.lead.findMany({
    where: { ...eligibleWhere(businessId, from, conn.lastSyncedAt), crmId: null },
    orderBy: { createdAt: "asc" },
    take: AUTO_ADD_PER_RUN,
    select: LEAD_SELECT,
  });
  return addLeads(businessId, conn, leads, now);
}

async function addLeads(businessId: string, conn: Conn, leads: LeadRow[], now: Date): Promise<AddResult> {
  const { client, label } = CRM_PROVIDERS[conn.provider];
  const business = await prisma.business.findUnique({ where: { id: businessId }, select: { timezone: true } });
  const out: AddResult = { added: 0, failed: [] };
  for (const lead of leads) {
    const m = toMissed(lead);
    const email = normalizeCrmEmail(m.email);
    const phone = normalizeCrmPhone(m.phone);
    if (!email && !phone) {
      out.failed.push({ id: lead.id, message: "No email or phone to add them by." });
      continue;
    }
    const made = await client.createPerson(conn.apiKey, { ...crmName(lead.name), email, phone });
    if (!made.ok || !made.externalId) {
      out.failed.push({ id: lead.id, message: made.message ?? `${label} didn't take them.` });
      continue;
    }
    // Linked only while still unlinked (a sync may have linked them meanwhile). Two FollowUp customers can be the
    // same CRM person (one wrote by email, one by DM): the CRM's own id is unique here, so the second stays unlinked
    // and is said, never silently merged.
    try {
      const linked = await prisma.lead.updateMany({
        where: { id: lead.id, businessId, crmId: null },
        data: { crmProvider: conn.provider, crmId: made.externalId, crmAddedAt: now },
      });
      if (!linked.count) continue;
    } catch (err) {
      if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
        out.failed.push({ id: lead.id, message: `${label} already has them under another customer here.` });
        continue;
      }
      throw err;
    }
    out.added++;
    const messages = await prisma.message.findMany({
      where: { direction: "inbound", conversation: { leadId: lead.id, lead: { businessId } } },
      orderBy: { sentAt: "desc" },
      take: NOTE_MESSAGES,
      select: { body: true, sentAt: true },
    });
    const text = addedNote(
      { name: lead.name, place: placeLabel(m.channel, m.emailProvider, m.source), crmLabel: label, messages },
      business?.timezone ?? undefined
    );
    await writeToCrm({ businessId, leadId: lead.id, provider: conn.provider, crmId: made.externalId, kind: "note", text }, now);
  }
  return out;
}
