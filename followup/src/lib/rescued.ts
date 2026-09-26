import { prisma } from "@/lib/db";

/**
 * "What FollowUp saved you" — the number an owner can weigh against the
 * price (PRODUCT_DIRECTION.md, main goal point 2; the metric the research
 * found no competitor reports). Everything here is derived from rows the
 * app already writes: FollowUp.trigger/automated/repliedAt (attribution),
 * Booking, Lead.dealValue and stage.
 *
 * A "rescued conversation" is a lead who replied to a message FollowUp
 * sent on its own (instant reply, unanswered-reply, silence follow-up, or a
 * workflow step). A reply to a MANUAL send is the owner's own work and is
 * deliberately not counted — the report must never flatter itself.
 */
export interface RescuedLead {
  id: string;
  name: string;
  trigger: string;
  repliedAfterHours: number;
  dealValue: number;
  stage: string;
  // Their earliest confirmed booking made in the period, or null. The
  // weekly email's win is "came back and booked" only when this is set.
  bookedFor: Date | null;
}

export interface RescueReport {
  days: number;
  answeredForYou: number; // automated sends in the period
  rescued: number; // distinct leads who replied to one of those
  booked: number; // bookings created by rescued leads in the period
  won: number; // rescued leads now WON
  valueInPlay: number; // sum of dealValue across rescued leads not yet won/lost
  wonValue: number; // sum of dealValue across rescued leads that closed
  leads: RescuedLead[]; // most recent reply first
}

/**
 * `end` defaults to now. The weekly email passes last week's end to put
 * this week's numbers beside last week's; a reply that came after `end`
 * belongs to the later window, not this one.
 */
export async function getRescueReport(businessId: string, days = 7, end: Date = new Date()): Promise<RescueReport> {
  const since = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

  const sent = await prisma.followUp.findMany({
    where: { automated: true, status: "sent", sentAt: { gte: since, lt: end }, lead: { businessId } },
    select: {
      leadId: true,
      trigger: true,
      sentAt: true,
      repliedAt: true,
      lead: { select: { id: true, name: true, dealValue: true, stage: true } },
    },
    orderBy: { sentAt: "desc" },
  });

  // One row per lead, keeping the follow-up they replied to MOST recently —
  // a lead can reply to several over the window, and the newest reply is
  // the one that describes what actually brought them back.
  //
  // repliedAt is tracked in its own map rather than compared off the stored
  // RescuedLead: `repliedAfterHours` is a DURATION in hours, not a
  // timestamp, so the previous `f.repliedAt > new Date(existing.repliedAfterHours)`
  // compared a real date against ~1970-01-01 (new Date(3) is 3ms past the
  // epoch) and was therefore always true. Every lead ended up attributed to
  // whichever of its follow-ups was iterated last — the OLDEST, since
  // `sent` is ordered sentAt desc — so the digest named the wrong trigger
  // and the wrong "replied Nh later" for any lead with more than one.
  const rescuedByLead = new Map<string, RescuedLead>();
  const latestReplyByLead = new Map<string, Date>();
  for (const f of sent) {
    if (!f.repliedAt || !f.sentAt || f.repliedAt >= end) continue;
    const bestSoFar = latestReplyByLead.get(f.leadId);
    if (bestSoFar && f.repliedAt <= bestSoFar) continue;
    latestReplyByLead.set(f.leadId, f.repliedAt);
    const hours = Math.max(1, Math.round((f.repliedAt.getTime() - f.sentAt.getTime()) / 3_600_000));
    rescuedByLead.set(f.leadId, {
      id: f.lead.id,
      name: f.lead.name,
      trigger: f.trigger ?? "silence",
      repliedAfterHours: hours,
      dealValue: f.lead.dealValue,
      stage: f.lead.stage,
      bookedFor: null,
    });
  }
  // Sorted explicitly rather than relying on Map insertion order, which
  // follows each lead's FIRST-seen follow-up (i.e. sentAt), not its reply —
  // and the digest only prints the top 10, so the order decides who a
  // business actually reads about.
  const leads = [...rescuedByLead.values()].sort(
    (a, b) => (latestReplyByLead.get(b.id)?.getTime() ?? 0) - (latestReplyByLead.get(a.id)?.getTime() ?? 0)
  );
  const rescuedIds = leads.map((l) => l.id);

  // The rows, not a count: the weekly email names when the win is booked
  // for. Earliest first, so each lead keeps its soonest appointment.
  const bookings = rescuedIds.length
    ? await prisma.booking.findMany({
        where: { businessId, leadId: { in: rescuedIds }, status: "confirmed", createdAt: { gte: since, lt: end } },
        select: { leadId: true, scheduledAt: true },
        orderBy: { scheduledAt: "asc" },
      })
    : [];
  const booked = bookings.length;
  for (const b of bookings) {
    const lead = rescuedByLead.get(b.leadId);
    if (lead && !lead.bookedFor) lead.bookedFor = b.scheduledAt;
  }

  const won = leads.filter((l) => l.stage === "WON");
  const open = leads.filter((l) => l.stage !== "WON" && l.stage !== "LOST");

  return {
    days,
    answeredForYou: sent.length,
    rescued: leads.length,
    booked,
    won: won.length,
    valueInPlay: open.reduce((s, l) => s + l.dealValue, 0),
    wonValue: won.reduce((s, l) => s + l.dealValue, 0),
    leads,
  };
}

export function describeTrigger(trigger: string): string {
  switch (trigger) {
    case "instant_ack":
      return "instant reply";
    case "unanswered":
      return "replied when you hadn't";
    case "sequence":
      return "workflow";
    case "silence":
      return "follow-up on silence";
    case "dead_lead_reactivation":
      return "reactivated a cold lead";
    default:
      return trigger;
  }
}

export function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
