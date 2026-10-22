/**
 * What FollowUp may do, and who has to allow it (milestone 1 of the founder's assistant brief, 2026-10-22: parts 10,
 * 15 and 19, "execute only authorized operations", "critical actions must not become unrestricted simply because
 * autonomy mode changes").
 *
 * This is the written list, not a new gate: it describes what the code already does, so the next-best-action engine
 * (milestone 4) and "why did you do that?" (milestone 3) read their permissions from one place, and the tests in
 * src/lib/__tests__/actionPolicy.test.ts fail if the list and the code drift apart. Nothing here sends anything.
 *
 * The brief's three ways of working, in the app's own switches:
 * - Draft only: every reply waits for the owner (`Business.holdAllForApproval`, the default for every account, A-070;
 *   the app calls this "Assisted"). Pause all sending (A-041) puts an account back here.
 * - Assisted automation: the owner turned that off, so replies that pass every check go by themselves; anything a
 *   check flags waits (src/lib/holdReasons.ts).
 * - Controlled autonomy: the owner also allowed Auto (`Business.autonomousAllowed`, A-070), which they then choose
 *   per customer; read through isAutonomousAllowed (src/lib/autonomousPermission.ts).
 */

export type OperatingMode = "draft_only" | "assisted_automation" | "controlled_autonomy";

export const OPERATING_MODES: readonly OperatingMode[] = ["draft_only", "assisted_automation", "controlled_autonomy"];

/** Which way of working an account is in, from its own switches. Holding every reply wins over everything else. */
export function operatingModeOf(business: { holdAllForApproval: boolean; autonomousAllowed: boolean }): OperatingMode {
  if (business.holdAllForApproval) return "draft_only";
  return business.autonomousAllowed ? "controlled_autonomy" : "assisted_automation";
}

/** The brief's next actions (part 10). */
export const ASSISTANT_ACTIONS = [
  "ANSWER_QUESTION",
  "ASK_RELEVANT_QUESTION",
  "PROVIDE_INFORMATION",
  "CLARIFY_REQUIREMENTS",
  "HANDLE_OBJECTION",
  "OFFER_APPOINTMENT",
  "CHECK_AVAILABILITY",
  "CONFIRM_BOOKING",
  "CREATE_BOOKING",
  "SCHEDULE_FOLLOWUP",
  "NOTIFY_OWNER",
  "ESCALATE_TO_HUMAN",
  "WAIT_FOR_CUSTOMER",
  "STOP_AUTOMATION",
] as const;
export type AssistantAction = (typeof ASSISTANT_ACTIONS)[number];

/**
 * "alone": FollowUp may do it by itself, and every check below still applies (a reply a check flags waits).
 * "owner_ok": it waits for the owner's OK, every time.
 */
export type Permission = "alone" | "owner_ok";

export type ActionRule = {
  /** Does the customer see it? Anything a customer sees goes through every guard in ALWAYS_CHECKED. */
  customerSees: boolean;
  /** Where the app does this today, or null where it doesn't yet (the plan says which milestone). */
  today: string | null;
  permission: Record<OperatingMode, Permission>;
};

const MESSAGE: Record<OperatingMode, Permission> = { draft_only: "owner_ok", assisted_automation: "alone", controlled_autonomy: "alone" };
const OWNER_EVERY_TIME: Record<OperatingMode, Permission> = { draft_only: "owner_ok", assisted_automation: "owner_ok", controlled_autonomy: "owner_ok" };
const INTERNAL: Record<OperatingMode, Permission> = { draft_only: "alone", assisted_automation: "alone", controlled_autonomy: "alone" };

export const ACTION_POLICY: Record<AssistantAction, ActionRule> = {
  ANSWER_QUESTION: { customerSees: true, today: "the reply writer (src/lib/scoring.ts), sent by src/lib/sending.ts", permission: MESSAGE },
  ASK_RELEVANT_QUESTION: { customerSees: true, today: "the reply writer's question plan (src/lib/qualification.ts, Business.askPlan)", permission: MESSAGE },
  PROVIDE_INFORMATION: { customerSees: true, today: "the reply writer, with the owner's approved facts only (src/lib/businessFacts.ts)", permission: MESSAGE },
  CLARIFY_REQUIREMENTS: { customerSees: true, today: "the reply writer", permission: MESSAGE },
  HANDLE_OBJECTION: { customerSees: true, today: "the reply writer's general guidance (no objection memory yet: milestone 4)", permission: MESSAGE },
  // A reply carrying the owner's booking link always waits for the owner (A-263, src/lib/automation.ts).
  OFFER_APPOINTMENT: { customerSees: true, today: "a reply with the booking link, held for the owner (A-263)", permission: OWNER_EVERY_TIME },
  // Reading the owner's calendar changes nothing and tells the customer nothing by itself.
  CHECK_AVAILABILITY: { customerSees: false, today: "the booking page's free times (getAvailableSlots, src/lib/booking.ts)", permission: INTERNAL },
  // FollowUp never books on its own: the customer books on the link, and booking inside the chat (A-242 stage 2,
  // milestone 5) has the owner confirm. Never claimed from model text, only from a Booking row.
  CONFIRM_BOOKING: { customerSees: true, today: null, permission: OWNER_EVERY_TIME },
  CREATE_BOOKING: { customerSees: true, today: "only the customer, on the booking link (createBooking, src/lib/booking.ts)", permission: OWNER_EVERY_TIME },
  SCHEDULE_FOLLOWUP: { customerSees: true, today: "the follow-up plans (src/lib/automation.ts, src/lib/followUpPlans.ts)", permission: MESSAGE },
  NOTIFY_OWNER: { customerSees: false, today: "Ready and before-the-call alerts (src/lib/ownerAlerts.ts)", permission: INTERNAL },
  ESCALATE_TO_HUMAN: { customerSees: false, today: "a held reply with its reason on Today (src/lib/holdReasons.ts)", permission: INTERNAL },
  WAIT_FOR_CUSTOMER: { customerSees: false, today: "nothing is sent", permission: INTERNAL },
  // Stopping is never blocked, in any mode: STOP, a no, an agent, a booking, the owner's switch.
  STOP_AUTOMATION: { customerSees: false, today: "opt-out, said no, has an agent, booked (src/lib/automation.ts)", permission: INTERNAL },
};

/** Does this action wait for the owner in this way of working? */
export function needsOwner(action: AssistantAction, mode: OperatingMode): boolean {
  return ACTION_POLICY[action].permission[mode] === "owner_ok";
}

/**
 * The checks no way of working relaxes: every message a customer sees, in every mode, Auto included. Each names the
 * code that enforces it today.
 */
export const ALWAYS_CHECKED = [
  { id: "opt_out", what: "They said STOP: nothing more on any channel.", where: "src/lib/sending.ts (Lead.optedOutAt), src/lib/suppression.ts" },
  { id: "never_twice", what: "The same message never goes to the same customer twice.", where: "src/lib/sendClaim.ts (SendClaim)" },
  { id: "send_caps", what: "A daily ceiling on what FollowUp sends by itself, so a fault can never flood anyone.", where: "src/lib/sendCaps.ts" },
  { id: "real_person", what: "\"Am I talking to a real person?\" is always the owner's to answer.", where: "A-098, src/lib/scoring.ts" },
  { id: "pause", what: "Pause all sending stops everything FollowUp would send by itself, at once.", where: "src/lib/sendingControl.ts" },
] as const;

/**
 * Every place FollowUp sends a message by itself (a call to sendFollowUpToLead marked automated). Each obeys the
 * owner's "ask me before every message" (holdAllForApproval), except a reactivation batch, which runs only after the
 * owner approved that list on its own screen, re-checking each person at send time. A new automatic sender has to be added here, or the test fails.
 */
export const AUTOMATIC_SENDERS: readonly { file: string; what: string; ownerApprovedBatch?: true }[] = [
  { file: "src/lib/automation.ts", what: "follow-up plans, the unanswered rule, stay in touch, their moment" },
  { file: "src/lib/acknowledge.ts", what: "the instant first reply" },
  { file: "src/lib/holdingMessage.ts", what: "the holding message while the owner hasn't answered" },
  { file: "src/lib/sequences.ts", what: "the owner's own workflows" },
  { file: "src/lib/sending.ts", what: "a retry of a send that failed, re-checked from the top" },
  { file: "src/lib/reactivationSend.ts", what: "bringing back old customers, a batch the owner approved", ownerApprovedBatch: true },
];
