# Outlook / Microsoft 365 setup — one-click connect

Without this, Settings shows Outlook as "not set up yet" and only Gmail
works. This is the one-time console setup that turns on the "Connect"
button for Outlook, exactly like `docs/meta-oauth-setup.md` does for
Instagram/Facebook.

Outlook is a genuinely separate email channel from Gmail, not a
replacement — a business can connect either one, or both (see
`src/lib/sending.ts`'s `detectEmailProvider`, which sends each reply from
whichever mailbox actually holds that lead's thread).

## 1. Register an app in Azure AD / Entra ID

1. Go to [entra.microsoft.com](https://entra.microsoft.com) →
   **Applications → App registrations → New registration**.
2. Name it "FollowUp" (or similar).
3. **Supported account types**: choose **"Accounts in any organizational
   directory and personal Microsoft accounts"** — this is what lets both
   a Microsoft 365 business mailbox and a plain `outlook.com`/`hotmail.com`
   account connect (the OAuth flow always uses the `common` tenant
   endpoint, matching this choice).
4. **Redirect URI**: platform "Web", value
   `https://followupbase.io/api/integrations/outlook/callback`. After
   registering, add `https://www.followupbase.io/api/integrations/outlook/callback`
   as a second Web redirect URI too (and
   `http://localhost:3000/api/integrations/outlook/callback` for local
   dev). Only the one in `MICROSOFT_REDIRECT_URI` is ever sent; having
   both registered removes the chance of an apex/www mismatch.
5. Click **Register**.

## 2. Create a client secret

**Certificates & secrets → New client secret**. Copy the secret's
**Value** immediately — Azure only shows it once.

The secret has an expiry date (24 months at most). Put it in the calendar.
When it lapses, every Outlook connection stops syncing at once. Each
business's admins get one bell notice to reconnect, which only works once
a new secret is in Vercel.

## 3. Grant API permissions

**API permissions → Add a permission → Microsoft Graph → Delegated
permissions**, add: `Mail.Read`, `Mail.Send`, `User.Read`,
`offline_access`, `openid`, `email`. None of these is an admin-only
permission.

**What owners will see [UNVERIFIED — general knowledge, not checked
against Microsoft's docs from here]:**
- A personal outlook.com / hotmail.com account can consent for itself,
  with FollowUp labelled an "unverified" publisher.
- A work or school (Microsoft 365) account may instead get "Need admin
  approval": many organisations only let staff consent to apps from
  verified publishers. Their IT admin has to approve FollowUp once.
  Worth one line in the tester welcome text.
- Publisher verification needs a Microsoft Cloud Partner Program account
  for a verified business.

## 4. Add the credentials to Vercel

Project `follow-up-app`, Production environment:

- `MICROSOFT_CLIENT_ID` — the app's **Application (client) ID**
  (Overview page).
- `MICROSOFT_CLIENT_SECRET` — the secret **Value** from step 2.
- `MICROSOFT_REDIRECT_URI` — `https://followupbase.io/api/integrations/outlook/callback`,
  must exactly match what's registered in step 1.

Redeploy. `GET /api/integrations/outlook/status` reports
`oauthAvailable: true` once all three are set, which is what makes Settings
show the real "Connect" button.

## What this does NOT change

- Gmail is completely unaffected — a business with only Gmail connected
  sees no difference at all.
- There's no Outlook webhook/push yet (Microsoft Graph subscriptions exist
  but need their own renewal loop and a validated public endpoint) — new
  Outlook mail is picked up by a poll every two minutes
  (`/api/cron/outlook-sync`, see `vercel.json`).
- Access tokens are refreshed by hand on an as-needed basis
  (`src/lib/integrations/outlook.ts`, `getValidAccessToken`) since Graph
  has no equivalent of `googleapis`' auto-refreshing OAuth2 client.
- When Microsoft refuses the refresh for good (`invalid_grant`: the owner
  revoked access, changed their password, or the secret expired), the
  connection is marked as needing a reconnect, the sync records why, and
  the business's admins get one bell notice to reconnect.
  Before 2026-09-28 it kept showing "connected, synced just now" while
  reading nothing. Any other refresh failure is recorded as an error and
  retried on the next run.
