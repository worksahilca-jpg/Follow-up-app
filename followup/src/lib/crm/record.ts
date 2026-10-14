import { prisma } from "@/lib/db";

/**
 * "What FollowUp wrote in Follow Up Boss" (A-252): the week's writes from
 * src/lib/crm/writes.ts, each said the way the owner would say it. Admins
 * only (it carries customers' names and what was written to them), read by
 * GET /api/crm/config for Settings › More › Advanced.
 */

export interface CrmRecordItem {
  id: string;
  at: string;
  /** "Note on Nadia Khan" */
  title: string;
  /** The words, in short: "Sent: yes, the Maple St condo is still available…" */
  quote: string | null;
  status: string;
  attempts: number;
  doneAt: string | null;
  nextTryAt: string | null;
}

export interface CrmRecord {
  /** Customers brought in from this CRM, all time. */
  broughtIn: number;
  /** Writes in the last 7 days, newest first (at most RECORD_LIMIT). */
  items: CrmRecordItem[];
  /** All writes in the last 7 days, for "Show all 38 this week". */
  weekCount: number;
}

export const RECORD_LIMIT = 50;
const QUOTE_CHARS = 90;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function clip(s: string): string {
  const one = s.replace(/\s+/g, " ").trim();
  return one.length > QUOTE_CHARS ? `${one.slice(0, QUOTE_CHARS - 1).trimEnd()}…` : one;
}

/**
 * One write in the owner's words. Notes are the only kind so far: the note
 * after each reply ("FollowUp sent: …", src/lib/sending.ts) and the ready card
 * ("FollowUp: Nadia Khan looks ready to talk.", src/lib/crm/notes.ts).
 */
export function describeWrite(kind: string, text: string, name: string): { title: string; quote: string | null } {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  if (kind === "note" && lines[0] === "FollowUp sent:") {
    const body = lines.slice(1).join(" ");
    return { title: `Note on ${name}`, quote: body ? `Sent: "${clip(body)}"` : null };
  }
  if (kind === "note" && /^FollowUp: .* looks ready to talk\.$/.test(lines[0] ?? "")) {
    return { title: `Note on ${name}: ready to talk`, quote: lines.length > 1 ? clip(lines.slice(1).join(" · ")) : null };
  }
  return { title: `Note on ${name}`, quote: lines[0] ? clip(lines[0]) : null };
}

export async function loadCrmRecord(businessId: string, provider: string, now: Date = new Date()): Promise<CrmRecord> {
  const since = new Date(now.getTime() - WEEK_MS);
  const where = { businessId, provider, createdAt: { gte: since } };
  const [broughtIn, weekCount, rows] = await Promise.all([
    prisma.lead.count({ where: { businessId, crmProvider: provider } }),
    prisma.crmWrite.count({ where }),
    prisma.crmWrite.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: RECORD_LIMIT,
      select: {
        id: true,
        kind: true,
        text: true,
        status: true,
        attempts: true,
        createdAt: true,
        doneAt: true,
        nextTryAt: true,
        lead: { select: { name: true } },
      },
    }),
  ]);
  return {
    broughtIn,
    weekCount,
    items: rows.map((r) => ({
      id: r.id,
      at: r.createdAt.toISOString(),
      ...describeWrite(r.kind, r.text, r.lead.name),
      status: r.status,
      attempts: r.attempts,
      doneAt: r.doneAt?.toISOString() ?? null,
      nextTryAt: r.nextTryAt?.toISOString() ?? null,
    })),
  };
}
