/**
 * "Your rules" — the rules FollowUp is following for this business, as
 * plain sentences (design brain A-041, from the Mercury study: approval
 * rules a customer can actually read).
 *
 * Every sentence here is a claim about what the product does, so each one
 * is derived from the setting that makes it true and nothing is stated
 * that a setting could make false. Pure, no imports: Settings renders it
 * in the browser and the tests pin every branch.
 */
export type RulesState = {
  /** Business.holdAllForApproval */
  holdAll: boolean;
  /** Business.sendingPausedAt is set */
  paused: boolean;
  /** Business.autonomousAllowed — some customers may be set to Auto */
  autonomousAllowed: boolean;
  /** Business.onlyAdminsSend */
  onlyAdminsSend: boolean;
};

export function yourRules(s: RulesState): string[] {
  const rules: string[] = [];

  // What goes out by itself. Pause is a hold too, but the owner chose it
  // for now rather than for good, so it says so.
  if (s.paused) rules.push("Sending is paused. Every reply waits for your OK until you resume.");
  else if (s.holdAll) rules.push("Every reply waits for your OK.");
  else rules.push("Simple replies send by themselves. Everything else waits for your OK.");

  // Price. Auto skips the risk check (automation.ts), so on an account
  // where Auto is allowed the rule has an exception and says which. While
  // everything is held there is no exception to mention.
  if (s.autonomousAllowed && !s.holdAll && !s.paused) {
    rules.push("Anything about price waits for you, except for customers you've set to Auto.");
  } else {
    rules.push("Anything about price waits for you.");
  }

  rules.push("When a customer answers, check-ins stop.");
  rules.push("When you mark “We talked”, it stops until they write again.");
  rules.push(s.onlyAdminsSend ? "Only admins can send. Teammates write and edit." : "Anyone on your team can send.");
  return rules;
}
