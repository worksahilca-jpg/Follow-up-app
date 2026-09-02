import { Lead, TeamMember, WeeklyReport } from "./types";

// Dates are generated relative to "today" so the demo always looks current.
const daysAgo = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString();
};
const daysFromNow = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString();
};

export const leads: Lead[] = [
  {
    id: "sarah-johnson",
    name: "Sarah Johnson",
    company: "ABC Marketing",
    email: "sarah@abcmarketing.com",
    phone: "(416) 555-0142",
    source: "Website form",
    stage: "proposal",
    dealValue: 3500,
    score: 92,
    priority: "high",
    scoreReason:
      "Sarah asked about pricing and timeline, opened your proposal email twice, and hasn't replied in 5 days — that combination usually means she's still deciding, not gone cold.",
    scoreFactors: [
      { label: "Requested pricing & timeline", weight: 28 },
      { label: "Opened proposal email (2x)", weight: 22 },
      { label: "No response for 5 days", weight: 18 },
      { label: "Deal value above account average", weight: 14 },
      { label: "Replied within 1 day earlier in thread", weight: 10 },
    ],
    lastContacted: daysAgo(5),
    nextFollowUp: daysAgo(0),
    assignedTo: "Sahil",
    notes: "Met at the Riverdale open house. Wants to move fast if pricing works.",
    conversation: [
      { id: "m1", direction: "inbound", channel: "email", date: daysAgo(9), body: "Hi, I saw your listing photography and I'd love a quote for our new development launch." },
      { id: "m2", direction: "outbound", channel: "email", date: daysAgo(8), body: "Thanks Sarah — happy to help. Could you share the number of units and your timeline?" },
      { id: "m3", direction: "inbound", channel: "email", date: daysAgo(7), body: "12 units, launching in 3 weeks. What would that cost, and how fast can you turn around edits?" },
      { id: "m4", direction: "outbound", channel: "email", date: daysAgo(6), body: "Sent over a proposal for the full 12-unit package with 48-hour turnaround. Let me know what you think!", opened: true },
      { id: "m5", direction: "inbound", channel: "email", date: daysAgo(5), body: "This looks great, let me discuss with my partner and get back to you.", opened: true },
    ],
    suggestedMessage:
      "Hey Sarah, just checking in on the proposal I sent over for the 12-unit launch — happy to answer any questions or adjust the package if timing's changed. Let me know what you and your partner think!",
    automationTier: "off",
  },
  {
    id: "mike-patel",
    name: "Mike Patel",
    company: "Patel Home Services",
    email: "mike@patelhs.ca",
    phone: "(647) 555-0110",
    source: "Referral",
    stage: "qualified",
    dealValue: 1200,
    score: 68,
    priority: "medium",
    scoreReason:
      "Mike requested a proposal 3 days ago and has replied quickly in the past, but hasn't shown pricing urgency yet.",
    scoreFactors: [
      { label: "Requested a proposal", weight: 24 },
      { label: "Fast responder historically", weight: 16 },
      { label: "No response for 3 days", weight: 12 },
      { label: "Smaller deal value", weight: -8 },
    ],
    lastContacted: daysAgo(3),
    nextFollowUp: daysAgo(0),
    assignedTo: "Sahil",
    notes: "Referred by John Smith. Seasonal work, could turn into a repeat client.",
    conversation: [
      { id: "m1", direction: "inbound", channel: "email", date: daysAgo(6), body: "John mentioned you do great work — can you send over what a seasonal package looks like?" },
      { id: "m2", direction: "outbound", channel: "email", date: daysAgo(5), body: "Absolutely, sending a proposal for a full seasonal package today." },
      { id: "m3", direction: "outbound", channel: "email", date: daysAgo(3), body: "Here's the proposal — let me know if you'd like anything adjusted.", opened: true },
    ],
    suggestedMessage:
      "Hi Mike, wanted to follow up on the seasonal package proposal — happy to walk through pricing on a quick call if that's easier. Let me know what works!",
    automationTier: "off",
  },
  {
    id: "john-smith",
    name: "John Smith",
    company: "Smith & Co Realty",
    email: "john@smithco.ca",
    phone: "(905) 555-0198",
    source: "Past client",
    stage: "negotiation",
    dealValue: 8000,
    score: 81,
    priority: "high",
    scoreReason:
      "John asked to discuss the proposal by phone — a request for a call is one of the strongest buying signals in your pipeline.",
    scoreFactors: [
      { label: "Requested a phone call", weight: 30 },
      { label: "Large deal value", weight: 20 },
      { label: "Repeat client", weight: 15 },
      { label: "No response for 2 days", weight: 8 },
    ],
    lastContacted: daysAgo(2),
    nextFollowUp: daysFromNow(1),
    assignedTo: "Sahil",
    notes: "Wants to expand to a 6-property portfolio package.",
    conversation: [
      { id: "m1", direction: "inbound", channel: "email", date: daysAgo(4), body: "Ready to talk about expanding our work together to the whole portfolio." },
      { id: "m2", direction: "outbound", channel: "email", date: daysAgo(3), body: "Great news — sent over portfolio pricing for review." },
      { id: "m3", direction: "inbound", channel: "call", date: daysAgo(2), body: "Can we hop on a call this week to go over the numbers?" },
    ],
    suggestedMessage:
      "Hi John, would tomorrow at 2pm or Thursday morning work for a quick call to go through the portfolio numbers?",
    automationTier: "assisted",
  },
  {
    id: "priya-nair",
    name: "Priya Nair",
    company: "Nair Consulting",
    email: "priya@nairconsulting.com",
    source: "LinkedIn",
    stage: "contacted",
    dealValue: 2400,
    score: 54,
    priority: "medium",
    scoreReason:
      "Priya engaged with your first message and asked a clarifying question, but hasn't confirmed budget or timeline yet.",
    scoreFactors: [
      { label: "Asked a clarifying question", weight: 18 },
      { label: "Engaged within 1 day", weight: 14 },
      { label: "No budget confirmed", weight: -6 },
      { label: "No response for 4 days", weight: 10 },
    ],
    lastContacted: daysAgo(4),
    nextFollowUp: daysAgo(0),
    assignedTo: "Sahil",
    notes: "Interested in a rebrand + content package, timing unclear.",
    conversation: [
      { id: "m1", direction: "outbound", channel: "email", date: daysAgo(6), body: "Saw your post about the rebrand — happy to share some ideas if useful." },
      { id: "m2", direction: "inbound", channel: "email", date: daysAgo(5), body: "Sure, what would a content package typically include?" },
      { id: "m3", direction: "outbound", channel: "email", date: daysAgo(4), body: "Sent a breakdown of what's included and rough pricing." },
    ],
    suggestedMessage:
      "Hi Priya, just following up on the content package breakdown — happy to tailor it if your scope or timeline has shifted.",
    automationTier: "off",
  },
  {
    id: "derek-osei",
    name: "Derek Osei",
    company: "Osei Property Group",
    email: "derek@oseiproperty.com",
    source: "Instagram DM",
    stage: "new",
    dealValue: 5200,
    score: 71,
    priority: "high",
    scoreReason:
      "Derek reached out directly asking for availability this month — a specific timing question usually signals real intent.",
    scoreFactors: [
      { label: "Asked about availability", weight: 22 },
      { label: "Direct outreach (warm)", weight: 16 },
      { label: "No response sent yet", weight: 20 },
      { label: "New, unqualified", weight: -5 },
    ],
    lastContacted: daysAgo(1),
    nextFollowUp: daysAgo(0),
    assignedTo: "Sahil",
    notes: "Found LUMIS through Instagram. Wants twilight photography for a listing.",
    conversation: [
      { id: "m1", direction: "inbound", channel: "text", date: daysAgo(1), body: "Hey! Do you have any availability for twilight shots this month? Listing goes live in 2 weeks." },
    ],
    suggestedMessage:
      "Hi Derek, thanks for reaching out! I do have twilight slots open this month — what date is the listing going live so I can plan around golden hour?",
    automationTier: "off",
  },
  {
    id: "amanda-cole",
    name: "Amanda Cole",
    company: "Cole & Partners",
    email: "amanda@colepartners.ca",
    source: "Cold outreach",
    stage: "contacted",
    dealValue: 900,
    score: 22,
    priority: "low",
    scoreReason:
      "Amanda hasn't opened your last two emails and there's no buying-intent language in the thread yet.",
    scoreFactors: [
      { label: "No emails opened", weight: -14 },
      { label: "No intent language", weight: -10 },
      { label: "Small deal value", weight: -6 },
      { label: "Still early in relationship", weight: 8 },
    ],
    lastContacted: daysAgo(11),
    nextFollowUp: daysFromNow(3),
    assignedTo: "Sahil",
    notes: "Low priority for now — revisit if she engages.",
    conversation: [
      { id: "m1", direction: "outbound", channel: "email", date: daysAgo(14), body: "Introduced LUMIS services." },
      { id: "m2", direction: "outbound", channel: "email", date: daysAgo(11), body: "Following up in case this got buried." },
    ],
    suggestedMessage: "Hi Amanda, no pressure at all — happy to reconnect whenever the timing's better on your end.",
    automationTier: "off",
  },
  {
    id: "grace-liu",
    name: "Grace Liu",
    company: "Liu Realty Group",
    email: "grace@liurealty.ca",
    phone: "(437) 555-0176",
    source: "Referral",
    stage: "won",
    dealValue: 4100,
    score: 100,
    priority: "none",
    scoreReason: "Deal closed — no follow-up needed. Great candidate for a testimonial.",
    scoreFactors: [{ label: "Deal won", weight: 100 }],
    lastContacted: daysAgo(2),
    nextFollowUp: null,
    assignedTo: "Sahil",
    notes: "Closed! Ask about a testimonial next week.",
    conversation: [
      { id: "m1", direction: "inbound", channel: "email", date: daysAgo(10), body: "We'd like to move forward with the full package." },
      { id: "m2", direction: "outbound", channel: "email", date: daysAgo(2), body: "Contract signed — excited to get started!" },
    ],
    suggestedMessage: "Hi Grace, thrilled to be working together! Once we wrap the shoot, would you be open to a quick testimonial?",
    automationTier: "off",
  },
  {
    id: "victor-hall",
    name: "Victor Hall",
    company: "Hall Independent",
    email: "victor@hallindependent.com",
    source: "Website form",
    stage: "lost",
    dealValue: 1500,
    score: 5,
    priority: "none",
    scoreReason: "Victor went with another provider — safe to archive.",
    scoreFactors: [{ label: "Chose a competitor", weight: -100 }],
    lastContacted: daysAgo(20),
    nextFollowUp: null,
    assignedTo: "Sahil",
    notes: "Went with a cheaper local option. Revisit in 6 months.",
    conversation: [
      { id: "m1", direction: "inbound", channel: "email", date: daysAgo(25), body: "Looking for quotes on listing photography." },
      { id: "m2", direction: "inbound", channel: "email", date: daysAgo(20), body: "Going to go with another company this time, thanks anyway." },
    ],
    suggestedMessage: "Totally understand, Victor — wishing you the best with the listing. I'll check back in a few months in case timing works better.",
    automationTier: "off",
  },
  {
    id: "natalie-brooks",
    name: "Natalie Brooks",
    company: "Brooks & Co Interiors",
    email: "natalie@brooksinteriors.ca",
    source: "Instagram DM",
    stage: "qualified",
    dealValue: 2800,
    score: 76,
    priority: "high",
    scoreReason:
      "Natalie asked for your availability calendar and mentioned a launch date — strong scheduling intent.",
    scoreFactors: [
      { label: "Requested availability calendar", weight: 24 },
      { label: "Mentioned a firm launch date", weight: 20 },
      { label: "No response for 4 days", weight: 16 },
      { label: "Warm inbound channel", weight: 10 },
    ],
    lastContacted: daysAgo(4),
    nextFollowUp: daysAgo(0),
    assignedTo: "Sahil",
    notes: "Interior design showcase, wants video + photo bundle.",
    conversation: [
      { id: "m1", direction: "inbound", channel: "text", date: daysAgo(6), body: "Love your reel work — do you do interiors too?" },
      { id: "m2", direction: "outbound", channel: "text", date: daysAgo(5), body: "Yes! Would love to see the space. What's the timeline?" },
      { id: "m3", direction: "inbound", channel: "text", date: daysAgo(4), body: "Launching the showroom in 3 weeks — can you send your availability calendar?" },
    ],
    suggestedMessage:
      "Hi Natalie, sending over my availability now — with a 3-week launch, I'd suggest locking in a date this week to leave room for edits.",
    automationTier: "off",
  },
  {
    id: "ray-thompson",
    name: "Ray Thompson",
    company: "Thompson Builders",
    email: "ray@thompsonbuilders.ca",
    phone: "(289) 555-0133",
    source: "Referral",
    stage: "proposal",
    dealValue: 6300,
    score: 88,
    priority: "high",
    scoreReason:
      "Ray opened your proposal three times in two days and asked about payment terms — usually a sign he's ready to sign.",
    scoreFactors: [
      { label: "Opened proposal 3x", weight: 26 },
      { label: "Asked about payment terms", weight: 24 },
      { label: "Large deal value", weight: 18 },
      { label: "No response for 6 days", weight: 14 },
    ],
    lastContacted: daysAgo(6),
    nextFollowUp: daysAgo(0),
    assignedTo: "Sahil",
    notes: "New-build marketing package for 4 model homes.",
    conversation: [
      { id: "m1", direction: "inbound", channel: "email", date: daysAgo(10), body: "Need full marketing coverage for 4 model homes launching this fall." },
      { id: "m2", direction: "outbound", channel: "email", date: daysAgo(8), body: "Sent a proposal covering all 4 homes plus a launch video.", opened: true },
      { id: "m3", direction: "inbound", channel: "email", date: daysAgo(6), body: "What are your payment terms for a package this size?", opened: true },
    ],
    suggestedMessage:
      "Hi Ray, happy to work with a 50/50 split or milestone-based payments on a package this size — whichever's easier on your end. Want me to send an updated contract?",
    automationTier: "off",
  },
  {
    id: "elena-vasquez",
    name: "Elena Vasquez",
    company: "Vasquez Realty",
    email: "elena@vasquezrealty.ca",
    source: "Website form",
    stage: "new",
    dealValue: 1800,
    score: 40,
    priority: "medium",
    scoreReason: "Elena filled out the contact form but hasn't been reached yet — first outreach is overdue.",
    scoreFactors: [
      { label: "Form submitted, no reply sent", weight: 20 },
      { label: "No engagement history yet", weight: -5 },
      { label: "2 days since submission", weight: 12 },
    ],
    lastContacted: daysAgo(2),
    nextFollowUp: daysAgo(0),
    assignedTo: "Sahil",
    notes: "New inbound, needs first response.",
    conversation: [
      { id: "m1", direction: "inbound", channel: "email", date: daysAgo(2), body: "Interested in listing photography for a condo launch, please reach out." },
    ],
    suggestedMessage: "Hi Elena, thanks for reaching out about the condo launch — happy to share packages and availability. When's your ideal shoot date?",
    automationTier: "off",
  },
  {
    id: "tom-reilly",
    name: "Tom Reilly",
    company: "Reilly & Sons",
    email: "tom@reillyandsons.ca",
    source: "Referral",
    stage: "contacted",
    dealValue: 1100,
    score: 31,
    priority: "low",
    scoreReason: "Tom replied once but conversation has gone quiet for over a week with no clear next step.",
    scoreFactors: [
      { label: "Replied once", weight: 10 },
      { label: "No response for 9 days", weight: 14 },
      { label: "No intent language", weight: -8 },
    ],
    lastContacted: daysAgo(9),
    nextFollowUp: daysFromNow(2),
    assignedTo: "Sahil",
    notes: "Slow mover, keep warm but not urgent.",
    conversation: [
      { id: "m1", direction: "outbound", channel: "email", date: daysAgo(12), body: "Introduced services after referral from Ray." },
      { id: "m2", direction: "inbound", channel: "email", date: daysAgo(9), body: "Thanks, might need something in the new year." },
    ],
    suggestedMessage: "Hi Tom, just keeping the door open — happy to pick this back up whenever the new year planning starts.",
    automationTier: "off",
  },
];

export const team: TeamMember[] = [
  { id: "sahil", name: "Sahil", role: "Admin", assignedLeads: leads.length, followUpsCompleted: 8, overdueFollowUps: 2, dealsWon: 1, revenueGenerated: 4100 },
];

export const weeklyReport: WeeklyReport = {
  conversationsAnalyzed: 23,
  followUpsSent: 8,
  repliesReceived: 3,
  dealsClosed: 1,
  revenueGenerated: 4100,
  insight:
    "Your response rate is highest when you follow up within 48 hours. You currently have 4 high-intent leads that haven't been contacted this week.",
};

// ---- Derived helpers ----

export function getLeadById(id: string): Lead | undefined {
  return leads.find((l) => l.id === id);
}

export function isDueToday(lead: Lead): boolean {
  if (!lead.nextFollowUp) return false;
  const today = new Date();
  const due = new Date(lead.nextFollowUp);
  return due.toDateString() === today.toDateString();
}

export function getTodaysFollowUps(): Lead[] {
  return leads
    .filter((l) => isDueToday(l) && l.stage !== "won" && l.stage !== "lost")
    .sort((a, b) => b.score - a.score);
}

export function getColdLeads(): Lead[] {
  const cutoff = 7;
  return leads.filter((l) => {
    if (l.stage === "won" || l.stage === "lost") return false;
    const days = Math.floor((Date.now() - new Date(l.lastContacted).getTime()) / 86400000);
    return days >= cutoff;
  });
}

export function getStats() {
  const active = leads.filter((l) => l.stage !== "won" && l.stage !== "lost");
  const hot = active.filter((l) => l.priority === "high");
  const potentialRevenue = active.reduce((sum, l) => sum + l.dealValue, 0);
  return {
    totalLeads: leads.length,
    hotLeads: hot.length,
    followUpsToday: getTodaysFollowUps().length,
    potentialRevenue,
  };
}

export const PIPELINE_STAGES: { id: Lead["stage"]; label: string }[] = [
  { id: "new", label: "New Lead" },
  { id: "contacted", label: "Contacted" },
  { id: "qualified", label: "Qualified" },
  { id: "proposal", label: "Proposal Sent" },
  { id: "negotiation", label: "Negotiation" },
  { id: "won", label: "Won" },
  { id: "lost", label: "Lost" },
];

export function getPipelineData() {
  return PIPELINE_STAGES.map((stage) => {
    const stageLeads = leads.filter((l) => l.stage === stage.id);
    return {
      ...stage,
      leads: stageLeads,
      value: stageLeads.reduce((sum, l) => sum + l.dealValue, 0),
    };
  });
}

export function daysSince(dateIso: string): number {
  return Math.floor((Date.now() - new Date(dateIso).getTime()) / 86400000);
}

export function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export function formatDate(dateIso: string): string {
  return new Date(dateIso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
