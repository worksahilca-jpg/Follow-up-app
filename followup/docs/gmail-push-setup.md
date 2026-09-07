# Gmail push setup (new email seen in seconds)

Without this, the app still works: `/api/cron/gmail-sync` polls every ten minutes.
With it, Google notifies the app the moment a watched inbox changes and an
incremental sync runs within seconds (`src/app/api/integrations/gmail/push/route.ts`).

One-time setup in the Google Cloud project that owns the OAuth client
(currently "My First Project", `stately-synapse-507306-b8`):

1. **Enable the Pub/Sub API** for the project.
2. **Create a topic** named `gmail-push`. Full name will be
   `projects/stately-synapse-507306-b8/topics/gmail-push`.
3. **Grant Gmail permission to publish to it.** On the topic, add principal
   `gmail-api-push@system.gserviceaccount.com` with role **Pub/Sub Publisher**.
4. **Create a push subscription** on that topic:
   - Delivery type: Push
   - Endpoint URL: `https://followupbase.io/api/integrations/gmail/push?secret=<GMAIL_PUSH_SECRET>`
     (generate the secret with `openssl rand -base64 32` and URL-encode it, or use a
     long random alphanumeric string to avoid encoding at all)
   - Acknowledgement deadline: 10 seconds (default); the endpoint replies 204 immediately.
   - Retry policy: default.
5. **Vercel env vars** on project `follow-up-app` (Production):
   - `GMAIL_PUSH_TOPIC` = `projects/stately-synapse-507306-b8/topics/gmail-push`
   - `GMAIL_PUSH_SECRET` = the same secret used in the endpoint URL
   Redeploy after adding them.
6. **Activate watches.** The next `/api/cron/gmail-sync` tick (within ten minutes)
   calls `users.watch` for every connected inbox and stores the expiry; new
   connections get a watch immediately from the OAuth callback. Settings → Gmail
   then reads "new emails are picked up within seconds".

Notes:
- A watch lasts at most 7 days; the cron renews any watch with less than a day left.
- Google fires on every mailbox change, including our own sends. The push route
  holds a 3-minute per-business lock so bursts don\'t run overlapping syncs; the
  15-minute overlap on `since` means nothing is missed.
- The Gmail API `watch` scope is covered by `gmail.readonly`, already requested.
- If the OAuth app is still in Testing mode, watches work the same; the 7-day
  token expiry is the limit, not the watch.
