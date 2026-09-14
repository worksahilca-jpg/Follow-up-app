import { BlueprintRegistry } from '../engine/registry.js';
import { appointmentReminder } from './appointment-reminder.js';
import { leadIntakeRouter } from './lead-intake-router.js';
import { missedCallTextBack } from './missed-call-textback.js';
import { noShowRebook } from './no-show-rebook.js';
import { quoteFollowUp } from './quote-followup.js';
import { reviewRequest } from './review-request.js';

/** The catalogue. Everything we know how to sell lives here; a client config
 *  can only reference these ids. */
export const CATALOGUE = [
  missedCallTextBack,
  leadIntakeRouter,
  quoteFollowUp,
  reviewRequest,
  noShowRebook,
  appointmentReminder,
];

export function defaultRegistry(): BlueprintRegistry {
  return new BlueprintRegistry(CATALOGUE);
}

export {
  appointmentReminder,
  leadIntakeRouter,
  missedCallTextBack,
  noShowRebook,
  quoteFollowUp,
  reviewRequest,
};
