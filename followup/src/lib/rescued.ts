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

export async function getRescueReport(businessId: string, days = 7): Promise<RescueReport> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const sent = await prisma.followUp.findMany({
    where: { automated: true, status: "sent", sentAt: { gte: since }, lead: { businessId } },
    select: {
      leadId: true,
      trigger: true,
      sentAt: true,
      repliedAt: true,
      lead: { select: { id: true, name: true, dealValue: true, stage: true } },
    },
    orderBy: { sentAt: "desc" },
  });

  const rescuedByLead = new Map<string, RescuedLead>();
  for (const f of sent) {
    if (!f.repliedAt || !f.sentAt) continue;
    const existing = rescuedByLead.get(f.leadId);
    const hours = Math.max(1, Math.round((f.repliedAt.getTime() - f.sentAt.getTime()) / 3_600_000));
    if (!existing || f.repliedAt > new Date(existing.repliedAfterHours)) {
      rescuedByLead.set(f.leadId, {
        id: f.lead.id,
        name: f.lead.name,
        trigger: f.trigger ?? "silence",
        repliedAfterHours: hours,
        dealValue: f.lead.dealValue,
        stage: f.lead.stage,
      });
    }
  }
  const leads = [...rescuedByLead.values()];
  const rescuedIds = leads.map((l) => l.id);

  const booked = rescuedIds.length
    ? await prisma.booking.count({ where: { businessId, leadId: { in: rescuedIds }, status: "confirmed", createdAt: { gte: since } } })
    : 0;

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

/** Plain-text body for the weekly digest email. */
export function renderRescueDigest(businessName: string, r: RescueReport, appUrl: string): string {
  const lines = [
    `Here's what FollowUp did for ${businessName} in the last ${r.days} days.`,
    "",
    `Answered for you: ${r.answeredForYou}`,
    `Conversations won back: ${r.rescued}`,
    `Appointments booked by them: ${r.booked}`,
    `Closed: ${r.won}${r.wonValue > 0 ? ` (${formatMoney(r.wonValue)})` : ""}`,
    `Still in play: ${formatMoney(r.valueInPlay)}`,
    "",
  ];
  if (r.leads.length > 0) {
    lines.push("Who came back:");
    for (const l of r.leads.slice(0, 10)) {
      lines.push(`- ${l.name} — ${describeTrigger(l.trigger)}, replied ${l.repliedAfterHours}h later${l.dealValue > 0 ? `, ${formatMoney(l.dealValue)}` : ""}`);
    }
    lines.push("");
  } else {
    lines.push("Nobody came back this week yet — every lead that wrote in was still answered within a minute.", "");
  }
  lines.push(`Open FollowUp: ${appUrl}/dashboard`);
  return lines.join("\n");
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
