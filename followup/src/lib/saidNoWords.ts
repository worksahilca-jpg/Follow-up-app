import type { NoHow } from "@/lib/declinePhrases";

/**
 * What FollowUp says once a customer said no (A-326, drawn on the real app and approved 2026-10-25: "yes to both, build
 * it"). In words, never a dot (R-141): the Today row, the line under their reply, the way back, and the card at the top
 * of their page. A maybe-no says plainly that FollowUp isn't sure and stopped to be safe.
 */
export type SaidNoWords = { row: string; line: string; link: string; title: string; body: string };

export function saidNoWords(how: NoHow, first: string): SaidNoWords {
  const stopped = `If ${first} writes again, it shows up on Today.`;
  if (how === "unsure") {
    return {
      row: "Might be saying no. Check your reply.",
      line: `${first} might be saying no. To be safe, FollowUp stopped reminding them.`,
      link: "Not a no? Keep following up",
      title: `${first} might be saying no`,
      body: `To be safe, FollowUp stopped following up. ${stopped}`,
    };
  }
  if (how === "agent") {
    return {
      row: "Has an agent. Your last reply is ready.",
      line: `${first} already has an agent. After this reply, FollowUp won't remind them again.`,
      link: "Keep following up anyway",
      title: `${first} already has an agent`,
      body: `FollowUp stopped following up with ${first}. ${stopped}`,
    };
  }
  return {
    row: "Said no. Your last reply is ready.",
    line: `${first} said no. After this reply, FollowUp won't remind them again.`,
    link: "Keep following up anyway",
    title: `${first} said no`,
    body: `FollowUp stopped following up with ${first}. ${stopped}`,
  };
}
