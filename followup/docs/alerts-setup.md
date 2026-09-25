# Alerts outside the app: setup

FollowUp can tell an owner, by email and by a notification on their phone, when a
customer has written and a reply is ready for their OK. Both are off until you add the
keys below. Nothing breaks without them; FollowUp just doesn't send them.

About 15 minutes, most of it waiting for DNS. You paste every key yourself. Nobody else
needs to see them.

## 1. Email (Resend)

1. Create an account at **resend.com**.
2. Go to **Domains → Add domain** and type `followupbase.io`.
3. Resend shows you a few DNS records (usually 3 or 4). Add each one, exactly as shown,
   wherever `followupbase.io`'s DNS is managed (the same place you added the Google and
   Meta records). Don't change any records that are already there.
4. Back in Resend, press **Verify**. It can take anywhere from a few minutes to a few
   hours. Wait until the domain says **Verified**.
5. Go to **API Keys → Create API key**. Name it `FollowUp alerts` and choose **Sending
   access**. Copy the key. It starts with `re_` and is only shown once.
6. In **Vercel → the FollowUp project → Settings → Environment Variables**, add:
   - `RESEND_API_KEY` = the key you just copied (Production)

Emails come from `FollowUp <alerts@followupbase.io>`. To use a different address later,
add `ALERT_FROM_EMAIL`, for example `FollowUp <hello@followupbase.io>`. It must be on the
verified domain.

## 2. Phone and computer notifications

1. On your own computer, open a terminal and run:

   ```
   npx web-push generate-vapid-keys
   ```

   It prints a **Public Key** and a **Private Key**. Nothing is saved anywhere, and
   nothing is sent to FollowUp.
2. In **Vercel → Settings → Environment Variables**, add all three (Production):
   - `VAPID_PUBLIC_KEY` = the Public Key
   - `VAPID_PRIVATE_KEY` = the Private Key
   - `VAPID_SUBJECT` = `mailto:contact@followupbase.io`
3. **Generate these once, and never change them.** New keys switch off every phone that
   has already turned notifications on, and each owner would have to turn them on again.
   Keep a copy of the Private Key somewhere safe, like your password manager.

## 3. Redeploy

In **Vercel → Deployments**, open the latest one and press **Redeploy**. Keys only take
effect on a new deploy.

The same deploy adds FollowUp's new tables (the `20260925120000_owner_alerts`
migration). If the build log says `prisma migrate deploy` failed, run it by hand against
the production database before relying on alerts.

## 4. Check it works

- **Email:** go to **Settings → Advanced → Alerts** and check that "Email me when a
  customer is waiting" is on. It is on by default. Then send a test lead from Today.
  On an account that asks before every message (the default), its reply waits for you,
  and the email should arrive within about two minutes.
- **iPhone:** open followupbase.io in Safari. Tap **Share → Add to Home Screen**. Open
  FollowUp **from the new Home Screen icon**, go to **Settings → Advanced → Alerts**, and
  tap **Turn on FollowUp notifications on this device**. Then tap **Allow**. iPhone only
  offers notifications to a site opened from the Home Screen, which is why the Safari tab
  won't work.
- **Android or a computer:** the same button works straight from Chrome, Edge or Firefox.

## What owners get, and when

- **One alert per waiting customer.** It arrives a minute or two after the customer writes
  and FollowUp's reply is ready for their OK. If the customer writes again before the
  owner acts, there is no second alert. After the owner replies or dismisses the draft,
  the next message from that customer alerts again.
- **Many at once becomes one.** If more than 3 customers start waiting in the same minute
  (after a big inbox import, for example), the owner gets one line: "12 customers are
  waiting for your OK."
- **Email has a daily limit.** At most 20 emails per person per day, in the business's
  own time zone, then one "More customers are waiting" note until tomorrow. Phone
  notifications have no daily limit.
- **Never** for old conversations pulled in when an inbox is first connected, for the
  owner's own messages, or for private chats FollowUp set aside.
- Alerts go to the lead's assignee, or to every admin if nobody is assigned. That is the
  same set of people the bell in the app notifies.
- An alert never includes FollowUp's draft or the reason it was held. It only says who
  wrote, quotes up to 140 characters of their message, and links to their conversation.
