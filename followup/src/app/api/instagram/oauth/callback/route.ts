import { NextRequest, NextResponse } from "next/server";
import { getSessionContext } from "@/lib/session";
import { prisma } from "@/lib/db";
import { appUrl } from "@/lib/stripe";
import { exchangeInstagramAuthCode, resolveInstagramUserId } from "@/lib/instagram";
import { recordAudit } from "@/lib/audit";

export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  const settingsUrl = new URL("/settings", appUrl());
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
    return res;
  };

  if (oauthError) return fail(oauthError);
  if (!code) return fail("No authorization code returned by Instagram.");
  if (!state || !expectedState || state !== expectedState) return fail("That sign-in link expired — try connecting again.");

  const redirectUri = `${appUrl()}/api/instagram/oauth/callback`;
  const exchanged = await exchangeInstagramAuthCode(code, redirectUri);
  if ("error" in exchanged) return fail(exchanged.error);

  const resolved = await resolveInstagramUserId(exchanged.accessToken);
  if (!resolved) return fail("Instagram connected, but we couldn't read the account details — try again.");

  try {
    await prisma.business.update({
      where: { id: ctx.businessId },
      data: { instagramAccessToken: exchanged.accessToken, instagramUserId: resolved.id },
    });
  } catch (err) {
    if (err && typeof err === "object" && "code" in err && err.code === "P2002") {
      return fail("That Instagram account is already connected to another FollowUp account.");
    }
    throw err;
  }
  void recordAudit(ctx, "integration.instagram.connect", { meta: { via: "oauth" } });

  settingsUrl.searchParams.set("instagram", "connected");
  const res = NextResponse.redirect(settingsUrl);
  res.cookies.delete("ig_oauth_state");
  return res;
}
