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
  channel: "email" | "call" | "text";
  body: string;
  date: string; // ISO date
  opened?: boolean;
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
  // Why suggestedMessage is waiting on approval instead of having auto-sent
  // (assessSendRisk()'s reason) — null/absent when nothing's pending review
  // or automation hasn't held anything for this lead.
  suggestedMessageHoldReason?: string | null;
  automationTier: AutomationTier;
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
