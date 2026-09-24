import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/stripe";
import { activateInstagramWebhooks, exchangeInstagramAuthCode, resolveInstagramUserId } from "@/lib/instagram";
import { recordAudit } from "@/lib/audit";
import { oauthNextCookie, oauthReturnUrl } from "@/lib/oauthReturn";

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  // Back where the owner started. Settings by default — the Instagram
  // panel lives on the Channels tab, and Settings opens the tab the hash
  // names (SECTION_TAB in settings/page.tsx), so without the hash the
  // outcome was rendered on a tab the owner wasn't looking at. Or back to
  // onboarding, when Connect was pressed from the "where do your leads
  // come from?" step: landing in Settings mid-setup loses the flow.
  const next = request.cookies.get(oauthNextCookie("ig"))?.value;
  const settingsUrl = oauthReturnUrl(next, "social", appUrl());
  if (!ctx) return NextResponse.redirect(new URL("/signin", appUrl()));

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const oauthError = searchParams.get("error_description") ?? searchParams.get("error");
  const expectedState = request.cookies.get("ig_oauth_state")?.value;

  const fail = (message: string) => {
    settingsUrl.searchParams.set("instagram", "error");
    settingsUrl.searchParams.set("message", message);
    const res = NextResponse.redirect(settingsUrl);
    res.cookies.delete("ig_oauth_state");
    res.cookies.delete(oauthNextCookie("ig"));
    return res;
  };

  // The start route gates on admin; this end of the flow did not. A member
  // could set the ig_oauth_state cookie in their own devtools, open the
  // authorize URL with the public app id, and land here to overwrite the
  // business's Instagram connection with their own account (audit
  // 2026-09-16, Meta surface #2). Same shape as the Facebook callback.
  if (!(await requireAdmin(ctx))) return fail("Only an admin can connect Instagram.");

  if (oauthError) return fail(oauthError);
  if (!code) return fail("No authorization code returned by Instagram.");
  if (!state || !expectedState || state !== expectedState) return fail("That sign-in link expired — try connecting again.");

  const redirectUri = `${appUrl()}/api/instagram/oauth/callback`;
  const exchanged = await exchangeInstagramAuthCode(code, redirectUri);
  if ("error" in exchanged) return fail(exchanged.error);

  const resolved = await resolveInstagramUserId(exchanged.accessToken);
  // "Try again" was advice for a transient blip, and this has never once
  // been transient. Meta's reason rides through for the same purpose it
  // does on the exchange above: it is the only instrument anyone has here.
  if ("error" in resolved) return fail(`Instagram connected, but we couldn't read the account details — ${resolved.error}`);

  try {
    await prisma.business.update({
      where: { id: ctx.businessId },
      // Cleared here, set below only if Meta actually confirms —
      // otherwise a previous account's confirmation would carry over to
      // this one and Settings would claim a subscription nobody made.
      data: {
        instagramAccessToken: exchanged.accessToken,
        instagramUserId: resolved.id,
        instagramUsername: resolved.username ?? null,
        instagramWebhookSubscribedAt: null,
      },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return fail("That Instagram account is already connected to another FollowUp account.");
    }
    throw err;
  }
  // Without this Meta delivers no DM webhooks for the account (see
  // subscribeInstagramWebhooks). The connection is saved regardless; the
  // outcome is persisted as well as audited, so Settings can say the
  // account is connected but not receiving, and offer to try again.
  const subscribed = await activateInstagramWebhooks(ctx.businessId, resolved.id, exchanged.accessToken);
  void recordAudit(ctx, "integration.instagram.connect", {
    meta: { via: "oauth", webhookSubscribed: subscribed.ok, ...(subscribed.ok ? {} : { webhookError: subscribed.message }) },
  });

  settingsUrl.searchParams.set("instagram", "connected");
  const res = NextResponse.redirect(settingsUrl);
  res.cookies.delete("ig_oauth_state");
  res.cookies.delete(oauthNextCookie("ig"));
  return res;
}
