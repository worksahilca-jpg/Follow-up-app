# If something goes wrong: FollowUp's breach plan

Written 2026-10-05 (security review, CASA gap "incident response plan"). Keep it short enough to follow
at 2am. Review it every three months, or after any incident.

**Lead:** the founder (Sahil). **Backup:** whoever on `TEAM.md` holds Security/Ops.
**Public contact:** contact@followupbase.io (also in `/.well-known/security.txt`).

## 1. What counts

| Level | Example | Act within |
|---|---|---|
| **Critical** | Customer data seen by someone who shouldn't (another business, the internet); a secret key leaked; FollowUp sent messages nobody approved | 1 hour |
| **High** | A key or token may have leaked but no sign it was used; a large unexpected bill (OpenAI, Twilio, Vercel) | 4 hours |
| **Low** | A bug that could have exposed data but didn't; a report from a researcher | 2 days |

Where alerts come from: Sentry (errors and "Auth failure" security alerts), the Slack CI channel, provider
billing emails, `contact@followupbase.io`, a tester.

## 2. The first hour (critical)

1. **Stop sending.** Settings → Pause all sending for the affected business. If it's every business, also
   remove `OPENAI_API_KEY` in Vercel (FollowUp then can't write replies) and redeploy.
2. **Cut access.**
   - A person's account: Settings → Sign-ins and security → Sign out everywhere; remove them from the team.
   - Everyone: change `NEXTAUTH_SECRET` in Vercel and redeploy. Every session ends; people sign in again.
3. **Change the leaked key** at the provider first, then in Vercel, then redeploy:

   | Key (Vercel env) | Change it at |
   |---|---|
   | `OPENAI_API_KEY` | platform.openai.com → API keys |
   | `GOOGLE_CLIENT_SECRET` | Google Cloud → Credentials |
   | `MICROSOFT_CLIENT_SECRET` | Azure → App registrations |
   | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` | Stripe → Developers |
   | `FACEBOOK_APP_SECRET`, `INSTAGRAM_APP_SECRET` | Meta for Developers → App settings |
   | `RESEND_API_KEY` | Resend → API keys |
   | `CRON_SECRET`, `GMAIL_PUSH_SECRET`, `VOICE_AGENT_CALLBACK_SECRET` | make a new random value (`openssl rand -base64 32`); update the Pub/Sub URL for the Gmail one |
   | Database password | Supabase → Database settings (then `DATABASE_URL` in Vercel) |
   | A business's Twilio auth token | that business's Twilio console; they paste the new one in Settings |

   **`TOKEN_ENCRYPTION_KEY` is different:** changing it makes every stored Gmail, Outlook and Meta
   connection unreadable, so every owner has to reconnect. Only change it if the key itself leaked.
4. **Keep the evidence.** Don't delete logs. Export the Sentry issue, the Vercel runtime logs for the
   window, and the `AuditEvent` rows for the affected business (read-only query). Write down times as you go.

## 3. Within 24 hours

- **Find out what was touched:** which businesses, which customers, which kind of data (names, emails,
  phone numbers, message text, tokens). The `AuditEvent` table records sign-ins, exports, deletions and
  settings changes per business.
- **Fix the cause** in a PR with a test that would have caught it; run the security checklist in
  `CONTRIBUTING.md`.
- **Tell the affected owners** in plain words: what happened, what data, what we did, what they should do
  (for example: reconnect Gmail, warn their customers). No blame, no jargon.

## 4. Who else may need to be told

FollowUp handles personal information of Canadian businesses and their customers, and Google user data.
Each of these has its own reporting rules. Check the current official guidance before reporting; this
plan doesn't decide what the law requires.

- **Privacy Commissioner of Canada (PIPEDA breach reporting):** priv.gc.ca → "Report a privacy breach".
  PIPEDA also requires keeping a record of every breach, reported or not.
- **Google:** if Gmail or Calendar data was involved, follow the Google API Services User Data Policy
  and the terms of the OAuth verification.
- **Meta, Twilio, Stripe, OpenAI:** if their keys or data were involved, through each one's security contact.

## 5. After

Within a week: a short write-up in `research/audit/` (what happened, why, what changed), and an entry
in this file's history below. Update `docs/security-roadmap.md` if the plan itself needs to change.

## History

- 2026-10-05: plan written. No incidents to date.
