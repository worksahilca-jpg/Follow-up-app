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
   `https://followupbase.io/api/integrations/outlook/callback` (and
   `http://localhost:3000/api/integrations/outlook/callback` for local
   dev).
5. Click **Register**.

## 2. Create a client secret

**Certificates & secrets → New client secret**. Copy the secret's
**Value** immediately — Azure only shows it once.

## 3. Grant API permissions

**API permissions → Add a permission → Microsoft Graph → Delegated
permissions**, add: `Mail.Read`, `Mail.Send`, `User.Read`,
`offline_access`, `openid`, `email`. These are all standard/low-privilege
permissions that don't require admin consent for a personal or single-org
connection — a business owner can consent for their own mailbox directly
on the Microsoft sign-in screen FollowUp sends them to.

## 4. Add the credentials to Vercel

Project `follow-up-app`, Production environment:

- `MICROSOFT_CLIENT_ID` — the app's **Application (client) ID**
  (Overview page).
- `MICROSOFT_CLIENT_SECRET` — the secret **Value** from step 2.
- `MICROSOFT_REDIRECT_URI` — `https://followupbase.io/api/integrations/outlook/callback`,
  must exactly match what's registered in step 1.

Redeploy. `GET /api/integrations/outlook/status` reports
`oauthAvailable: true` once both are set, which is what makes Settings
show the real "Connect" button.

## What this does NOT change

- Gmail is completely unaffected — a business with only Gmail connected
  sees no difference at all.
- There's no Outlook webhook/push yet (Microsoft Graph subscriptions exist
  but need their own renewal loop and a validated public endpoint) — new
  Outlook mail is picked up by the same every-ten-minute poll pattern
  Gmail used before push was added (`/api/cron/outlook-sync`). A push
  path is a reasonable follow-up once real usage shows the ten-minute
  delay matters.
- Access tokens are refreshed by hand on an as-needed basis
  (`src/lib/integrations/outlook.ts`, `getValidAccessToken`) since Graph
  has no equivalent of `googleapis`' auto-refreshing OAuth2 client — this
  is invisible to the business, just worth knowing if tokens ever seem to
  need reconnecting more than Gmail's do.
