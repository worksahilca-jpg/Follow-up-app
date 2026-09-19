# Google verification — the pack for Sahil (2026-09-19)

Everything you need to submit FollowUp for Google OAuth verification, in the order to do it.
The research behind every line is in
`research/integrations/2026-09-10-meta-google-verification-playbook.md` (§2 and §3); the
copy-paste texts are in `docs/channel-verification-submissions.md` (§1). This page is the short
version: what to click, what to type, what it costs, what to record.

## Why this matters

Today the Google app is in **Testing**. That means two things for a real customer:
- their Gmail connection **dies after 7 days** and they have to reconnect, every week;
- at most **100** businesses can ever connect.

FollowUp's whole promise is that it keeps watching the inbox on its own. Testing mode breaks that
promise weekly. Verification is what makes a connected Gmail stay connected.

## The one decision only you can make: inbox reading

FollowUp asks Google for four permissions. Three are free to verify. One is not.

| Permission | What it does in FollowUp | Google's label | Cost |
|---|---|---|---|
| `gmail.readonly` | Reads incoming mail to spot customer enquiries and who has gone quiet | **Restricted** | A yearly security check by an approved lab, about **US$540 to $1,800 a year**, every year |
| `gmail.send` | Sends replies from the owner's own address | Sensitive | Free |
| `calendar.events` | Adds a calendar event when a customer books a call | Sensitive | Free |
| `userinfo.email` | Shows which account is connected | Basic | Free |

**Reading the inbox is the product.** "It spots who is going quiet" is the headline feature; without
`gmail.readonly` FollowUp can only send, not watch. So the honest recommendation is: keep it,
budget the lab check, and treat it as a cost of selling to Gmail users. The cheapest approved lab
found in research is TAC Security at about US$540 (Google-negotiated rate). It is yearly.

If you would rather launch on Instagram, WhatsApp and website forms first and add inbox reading
later, drop `gmail.readonly` from the submission and verification is free and takes about two
weeks. That is a product call, not a paperwork one. Say which.

## What it costs and how long it takes

| Step | Cost | Time |
|---|---|---|
| Domain and brand checks | $0 | 2 to 3 business days |
| Permission review for send and calendar | $0 | 3 to 10 business days |
| Lab security check for inbox reading (CASA) | US$540 to $1,800 a year | 4 to 12 weeks, runs alongside the review |

Plan on **6 to 12 weeks** to fully verified if inbox reading stays in. Start now.

## Before you submit — 30 minutes, all free

1. **Pick the support email.** Google shows it on the consent screen and it must match the
   homepage. Tell me the address and I'll put it in the site footer today. `sahil@followupbase.io`
   works; a `hello@` alias is nicer. Google also wants a contact element visible on the homepage.
2. **Google Search Console**, signed in as the Google account that owns the Cloud project:
   add `followupbase.io` as a **Domain** property (the DNS option, not "URL prefix"). Add the TXT
   record it gives you at your registrar. Wait for the green tick.
3. **Google Cloud Console → APIs & Services → OAuth consent screen.** Check every field says the
   same thing as the site:
   - App name: `FollowUp`
   - Support email: the address from step 1
   - Logo: `followup/public/brand/followup-symbol.svg` exported as a 120×120 PNG on white
   - Homepage: `https://followupbase.io`
   - Privacy policy: `https://followupbase.io/privacy`
   - Terms: `https://followupbase.io/terms`
   - Authorized domain: `followupbase.io` (not the vercel.app address)
4. **Same screen → Scopes.** Exactly these four, nothing else:
   `gmail.readonly`, `gmail.send`, `calendar.events`, `userinfo.email`.
5. **Record the demo video** (script below). Upload to YouTube as **Unlisted**. Google needs a link.

## The demo video — script

One take, English interface, narrate out loud or with captions. About three minutes. Google
rejects videos that skip the consent screen or never show the permission being used.

| # | On screen | Say |
|---|---|---|
| 1 | `followupbase.io`, scroll once so the reviewer sees the page describes Gmail | "This is FollowUp. It watches a business owner's inbox and follows up with customers who go quiet." |
| 2 | Click Start free → sign in with Google | "The owner signs in." |
| 3 | Settings → Connect Gmail. **Pause on Google's consent screen** so all four permissions are readable. Zoom in if small. | "FollowUp asks to read Gmail, send Gmail, add calendar events, and see the email address. Here is why each one is needed." |
| 4 | Click Allow. Back in FollowUp, the Leads page fills with real enquiries from the inbox. Open one. | "Reading the inbox is how it finds customer enquiries and notices who has not been answered." |
| 5 | Open a lead with a draft reply. Click Approve & send. | "Replies go out from the owner's own Gmail address, only after the owner approves." |
| 6 | Switch to Gmail in another tab. Open **Sent**. Show the same reply there. | "Here is that reply in Gmail's Sent folder." |
| 7 | Back in FollowUp, open a lead and book a call (or use the booking link). Switch to Google Calendar, show the event. | "When a customer books a call, FollowUp adds the event to the owner's calendar." |
| 8 | Settings → Disconnect Gmail. | "The owner can disconnect at any time, and can delete everything from Settings." |

Use a real Gmail account you control, with a few real-looking enquiries in it. Do not use a Google
Workspace test user. Turn Google's interface language to English before recording.

## Submitting — 20 minutes

1. OAuth consent screen → **Publishing status → Publish app**. It will say verification is
   required; click **Prepare for verification**.
2. Paste the **application description** and the **four scope justifications** from
   `docs/channel-verification-submissions.md` §1. They match the code word for word; do not soften
   them.
3. Paste the YouTube link.
4. Submit. Reply to Google's emails within a day; each unanswered question is a week lost.
5. When Google's email says it is time for the security assessment: get quotes from **two**
   approved labs (TAC Security and one other from the list Google links). Confirm which assurance
   level they assign you before paying. Answer the scoping questionnaire honestly: Vercel, Supabase
   Postgres, refresh tokens encrypted at rest, TLS in transit, one business cannot see another's
   data.

## What I have done on my side

- The public page now says, in the FAQ, that FollowUp reads incoming Gmail, sends from the
  owner's address and adds Google Calendar events. Google requires the homepage to say this.
- The privacy page already carries the Limited Use statement Google requires, on the same domain,
  and names both Gmail and Calendar.
- Page title carries the business name. Privacy and Terms are linked from the footer.

## What I still need from you

1. The support email address (step 1 above). I add it to the footer the same day.
2. Your call on inbox reading: keep (recommended, US$540+ a year) or drop for now (free).
3. The unlisted YouTube link once the video is recorded, so I can check it against the script.

## Not part of this pack

Meta (Instagram, Messenger, Lead Ads) is a separate track: business verification first, then
one screencast per permission. It is fully written up in the playbook §1 and §3. It needs the
CAD $60 Ontario business name registration before anything else, and only you can do that.
