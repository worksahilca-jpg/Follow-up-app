/**
 * The Customers page's places (canvas App board): Needs you, Going quiet,
 * Waiting. Each customer is in at most one, in that order of precedence —
 * the same order the row's pill and the side panel already use.
 *
 * The inputs overlap on their own: someone FollowUp answered who has since
 * been silent for days is both "waiting on the customer" (getWaitingOn) and
 * at risk of being lost (getAtRiskLeads). Passed through as they were, that
 * customer was counted on two tabs and listed under one, so a tab's number
 * disagreed with the rows beneath it.
 */
export type CustomerPlaces = { needs: string[]; quiet: string[]; waiting: string[] };

export function customerPlaces(needs: Iterable<string>, quiet: string[], waiting: string[]): CustomerPlaces {
  const needIds = [...new Set(needs)];
  const taken = new Set(needIds);
  const quietIds = quiet.filter((id) => !taken.has(id));
  for (const id of quietIds) taken.add(id);
  const waitingIds = waiting.filter((id) => !taken.has(id));
  return { needs: needIds, quiet: quietIds, waiting: waitingIds };
}
