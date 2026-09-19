# Meta OAuth setup — one-click Instagram, Facebook and WhatsApp connect

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

**If Settings shows "Instagram said: Error validating verification code…
redirect_uri…"** (first seen live 2026-09-19): the code sends one redirect
address at both ends of the flow, so this is a mismatch between that address
and what Meta has on file, or a wrong Instagram app secret. The settings line
prints the exact address sent. Check, in order:
1. Instagram → API setup with Instagram Login → Business login settings →
   *OAuth redirect URIs* holds that address character for character — same
   host (`followupbase.io`, no `www`), `https`, no trailing slash.
2. `INSTAGRAM_APP_SECRET` in Vercel is the **Instagram** app secret from that
   same page (next to the Instagram app ID), not the Facebook app secret from
   Settings → Basic. Re-paste and redeploy if unsure.
3. `NEXTAUTH_URL` in Vercel is `https://followupbase.io` — it is the base of
   the address the app sends.

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

## 3. WhatsApp — the owner's own number (Embedded Signup with Coexistence)

Since 2026-09-19 WhatsApp goes through Meta's Cloud API directly, on the number
that is already in the WhatsApp Business app on the owner's phone (Meta's
"Coexistence"). Twilio is not involved. Scope and what is still unverified:
`research/integrations/2026-09-19-whatsapp-coexistence.md`.

In the app dashboard (the console as it looked on 2026-09-19 — Meta moves
menus; if a label differs, take the closest match):

1. **Add WhatsApp as a use case**: Use cases → Add use cases → "Connect with
   customers through WhatsApp". It attaches to the FollowUp business
   portfolio on its own. Same App ID/App Secret as §2 — WhatsApp is a product
   of the main app, so `FACEBOOK_APP_ID` / `FACEBOOK_APP_SECRET` cover it,
   including webhook signatures. **Both must be set in Vercel** — they were
   not, until 2026-09-19.
2. **Production setup gate**: Use cases → Connect on WhatsApp → "Production
   setup" asks you to accept the WhatsApp Business Platform terms and gives
   the app a free test number. Accept; nothing else is reachable before it.
3. **Webhook**: under the same use case, Configuration → Callback URL
   `https://followupbase.io/api/whatsapp/webhook`, verify token the one shown
   in Settings → WhatsApp → "Meta console reference" (same token as Instagram).
   Subscribe to exactly `messages`, `smb_message_echoes`, `history`,
   `smb_app_state_sync` (not `message_echoes`, which is Messenger's).
4. **Embedded Signup configuration**: Facebook Login for Business →
   Configurations → **Create from template** → "WhatsApp Embedded Signup
   Configuration With 60 Expiration Token". The template is what makes the
   WhatsApp login variation appear; "Create configuration" by hand offers
   only "General" and no WhatsApp asset. In the template: System-user access
   token, expiration **Never**, asset "WhatsApp accounts" only, permissions
   `whatsapp_business_management` + `whatsapp_business_messaging`, product
   "WhatsApp Cloud API". There is no Coexistence toggle in the configuration;
   the code sets `featureType: whatsapp_business_app_onboarding` itself.
   Copy the configuration ID into Vercel (Production):
   - `WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID` (today: `1091922519903790`)
5. **JavaScript SDK**: Facebook Login for Business → Settings → "Login with
   the JavaScript SDK" = **Yes**, and "Allowed Domains for the JavaScript SDK"
   = `https://followupbase.io` and `https://www.followupbase.io`. Without
   the toggle Meta's window says "JSSDK Option is Not Toggled".
6. **Who can connect, and the message "FollowUp can't onboard customers right
   now"**: Meta only lets an app onboard other businesses' WhatsApp numbers
   once the app's own business has passed **Business Verification** (and, in
   Live mode, App Review for the two permissions). Until then that message
   appears at the end of the flow, for everyone. In Development mode people
   with a role on the app may get through; the founder's own account is the
   test. Business Verification is the Ontario registration plus documents in
   `docs/meta-and-twilio-verification-pack.md`. Nothing in code goes around it.

What the owner sees: Settings → WhatsApp → "Connect WhatsApp" opens Meta's
window; they scan a QR code with the phone that has the WhatsApp Business app;
the number stays on that phone. FollowUp receives the phone number id and the
WhatsApp Business Account id, exchanges the one-time code for a business
token, subscribes the app to the account, and saves (`POST /api/whatsapp/connect`).

**The post-24-hour template** is created by each business in WhatsApp Manager
(category Utility, one placeholder for the first name) and its name and
language are entered in Settings → WhatsApp. FollowUp cannot create it on the
business's behalf.

**Founder's own testing before App Review**: WhatsApp Manager → System Users →
generate a token with the two WhatsApp permissions, then use "Have an access
token instead?" in Settings → WhatsApp with the phone number ID and the WABA ID
from WhatsApp Manager → Phone numbers.

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
