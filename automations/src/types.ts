/**
 * The model, in one file.
 *
 * A Blueprint is an automation we know how to build (missed-call text-back,
 * review request, quote follow-up...). It is written once, by us.
 *
 * A ClientConfig is one business owner: their name, their numbers, their
 * wording, and which blueprints they bought with what settings.
 *
 * Engine + Blueprint + ClientConfig = "their own automation for their
 * business". We sell the third one as a custom project; we never rewrite the
 * first two.
 */

// ---------------------------------------------------------------------------
// Events — something happened at the client's business
// ---------------------------------------------------------------------------

/** Trigger keys are the webhook paths clients' systems post to. */
export type TriggerKey =
  | 'call.missed'
  | 'call.completed'
  | 'lead.created'
  | 'job.completed'
  | 'quote.sent'
  | 'quote.accepted'
  | 'appointment.booked'
  | 'appointment.no_show'
  | 'message.inbound'
  | 'manual';

/** A person the automation may contact. Phone/email are optional but at
 *  least one must be present or the run is skipped with a clear reason. */
export interface Contact {
  id?: string;
  name?: string;
  phone?: string;
  email?: string;
  locale?: string;
}

export interface AutomationEvent {
  /** Which client this happened at. */
  clientId: string;
  trigger: TriggerKey;
  /** Stable id from the source system; used to ignore duplicate deliveries. */
  externalId?: string;
  contact: Contact;
  /** Free-form payload from the source system, available to templates. */
  data: Record<string, unknown>;
  occurredAt: number;
}

// ---------------------------------------------------------------------------
// Steps — what an automation does
// ---------------------------------------------------------------------------

export interface SendSmsStep {
  type: 'send_sms';
  /** Template string, e.g. "Hi {{contact.firstName}}, sorry we missed you." */
  body: string;
  /** Optional named key so reports can say which message pulled the reply. */
  label?: string;
}

export interface SendEmailStep {
  type: 'send_email';
  subject: string;
  body: string;
  label?: string;
}

export interface WaitStep {
  type: 'wait';
  /** Minutes to wait before the next step. Resumed by the cron tick. */
  minutes: number;
}

/** Ask the model for a reply, then store it on the run for later steps.
 *  Never sends on its own — a send_sms/send_email step does that. */
export interface AiDraftStep {
  type: 'ai_draft';
  /** Where the draft lands: {{draft.<key>}} */
  key: string;
  prompt: string;
  maxWords?: number;
}

export interface HttpPostStep {
  type: 'http_post';
  /** Config key holding the URL, e.g. "crmWebhookUrl" — never a raw secret. */
  urlRef: string;
  bodyTemplate?: Record<string, string>;
  label?: string;
}

export interface NotifyOwnerStep {
  type: 'notify_owner';
  body: string;
}

/** Abandon the run when the condition is true. Used for "they already
 *  replied, stop chasing them" — the single most important rule in a
 *  follow-up sequence. */
export interface StopIfStep {
  type: 'stop_if';
  condition: Condition;
  reason: string;
}

export type Step =
  | SendSmsStep
  | SendEmailStep
  | WaitStep
  | AiDraftStep
  | HttpPostStep
  | NotifyOwnerStep
  | StopIfStep;

// ---------------------------------------------------------------------------
// Conditions
// ---------------------------------------------------------------------------

export type Condition =
  | { op: 'contact_replied' }
  | { op: 'always' }
  | { op: 'never' }
  | { op: 'equals'; path: string; value: unknown }
  | { op: 'exists'; path: string }
  | { op: 'not'; of: Condition }
  | { op: 'all'; of: Condition[] }
  | { op: 'any'; of: Condition[] };

// ---------------------------------------------------------------------------
// Blueprints — an automation we know how to build
// ---------------------------------------------------------------------------

export interface BlueprintSettingSpec {
  key: string;
  label: string;
  /** Shown in the delivery runbook so we ask the owner the right question. */
  ask: string;
  required: boolean;
  default?: unknown;
}

export interface Blueprint {
  id: string;
  /** How we describe it on the proposal. */
  name: string;
  /** The owner-facing promise, one sentence. */
  promise: string;
  trigger: TriggerKey;
  /** Settings this blueprint reads from the installed automation. */
  settings: BlueprintSettingSpec[];
  /** Build the steps for one event, using this client's settings. */
  build(ctx: BlueprintBuildContext): Step[];
}

export interface BlueprintBuildContext {
  client: ClientConfig;
  settings: Record<string, unknown>;
  event: AutomationEvent;
}

// ---------------------------------------------------------------------------
// Client configuration — the thing we write per sale
// ---------------------------------------------------------------------------

export interface BusinessHours {
  /** IANA zone, e.g. "America/Toronto". */
  timezone: string;
  /** Minutes from midnight. Outside this window, sends are held, not dropped. */
  startMinute: number;
  endMinute: number;
  /** 0 = Sunday. Days not listed are treated as closed. */
  days: number[];
}

export interface InstalledAutomation {
  /** Unique within the client, so the same blueprint can be installed twice. */
  id: string;
  blueprintId: string;
  enabled: boolean;
  settings: Record<string, unknown>;
}

export interface ClientConfig {
  id: string;
  /** Shown on every message and on their dashboard. */
  businessName: string;
  ownerName: string;
  /** Where "notify the owner" goes. */
  ownerPhone?: string;
  ownerEmail?: string;
  /** The number/address messages are sent from. */
  fromPhone?: string;
  fromEmail?: string;
  businessHours: BusinessHours;
  /** Global off switch. Flip this, not the individual automations, when an
   *  owner calls upset — it stops everything in one edit. */
  enabled: boolean;
  /** When true nothing is actually sent; runs are logged as they would have
   *  happened. This is how we demo to a prospect with their real data. */
  dryRun: boolean;
  /** Non-secret config referenced by urlRef, e.g. { crmWebhookUrl: "..." } */
  refs: Record<string, string>;
  /** Secrets are read from the environment by name, never stored here. */
  secretEnv: {
    twilioAccountSid?: string;
    twilioAuthToken?: string;
    openaiApiKey?: string;
    resendApiKey?: string;
  };
  automations: InstalledAutomation[];
  branding: {
    /** Signature appended to messages, e.g. "— Dave, Dave's Plumbing" */
    signature: string;
    /** Appended to the first SMS in any sequence. Legally load-bearing. */
    smsOptOutNotice: string;
  };
}

// ---------------------------------------------------------------------------
// Runs — the record of what the automation did
// ---------------------------------------------------------------------------

export type RunStatus = 'running' | 'waiting' | 'done' | 'stopped' | 'failed';

export interface RunAction {
  at: number;
  step: Step['type'];
  /** Which step in the run this came from — two SMS steps in one sequence
   *  are otherwise indistinguishable in the log. */
  stepIndex?: number;
  label?: string;
  /** What we sent, or would have sent in dry run. */
  detail: string;
  outcome: 'sent' | 'skipped' | 'failed' | 'simulated' | 'held';
  error?: string;
}

export interface Run {
  id: string;
  clientId: string;
  automationId: string;
  blueprintId: string;
  event: AutomationEvent;
  status: RunStatus;
  /** Index of the next step to execute. */
  cursor: number;
  steps: Step[];
  /** Set while status === 'waiting'. */
  resumeAt?: number;
  actions: RunAction[];
  drafts: Record<string, string>;
  stoppedReason?: string;
  createdAt: number;
  updatedAt: number;
}

/** Recorded when a contact replies, so sequences stop chasing them. */
export interface ReplyRecord {
  clientId: string;
  contactKey: string;
  at: number;
}

/** Recorded when a contact texts STOP. Hard block, forever. */
export interface OptOutRecord {
  clientId: string;
  contactKey: string;
  at: number;
}
