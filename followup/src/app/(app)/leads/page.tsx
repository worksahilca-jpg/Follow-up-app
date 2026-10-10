import { getLeads } from "@/lib/leads-data";
import { getSessionContext } from "@/lib/session";
import { getPendingApprovals } from "@/lib/pendingApprovals";
import { getBusinessAutomationRules } from "@/lib/automationStatus";
import { getWaitingOn } from "@/lib/waitingOn";
import { getAtRiskLeads } from "@/lib/rescue";
import { customerGroups } from "@/lib/customerPlaces";
import { readQualification, readyWhy } from "@/lib/qualification";
import { prisma } from "@/lib/db";
import Link from "next/link";
import LeadsPageClient, { type Show, type GroupLines } from "./LeadsPageClient";
import PersonPanel from "@/components/app/PersonPanel";
import { sendLockedForSession } from "@/lib/sendingControl";
import { restingState, type StateKey } from "@/components/app/canvasBits";

export const dynamic = "force-dynamic";

/**
 * Customers (A-220): search, then the people who need the owner (Needs you,
 * Ready to book), then one row each for Booked, Going quiet, Waiting on
 * them and Everyone, which open as lists here (?show=). Each group is worked
 * out from the same sources Today uses, so the counts always agree, and
 * each customer is in one group only (customerGroups), so a count is always
 * the number of rows under it.
 *
 * The separate Waiting and Pipeline pages folded in here (A-219): Waiting is
 * ?show=waiting with what happens next on each row, and Pipeline is the
 * stage filter on Everyone, with each stage's total.
 */
const SHOWS: readonly Show[] = ["needs", "ready", "booked", "quiet", "waiting", "all"];

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ p?: string; show?: string; stage?: string }> }) {
  const { p, show: showParam, stage } = await searchParams;
  const show = SHOWS.find((s) => s === showParam) ?? null;
  const ctx = await getSessionContext();
  const leads = await getLeads();
  const empty = { needs: [], ready: [], booked: [], quiet: [], waiting: [] };
  if (!ctx) return <LeadsPageClient leads={leads} groups={empty} lines={{}} show={show} stage={stage ?? null} />;

  const now = new Date();
  const [approvals, business, rules, sendLocked, qualified, bookings] = await Promise.all([
    getPendingApprovals(ctx.businessId),
    prisma.business.findUnique({ where: { id: ctx.businessId }, select: { timezone: true } }),
    getBusinessAutomationRules(ctx.businessId),
    sendLockedForSession(),
    // Ready to book (#466): FollowUp has everything it asks for, so it's time
    // for a person to call. Lead.qualifiedAt is stamped once, when that happens.
    prisma.lead.findMany({
      where: { businessId: ctx.businessId, qualifiedAt: { not: null }, stage: { notIn: ["WON", "LOST"] } },
      orderBy: { qualifiedAt: "desc" },
      select: { id: true, qualification: true },
    }),
    // Booked: a confirmed call or visit still ahead, soonest first.
    prisma.booking.findMany({
      where: { businessId: ctx.businessId, status: "confirmed", scheduledAt: { gte: now } },
      orderBy: { scheduledAt: "asc" },
      select: { leadId: true, scheduledAt: true },
    }),
  ]);
  const timeZone = business?.timezone ?? "America/New_York";
  const needs = new Set(approvals.map((a) => a.leadId));
  const waitingItems = rules ? getWaitingOn(leads, rules, now, timeZone, needs) : [];
  const atRisk = getAtRiskLeads(leads, now);
  const groups = customerGroups({
    needs,
    ready: qualified.map((q) => q.id),
    booked: [...new Set(bookings.map((b) => b.leadId))],
    quiet: atRisk.map((l) => l.id),
    waiting: waitingItems.map((w) => w.leadId),
  });
  const { quiet, waiting } = groups;

  // The line under each name, where the group has something better to say
  // than their last message: why they're ready, why they're going quiet,
  // what happens next, and when the booking is.
  // Set in the groups' own order (booked, ready, quiet, waiting), so a row's line always matches the group it's in.
  const lines: GroupLines = {};
  for (const b of bookings) {
    lines[b.leadId] ??= b.scheduledAt.toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone });
  }
  for (const q of qualified) {
    const known = readQualification(q.qualification);
    const why = known ? readyWhy(known) : "";
    if (why) lines[q.id] ??= why;
  }
  for (const l of atRisk) lines[l.id] ??= l.rescue.reason;
  for (const w of waitingItems) lines[w.leadId] ??= w.next;

  // A customer opened beside the list (A-025, the canvas App board). Only
  // one of this business's own customers: getLeads is already scoped.
  const open = p ? leads.find((l) => l.id === p) ?? null : null;
  if (!open) return <LeadsPageClient leads={leads} groups={groups} lines={lines} show={show} stage={stage ?? null} />;

  const approval = approvals.find((a) => a.leadId === open.id) ?? null;
  const place: { state: StateKey; label: string } = needs.has(open.id)
    ? { state: "needs", label: "Needs you" }
    : groups.ready.includes(open.id)
      ? { state: "needs", label: "Ready to book" }
      : groups.booked.includes(open.id)
        ? { state: "checked", label: "Booked" }
        : quiet.includes(open.id)
      ? { state: "quiet", label: "Going quiet" }
      : waiting.includes(open.id)
        ? { state: "waiting", label: "Waiting" }
        : restingState(open);

  return (
    // Desktop: full height, the list on the left and the customer docked on
    // the right edge, the Inbox's frame (A-025). Phone: the customer alone.
    <div className="app-bleed lg:grid lg:h-screen lg:grid-cols-[minmax(0,1fr)_400px]">
      <div className="hidden min-w-0 lg:block lg:overflow-y-auto lg:px-7 lg:pb-12 lg:pt-9">
        <LeadsPageClient leads={leads} groups={groups} lines={lines} show={show} stage={stage ?? null} openId={open.id} />
      </div>
      <aside aria-label={open.name} className="lg:overflow-y-auto lg:border-l lg:border-line lg:bg-card">
        <Link href={show ? `/leads?show=${show}` : "/leads"} className="mb-3 inline-flex min-h-11 items-center text-[13px] text-ink-faint lg:hidden">
          ← Customers
        </Link>
        <div className="overflow-hidden rounded-[18px] border border-line bg-card lg:overflow-visible lg:rounded-none lg:border-0">
          <PersonPanel lead={open} approval={approval} place={place} timeZone={timeZone} now={now} sendLocked={sendLocked} />
        </div>
      </aside>
    </div>
  );
}
