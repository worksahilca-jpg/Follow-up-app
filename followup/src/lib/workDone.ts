import { prisma } from "@/lib/db";
import { formatSpan } from "@/lib/activation";

/**
 * What FollowUp did for the owner, said once (A-088, round 2 of the 2026-10-05 check-up).
 *
 * The labour illusion (Buell & Norton, 2011): people value a service more when they can see the
 * work done for them. FollowUp's work is invisible by design: it reads every email, sets aside the
 * ones that aren't customers and writes the replies. This counts only what the app records, so the
 * line can never claim work that didn't happen: leads it found (not ones the owner typed in or
 * imported), replies it wrote (held for the owner, or sent on its own), and emails it set aside
 * (FilteredEmail).
 */
export type WorkDone = { customersFound: number; repliesWritten: number; setAside: number };

/** Sources the owner adds by hand. A lead from one of these was not "found" by FollowUp. */
const ADDED_BY_HAND = ["Manual entry", "CSV import", "Phone call"];

export async function countWorkSince(businessId: string, since: Date): Promise<WorkDone> {
  const [customersFound, held, sentOnItsOwn, setAside] = await Promise.all([
    prisma.lead.count({
      where: { businessId, createdAt: { gte: since }, NOT: { source: { in: ADDED_BY_HAND } } },
    }),
    prisma.auditEvent.count({ where: { businessId, action: "ai.hold", createdAt: { gte: since } } }),
    prisma.followUp.count({ where: { automated: true, status: "sent", sentAt: { gte: since }, lead: { businessId } } }),
    prisma.filteredEmail.count({ where: { businessId, createdAt: { gte: since } } }),
  ]);
  return { customersFound, repliesWritten: held + sentOnItsOwn, setAside };
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/**
 * "Since yesterday, FollowUp found 3 customers, wrote 3 replies, and set aside 39 emails that
 * weren't customers." Any part that is zero is left out; null when everything is.
 */
export function workLine(w: WorkDone): string | null {
  const parts: string[] = [];
  if (w.customersFound > 0) parts.push(`found ${plural(w.customersFound, "customer", "customers")}`);
  if (w.repliesWritten > 0) parts.push(`wrote ${plural(w.repliesWritten, "reply", "replies")}`);
  if (w.setAside > 0) parts.push(`set aside ${plural(w.setAside, "email", "emails")} that ${w.setAside === 1 ? "wasn't a customer" : "weren't customers"}`);
  if (parts.length === 0) return null;
  const list = parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")}${parts.length > 2 ? "," : ""} and ${parts[parts.length - 1]}`;
  return `Since yesterday, FollowUp ${list}.`;
}

/**
 * What came of the week, for the end of the day (peak-end, A-088): "This week: 11 customers
 * answered · 2 came back after a follow-up · 1 booked a call · customers heard back in 12 min."
 * The same facts the "This week" line counted (weekLine), said as outcomes. Null when all are zero.
 */
export function resultsLine(w: { answered: number; cameBack: number; booked: number; heardBackMs?: number | null }): string | null {
  const parts: string[] = [];
  if (w.answered > 0) parts.push(`${plural(w.answered, "customer", "customers")} answered`);
  if (w.cameBack > 0) parts.push(`${w.cameBack} came back after a follow-up`);
  if (w.booked > 0) parts.push(`${w.booked} booked a call`);
  if (w.heardBackMs != null) parts.push(`customers heard back in ${formatSpan(w.heardBackMs)}`);
  return parts.length ? `This week: ${parts.join(" · ")}.` : null;
}
