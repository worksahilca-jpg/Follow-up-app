# Meta and Twilio — the pack for Sahil (2026-09-19)

The Google pack is `docs/google-verification-pack.md`. This is the other two, same shape: what
to do, in order, what it costs, what only you can do. The research behind it is
`research/integrations/2026-09-10-meta-google-verification-playbook.md` (§1, §3, §4) and
`research/integrations/2026-09-08-twilio-a2p-self-serve-api-scoping.md`. Where the research
could not confirm something, it says so here too.

## Meta: Instagram DMs, Messenger, Facebook lead ads

**Why it matters.** The Meta app is in Development mode. In that mode only people we add by hand
as testers can message a connected account. A real customer's DM never arrives. So Instagram
and Messenger cannot serve one real customer until Meta's review is done. Plan on **6 to 10
weeks** from the day you start, with one rejection round.

**What it costs: CAD $60.** Nothing else. Do not buy "Meta Verified", the blue-check
subscription. It is a marketing product and does nothing for this.

### Step 1 — Register the business name (this week, $60)

1. ServiceOntario → Business Name Registration for a sole proprietorship. This is what used to be
   called the Master Business Licence. Valid 5 years.
2. **Decide the exact legal name first** and write it down. Every other form (Meta Business
   Manager, the Meta app, the Google consent screen, the site) must match it letter for letter.
   A name mismatch is the most common Meta rejection.
3. Keep the PDF. You will upload it.

### Step 2 — Business Verification in Meta (free, days to two weeks)

1. business.facebook.com → Settings → Security Centre → Start verification.
2. Business type: **Sole proprietorship**.
3. Email: use `contact@followupbase.io`. Free-email submissions get slower, harsher review.
4. Documents. Meta usually wants two:
   - **Legal name:** the Ontario registration from step 1.
   - **Address and phone:** a business bank statement in the registered name, or a CRA business
     number letter. A hydro or phone bill in your personal name does **not** count.
   Whether Meta accepts the Ontario registration is not confirmed in research; it is the right
   category of document. If it bounces, it costs time, not money.
5. If rejected, fix the named reason and wait a day before resubmitting. Same-day resubmits get
   auto-flagged.

**Before step 2, spend 15 minutes on one check:** open the app's verification flow in the Meta
App Dashboard and see whether it offers an *individual* option with a government ID for a
Canadian person. Research could not confirm it exists on this platform. If it does, it saves
the registration and the paperwork above.

### Step 3 — Two settings in the Meta App Dashboard (free, 10 minutes)

1. Settings → Basic → **Data deletion instructions URL**: `https://followupbase.io/privacy`.
   Without this Meta will not let you submit at all.
2. Confirm the webhook is live: `https://followupbase.io/api/instagram/webhook` answers Meta's
   check. Ask me and I confirm it from the code.

### Step 4 — Record one screencast per permission

Meta reviews each permission separately. One video for all of them is a rejection. Seven
permissions, seven short videos, each starting on the public landing page:

| Permission | What the video must show |
|---|---|
| `instagram_business_basic` | Connect with Instagram, the consent screen with this permission visible, the account name appearing in Settings |
| `instagram_business_manage_messages` | A second account (added as a Tester) DMs the business; the DM appears on Leads; a reply is approved in FollowUp; the reply arrives in Instagram |
| `pages_show_list` | Connect with Facebook, the list of Pages, picking one |
| `pages_messaging` | Same as Instagram, on Messenger |
| `pages_manage_metadata` | The Page being connected (this is the webhook subscription) |
| `pages_read_engagement` | The Page's messages showing in FollowUp |
| `leads_retrieval` | Submit a test lead form (Meta's Lead Ads Testing Tool); it appears on Leads within a minute |

Rules: English interface, zoom on small text, captions saying which permission is on screen,
and a written description that matches the video beat for beat. Provide a working FollowUp
login for the reviewer in the submission itself, on `followupbase.io`, no extra password in
front of it.

**Before recording `leads_retrieval`:** check whether that form also demands
`pages_manage_ads`. FollowUp does not use it. If Meta insists, submit Instagram and Messenger
first and leave lead ads for a second round.

### Step 5 — Submit

App Review → Permissions and Features → submit Instagram first, then Facebook. Meta's stated
review time is about 20 days in 2026. Every rejection restarts the clock. Say what it is: a
business replying to its own customers, one conversation at a time. Never "outreach", never
"automation", never "growth".

### What only you can do

1. The $60 registration, in the name you will use everywhere.
2. Business Verification, with your documents.
3. The recordings, with your accounts. I write the seven descriptions and check each video
   against its script before you submit.

## Twilio: text messages and WhatsApp

**Today:** any customer can text or WhatsApp a Twilio number and FollowUp replies. No approval
needed for that. Two things are missing.

### Texts to US numbers (A2P 10DLC)

US carriers block texts from unregistered numbers. Canadian numbers texting Canadian numbers
are not affected. If your three pilot owners are in the GTA and text Canadian customers, skip
this for now.

When a US customer matters: Twilio Console → Trust Hub → register the business, then a
campaign for "customer care and follow-up". A few days, a small one-time fee Twilio shows at
the time. Research says Twilio also has a partner path that would let FollowUp register each
customer business through the app instead of by hand; that is a build, not a form, and not
needed for three pilots.

### WhatsApp after 24 hours (one template)

WhatsApp lets a business reply freely for 24 hours after the customer's last message. After
that, only a pre-approved template can open the conversation again. That is exactly FollowUp's
"they went quiet" message, so one template is needed.

1. Twilio Console → Messaging → Content Template Builder → New template.
2. Category **Utility**. Never Marketing.
3. Body, word for word:
   > Hi {{1}}, just following up on your inquiry — still interested? Reply here anytime and I'll
   > get right back to you.
4. Variable 1 = customer's first name. Submit. Usually approved in under an hour, a day if
   flagged.
5. Paste the template's SID into FollowUp → Settings → Phone. I show you where.

The other two drafts (quote follow-up, missed call) are in
`docs/channel-verification-submissions.md` §4 for later.

## Order, if you do one thing a day

| Day | Do |
|---|---|
| 1 | Google: the 30-minute console checklist and the video (Google pack). ServiceOntario registration. |
| 2 | Google: submit. Meta: check for the individual-ID option; set the data-deletion URL. |
| 3 | Meta: Business Verification with the documents. |
| 4 | Twilio: the WhatsApp template. |
| 5 to 7 | Meta: record the seven videos. I check them. Submit Instagram first. |
| Then | Answer every email from Google and Meta the same day. |
