/**
 * Keeps every connected Instagram account's token alive.
 *
 * An Instagram Login token lasts 60 days, and nothing renewed it
 * (docs/meta-oauth-setup.md said so: "not yet automated"). The accounts
 * connected from 2026-09-19 would have stopped capturing DMs somewhere
 * between 18 and 26 November, silently, a few weeks after launch
 * (open-items check, 2026-09-28).
 *
 * Meta renews a token that is at least 24 hours old and not yet expired,
 * for another 60 days, at graph.instagram.com/refresh_access_token with
 * grant_type=ig_refresh_token. Run daily, a token is never more than a day
 * past its last renewal, so one or two missed runs cost nothing. A token
 * under a day old is refused; that is expected and is not an error.
 *
 * The long-lived exchange at connect time needed POST where Meta's docs
 * say GET (instagram.ts, exchangeInstagramAuthCode). The same two methods
 * are tried here, in the same order, for the same reason.
 *
 * A token Meta refuses outright (expired, revoked, or a pasted token of
 * another kind) is left exactly as it is. The Instagram card already says
 * when an account stops receiving; overwriting or clearing the token here
 * would only hide why.
 */
import { prisma } from "@/lib/db";
import { mapWithConcurrency } from "@/lib/concurrency";

const REFRESH_URL = "https://graph.instagram.com/refresh_access_token";

type RefreshOutcome = { ok: true; token: string } | { ok: false; reason: string };

async function metaReason(res: Response): Promise<string> {
  const body = await res.json().catch(() => null);
  const err = body?.error;
  if (err && typeof err.message === "string") return `${err.message}${err.code ? ` [${err.code}]` : ""}`.slice(0, 200);
  return `HTTP ${res.status}`;
}

export async function refreshInstagramToken(token: string): Promise<RefreshOutcome> {
  const params = new URLSearchParams({ grant_type: "ig_refresh_token", access_token: token });
  const attempts: Array<{ url: string; init?: RequestInit }> = [
    { url: `${REFRESH_URL}?${params}` },
    {
      url: REFRESH_URL,
      init: { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: params },
    },
  ];
  const reasons: string[] = [];
  for (const attempt of attempts) {
    let res: Response;
    try {
      // Bounded: this shares a 60-second daily job with the setup check.
      res = await fetch(attempt.url, { ...attempt.init, signal: AbortSignal.timeout(10_000) });
    } catch (err) {
      reasons.push(err instanceof Error ? err.message : "network error");
      continue;
    }
    if (res.ok) {
      const body = await res.json().catch(() => ({}));
      if (typeof body?.access_token === "string" && body.access_token) return { ok: true, token: body.access_token };
      reasons.push("200 but no access_token");
      continue;
    }
    reasons.push(await metaReason(res));
  }
  // Never the token: only Meta's own words, which do not contain it.
  return { ok: false, reason: reasons.join("; ") };
}

export async function refreshAllInstagramTokens(): Promise<{ checked: number; refreshed: number; refused: number }> {
  const businesses = await prisma.business.findMany({
    where: { instagramUserId: { not: null }, instagramAccessToken: { not: null } },
    select: { id: true, instagramUserId: true, instagramAccessToken: true },
  });
  let refreshed = 0;
  let refused = 0;
  await mapWithConcurrency(businesses, 4, async (b) => {
    if (!b.instagramAccessToken) return;
    const outcome = await refreshInstagramToken(b.instagramAccessToken);
    if (!outcome.ok) {
      refused += 1;
      console.warn(`Instagram token not renewed for business ${b.id}: ${outcome.reason}`);
      return;
    }
    // Only onto the same account. An owner who disconnected, or connected
    // a different account, while this ran keeps what they did.
    const { count } = await prisma.business.updateMany({
      where: { id: b.id, instagramUserId: b.instagramUserId },
      data: { instagramAccessToken: outcome.token },
    });
    if (count > 0) refreshed += 1;
  });
  return { checked: businesses.length, refreshed, refused };
}
