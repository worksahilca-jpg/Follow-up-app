# Meta OAuth setup — one-click Instagram + Facebook connect

Without this, Settings still works: a business pastes an access token by hand
(`InstagramConfig.tsx` / `FacebookConfig.tsx` fall back automatically when
these env vars aren't set). This is the one-time console setup to turn on the
"Connect with Instagram" / "Connect with Facebook" buttons instead.

Both live under the same Meta Developer App ("FollowUp") already used for the
Instagram/Facebook webhook (see `src/lib/instagram.ts`'s doc comment for the
App ID), but they are **two separate products with two separate credential
pairs** — don't mix them up.

## 1. Instagram API with Instagram Login

In the app dashboard: **Instagram → API setup with Instagram Login**.

1. Add a redirect URI: `https://followupbase.io/api/instagram/oauth/callback`
   (and `http://localhost:3000/api/instagram/oauth/callback` for local dev,
   if you ever run this outside Vercel).
2. Under "Generate access tokens" / app settings for this product, copy the
   **Instagram app ID** and **Instagram app secret** — these are distinct
   from the main Facebook App ID/Secret shown elsewhere in the dashboard.
3. Add these to Vercel (Production), project `follow-up-app`:
   - `INSTAGRAM_APP_ID` = the Instagram app ID
   - `INSTAGRAM_APP_SECRET` = the Instagram app secret (this is the SAME
     value already used to verify webhook signatures — no new webhook setup
     needed).
4. Permissions requested by the OAuth flow: `instagram_business_basic`,
   `instagram_business_manage_messages`. For a real business's own account
   (added as a tester — up to 25 without App Review) this works immediately;
   for the general public it needs Meta App Review.

## 2. Facebook Login for Business

In the app dashboard: **Facebook Login for Business** (add the product if not
already present) → Settings.

1. Add a redirect URI: `https://followupbase.io/api/facebook/oauth/callback`
   (and the localhost equivalent for local dev).
2. Copy the app's own **App ID** and **App Secret** (Settings → Basic).
3. Add to Vercel (Production):
   - `FACEBOOK_APP_ID`
   - `FACEBOOK_APP_SECRET`
4. Permissions requested: `pages_show_list`, `pages_messaging`,
   `pages_manage_metadata`, `pages_read_engagement`, `leads_retrieval`. Up to
   25 testers (added under App Roles → Roles, as a Tester or Admin on the
   app — they must accept the invite) can connect their own Page without
   App Review; beyond that, submit for review with a screencast showing a
   Page owner connecting and a lead's message becoming a FollowUp lead.

## After setting the env vars

Redeploy. `GET /api/instagram/config` and `GET /api/facebook/config` both
report `oauthAvailable: true` once their pair is set, which is what makes
Settings show the one-click button instead of only the manual-paste field.

## What this does NOT change

- The webhook itself (`src/app/api/instagram/webhook/route.ts`) is unchanged
  — OAuth only replaces how a business's own token gets into
  `Business.instagramAccessToken` / `facebookPageAccessToken`.
- The manual paste-a-token path stays working forever, for a Meta reviewer or
  a business whose token came from elsewhere.
- Instagram Login tokens last 60 days and are refreshable
  (`https://graph.instagram.com/refresh_access_token`) — not yet automated;
  today a business reconnects when Instagram capture silently stops working.
  A refresh cron is a reasonable follow-up once real usage shows this matters.
