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
