"use client";

import { signIn } from "next-auth/react";

/**
 * Recognizes the server's "step up first" response (requireRecentAuth() in
 * src/lib/reauth.ts) and, if this is one, kicks off a fresh Google sign-in
 * — `prompt: "login"` forces Google's own login screen even if the
 * browser still has an active Google session, which is the only real
 * re-authentication this app can ask for (Google sign-in is the only
 * credential there is — no password to re-prompt for). Returns true if it
 * handled this response; callers should stop and let the redirect happen
 * rather than showing their own error. The user lands back on the same
 * page and can just retry the action.
 */
export async function handleReauthRequired(res: Response, data: { code?: string }): Promise<boolean> {
  if (res.status !== 401 || data.code !== "REAUTH_REQUIRED") return false;
  await signIn("google", { callbackUrl: window.location.href }, { prompt: "login" });
  return true;
}
