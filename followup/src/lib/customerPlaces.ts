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

/**
 * Customers' groups (A-220): Needs you, Ready to book, Booked, Going quiet,
 * Waiting on them. Same rule as above, one group each. Who wins: a customer
 * waiting for the owner's OK is in Needs you even when they are also ready
 * to book; someone ready to book with a viewing already in the calendar is
 * Booked; going quiet beats waiting, as before.
 */
export type CustomerGroups = CustomerPlaces & { ready: string[]; booked: string[] };

export function customerGroups(g: {
  needs: Iterable<string>;
  ready: string[];
  booked: string[];
  quiet: string[];
  waiting: string[];
}): CustomerGroups {
  const taken = new Set<string>();
  const take = (ids: Iterable<string>) => {
    const out: string[] = [];
    for (const id of ids) {
      if (taken.has(id)) continue;
      taken.add(id);
      out.push(id);
    }
    return out;
  };
  const needs = take(g.needs);
  // Booked before ready, so a booked customer never shows a Call button for a call already made.
  const booked = take(g.booked);
  const ready = take(g.ready);
  const quiet = take(g.quiet);
  const waiting = take(g.waiting);
  return { needs, ready, booked, quiet, waiting };
}
