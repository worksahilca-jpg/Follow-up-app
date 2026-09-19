import type { AutomationStatus } from "@/lib/automationStatus";

export type PipelineStage =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type Priority = "high" | "medium" | "low" | "none";

// off — every draft needs manual approval.
// assisted — automated sends allowed, but each draft is risk-checked first;
//   anything not low-risk is held for manual approval instead.
// autonomous — risk check skipped; this lead's cadence is fully AI-owned.
export type AutomationTier = "off" | "assisted" | "autonomous";

export type MessageDirection = "inbound" | "outbound";

export interface Message {
  id: string;
  direction: MessageDirection;
  channel: "email" | "call" | "text" | "whatsapp" | "instagram" | "messenger" | "web";
  body: string;
  date: string; // ISO date
  opened?: boolean;
  // Set only when this outbound message wasn't sent through FollowUp —
  // e.g. "instagram_direct"/"messenger_direct" for a reply captured from
  // a Meta webhook echo (see Message.source in schema.prisma). Undefined
  // means FollowUp sent it, same as before this field existed.
  source?: string;
  // What FollowUp sent an outbound message under (instant_ack | unanswered
  // | silence | sequence | manual) — see Message.trigger in schema.prisma.
  // Undefined on inbound, on anything FollowUp didn't send, and on rows
  // from before the column existed that the backfill couldn't match.
  trigger?: string;
  // Set on an inbound Instagram/Messenger message that was a tap on one of
  // FollowUp's reply buttons — see Message.quickReplyPayload in
  // schema.prisma and src/lib/quickReplies.ts. Undefined for anything typed.
  quickReplyPayload?: string;
  // Twilio's verdict on an outbound text/WhatsApp send (queued | sent |
  // delivered | undelivered | failed) — see Message.deliveryStatus in
  // schema.prisma. Undefined when the channel doesn't report one. The
  // rescue score reads it so a number that bounces is not mistaken for a
  // customer who went quiet (accuracy research 2026-09-13, finding 1).
  deliveryStatus?: string;
}

export interface ScoreFactor {
  label: string;
  weight: number; // contribution, can be negative
}

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string;
  phone?: string;
  source: string;
  stage: PipelineStage;
  dealValue: number;
  score: number; // 0-100
  scoreReason: string;
  // Has FollowUp actually scored this lead? `scoreReason` cannot answer
  // that: it always holds a sentence, because an unscored lead is given a
  // placeholder one to render. Both call sites of PriorityPill were
  // passing `Boolean(lead.scoreReason)`, which is therefore always true,
  // so its "Not reviewed yet" state had never once rendered and every
  // unlooked-at lead showed "No action needed" — a verdict, on a lead
  // nothing had judged. That pill's own comment names this as "the exact
  // failure this product exists to prevent" (2026-09-19).
  reviewed: boolean;
  /**
   * What FollowUp read this lead's latest message as — language, script
   * and how formally they wrote (src/lib/leadLanguage.ts). Null when no
   * message has been read yet, which the UI says plainly rather than
   * guessing "English".
   */
  languageRead: { language: string; script: string; register: string } | null;
  /** When that reading was taken. Null whenever languageRead is. */
  languageReadAt: string | null;
  scoreFactors: ScoreFactor[];
  priority: Priority;
  lastContacted: string; // ISO date
  nextFollowUp: string | null; // ISO date
  assignedTo: string; // team member name, or "Unassigned"
  assignedToId?: string | null;
  notes: string;
  conversation: Message[];
  suggestedMessage: string;
  suggestedSubject?: string;
  automationTier: AutomationTier;
  // TCPA/CTIA opt-out (see Lead.optedOutAt in schema.prisma) — set the
  // moment a lead texts STOP on SMS/WhatsApp, cleared on START. Optional
  // (not present on demo-data.ts's static leads) since it's undefined,
  // never a lie, for a lead that was never opted out.
  optedOutAt?: string | null;
  // What FollowUp is actually doing with this lead right now (see
  // src/lib/automationStatus.ts) — computed server-side in leads-data.ts,
  // not present on demo-data.ts's static leads (no real automation runs
  // behind those) or anywhere else a Lead is built without a live business
  // to compute it against. Undefined means "not computed," never a claim
  // about the lead's actual state — components must treat it the same as
  // any other absent optional field, not render a default status for it.
  automationStatus?: AutomationStatus;
}

export interface TeamMember {
  id: string;
  name: string;
  role: "Admin" | "Sales";
  assignedLeads: number;
  followUpsCompleted: number;
  overdueFollowUps: number;
  dealsWon: number;
  revenueGenerated: number;
}

export interface WeeklyReport {
  conversationsAnalyzed: number;
  followUpsSent: number;
  repliesReceived: number;
  dealsClosed: number;
  revenueGenerated: number;
  insight: string;
}
