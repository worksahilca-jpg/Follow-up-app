import { NextRequest, NextResponse } from "next/server";
import { getSessionContext, requireAdmin } from "@/lib/session";
import { ensureGmailWatch, exchangeCodeForTokens, GMAIL_SEND_SCOPE } from "@/lib/integrations/gmail";
import { recordAudit } from "@/lib/audit";
import { publicErrorMessage } from "@/lib/publicError";

// GET /api/integrations/gmail/callback — Google redirects here after the
// user approves (or denies) the consent screen. This URL must exactly match
// an "Authorized redirect URI" on the OAuth client in Google Cloud Console.
export async function GET(request: NextRequest) {
  const ctx = await getSessionContext();
  if (!ctx) return NextResponse.redirect(new URL("/signin", request.url));

  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const oauthError = searchParams.get("error");
  const state = searchParams.get("state");
  const expectedState = request.cookies.get("gmail_oauth_state")?.value;
  // Set in its own cookie by the connect route (see that file) — no longer
  // trusted from `state` itself, which is now a pure CSRF token actually
  // checked below (research/audit/2026-09-08-newer-surface-audit.md
  // finding #4).
  const next = request.cookies.get("gmail_oauth_next")?.value;
  const returnTo = new URL(next === "onboarding" ? "/onboarding" : "/settings", request.url);

  const fail = (message: string) => {
    returnTo.searchParams.set("gmail", "error");
    returnTo.searchParams.set("message", message);
    const res = NextResponse.redirect(returnTo);
    res.cookies.delete("gmail_oauth_state");
    res.cookies.delete("gmail_oauth_next");
    return res;
  };

  // The connect route gates on admin; this end of the flow did not, so a
  // member who set the state cookie themselves could complete a connection
  // the start route would have refused (audit 2026-09-16, auth M-1).
  if (!(await requireAdmin(ctx))) return fail("Only an admin can connect an inbox.");

  // Google sends a bare "access_denied" for two different things: the
  // owner pressed Cancel, or (in Testing mode) the address isn't on the
  // test-user list. This used to assume the second, so an owner who only
  // hesitated was told they weren't on the list and emailed to be added
  // to a list they were already on (first-run hunt 2026-09-25, §2.4).
  // Cover both, and say that a Cancel shared nothing.
  if (oauthError === "access_denied") {
    return fail(
      "Google didn't finish connecting. If you pressed Cancel, nothing was shared, so press Connect when you're ready. If Google said FollowUp is blocked or still in testing, your address isn't on the beta list yet: email contact@followupbase.io and we'll add it."
    );
  }
  if (oauthError) return fail(oauthError);
  if (!code) return fail("No authorization code returned by Google.");
  if (!state || !expectedState || state !== expectedState) return fail("That sign-in link expired — try connecting again.");

  let res: NextResponse;
  try {
    await exchangeCodeForTokens(code, ctx.userId);
    void recordAudit(ctx, "integration.gmail.connect");
    // Best-effort: push is an accelerator, the poll still works without it.
    await ensureGmailWatch(ctx.businessId).catch(() => null);
    // Google lists what the owner actually granted. Without "send", reading works and every
    // reply would fail later, so say it now, while the owner is here to press Connect again.
    const granted = searchParams.get("scope");
    if (granted && !granted.split(/[\s,]+/).includes(GMAIL_SEND_SCOPE)) {
      returnTo.searchParams.set("gmail", "error");
      returnTo.searchParams.set(
        "message",
        "Your Gmail is connected, but FollowUp isn't allowed to send from it, so your replies can't go out. Press Connect again and leave “Send email on your behalf” ticked on Google's screen."
      );
    } else {
      // Not the address itself: a URL lands in browser history and request logs (security review L4).
      returnTo.searchParams.set("gmail", "connected");
    }
    res = NextResponse.redirect(returnTo);
  } catch (err) {
    returnTo.searchParams.set("gmail", "error");
    returnTo.searchParams.set("message", publicErrorMessage(err, "Gmail connection failed.", "integrations/gmail/callback"));
    res = NextResponse.redirect(returnTo);
  }

  res.cookies.delete("gmail_oauth_state");
  res.cookies.delete("gmail_oauth_next");
  return res;
}
