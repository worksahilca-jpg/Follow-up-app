/**
 * Shared shape of a Meta Graph send failure. Leaf module (no imports) so
 * src/lib/instagram.ts and src/lib/facebook.ts can both use it without
 * one depending on the other — tests mock each of those files wholesale.
 */

/**
 * What a Meta error looks like once it is worth keeping: Graph's own
 * `code` and `error_subcode` are what tell a closed 24-hour window
 * (10/2018278) from a dead token from a message tag the app isn't allowed
 * to use, and until now both senders threw them away and kept only the
 * prose (api-facts §D3). Logged verbatim on every non-2xx so the first
 * live run pins each one.
 */
export type MetaSendResult = {
  success: boolean;
  message?: string;
  status?: number;
  code?: number;
  subcode?: number;
};

/**
 * Meta's prose is written for the developer integrating the API. It
 * reached the owner instead.
 *
 * Found in production 2026-09-23, on the founder's own Instagram lead,
 * printed under the draft on the lead page:
 *
 *   "To use 'Human Agent', your use of this endpoint must be reviewed
 *    and approved by Facebook. To submit this 'Human Agent' feature for
 *    review please read our documentation on reviewable features:
 *    https://developers.facebook.com/docs/apps/review."
 *
 * Three things wrong with showing that to a business owner. It names an
 * endpoint and a review process that are the vendor's problem, not
 * theirs. It links them to developer documentation they cannot act on.
 * And it sits directly beneath the drafted reply, where it reads as part
 * of the message about to go out.
 *
 * `brand-principles.md`: every automated action must let the user answer
 * *what happened, why, what can I do* without asking support. Meta's
 * sentence answers none of the three for the person reading it.
 *
 * So the raw text stays in the server log, where the answer to "which
 * Meta rule fired" belongs, and the owner gets a sentence about their
 * own situation.
 *
 * Matched on the message text rather than a code table. The honest
 * reason: this is the one failure whose exact wording has been observed
 * from the live API, and inventing a mapping of Meta codes from memory
 * is how a wrong explanation gets shown confidently. Each further case
 * earns its branch the first time it is actually seen — the log line
 * below is what makes that possible.
 */
export function ownerFacingMetaError(message: string, fallback: string): string {
  if (/human[ _]agent/i.test(message)) {
    return (
      "This conversation is past Meta's 24-hour reply window. Sending now needs Meta's " +
      "approval for your app, which hasn't come through yet — so FollowUp can't send it " +
      "for you. You can still reply from Instagram directly."
    );
  }
  if (/outside of allowed window|outside the allowed window/i.test(message)) {
    return (
      "Meta's 24-hour reply window has closed for this conversation, so FollowUp can't send " +
      "this on its own. You can still reply from Instagram or Messenger yourself."
    );
  }
  // Anything unrecognised: say plainly that it was refused, and do not
  // repeat Meta's wording. A sentence the owner cannot act on is worse
  // than one that admits there is nothing to do but look at the channel.
  return fallback;
}

export async function readMetaError(res: Response, fallback: string, where: string): Promise<MetaSendResult> {
  const data = await res.json().catch(() => ({}));
  const error = data?.error ?? {};
  const raw = typeof error.message === "string" ? error.message : "";
  const code = typeof error.code === "number" ? error.code : undefined;
  const subcode = typeof error.error_subcode === "number" ? error.error_subcode : undefined;
  // Identifiers and codes only — never the message body, never the token.
  console.error(`${where} rejected a send: HTTP ${res.status}, code ${code ?? "?"}, subcode ${subcode ?? "?"}: ${raw}`);
  // Raw, deliberately. This is also the connect/subscribe path, where
  // "(#200) Requires pages_manage_metadata permission" names the exact
  // thing to go and fix and a generic sentence names nothing. Translation
  // to owner-facing prose happens at the SEND call sites, where the
  // reader is a business owner looking at a drafted message rather than
  // someone wiring up a channel.
  return { success: false, message: raw || fallback, status: res.status, code, subcode };
}
