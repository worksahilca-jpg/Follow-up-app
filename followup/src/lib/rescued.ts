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
    if (!f.repliedAt || !f.sentAt) continue;
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

/**
 * Plain-text body for the weekly digest email.
 *
 * `awaitingApproval` is how many leads have a reply written and held —
 * passed in rather than read here, so the dashboard's own call to
 * getRescueReport doesn't pay for a scan it already does separately.
 *
 * It is the number this email most needs. On an account with
 * `holdAllForApproval` on (the default for every account since
 * 2026-09-21), automated sends are zero by construction, so a digest
 * built only from `answeredForYou` and `rescued` reports a week of
 * nothing — to a business whose queue may hold a dozen written replies
 * that have been waiting since Monday. The week's actual headline is
 * not "we did nothing", it is "this needs you".
 */
export function renderRescueDigest(businessName: string, r: RescueReport, appUrl: string, awaitingApproval = 0): string {
  const lines = [
    `Here's what FollowUp did for ${businessName} in the last ${r.days} days.`,
    "",
    `Answered for you: ${r.answeredForYou}`,
  ];
  if (awaitingApproval > 0) {
    lines.push(`Written and waiting for your OK: ${awaitingApproval}`);
  }
  lines.push(
    `Conversations won back: ${r.rescued}`,
    `Appointments booked by them: ${r.booked}`,
    `Closed: ${r.won}${r.wonValue > 0 ? ` (${formatMoney(r.wonValue)})` : ""}`,
    `Still in play: ${formatMoney(r.valueInPlay)}`,
    ""
  );
  if (r.leads.length > 0) {
    lines.push("Who came back:");
    for (const l of r.leads.slice(0, 10)) {
      lines.push(`- ${l.name} — ${describeTrigger(l.trigger)}, replied ${l.repliedAfterHours}h later${l.dealValue > 0 ? `, ${formatMoney(l.dealValue)}` : ""}`);
    }
    lines.push("");
  } else if (awaitingApproval > 0) {
    // What the quiet week actually was. The line this replaces said
    // "every lead that wrote in was still answered within a minute" —
    // which on a holding account was the opposite of the truth, since
    // holdAllForApproval stops the instant acknowledgement too
    // (acknowledge.ts: "this was the last one that could reach a
    // stranger unread"). An owner was being emailed that their leads had
    // been answered while those replies sat unsent in their own queue.
    lines.push(
      `Nobody came back this week yet — ${awaitingApproval === 1 ? "there is 1 reply" : `there are ${awaitingApproval} replies`} written and waiting for your OK.`,
      "Nothing goes out until you send it.",
      ""
    );
  } else {
    // Still no "answered within a minute" here. This report counts
    // automated sends and the leads who replied to them; it never counted
    // how many leads wrote in, so that claim was never something it knew
    // — it was inferred from an empty list and happened to read well.
    lines.push("Nobody came back this week yet, and nothing is waiting on you.", "");
  }
  lines.push(`Open FollowUp: ${appUrl}/dashboard`);
  return lines.join("\n");
}

function formatMoney(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}
