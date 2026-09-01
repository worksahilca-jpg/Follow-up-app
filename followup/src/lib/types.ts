export type PipelineStage =
  | "new"
  | "contacted"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export type Priority = "high" | "medium" | "low" | "none";

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
  assignedTo: string; // team member name
  notes: string;
  conversation: Message[];
  suggestedMessage: string;
  automationEnabled: boolean;
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
