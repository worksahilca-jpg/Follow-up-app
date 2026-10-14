# Meta App Review: Messenger + Lead Ads, submission pack

**Prepared 2026-10-13**, to record on or after 2026-10-18 (the plan's date). Built the same way as the Instagram pack
that Meta approved with no changes (`2026-09-23-meta-app-review-submission.md`, approved 2026-10-09). It replaces the
short Sep 11 outline in `docs/channel-verification-submissions.md` §3, whose screens and words are out of date.

- App: FollowUp, `2713853435677364`, Live. Business portfolio `2529845140852589`, verified.
- Login flavour: **Facebook Login for Business** (`facebook.com/v21.0/dialog/oauth`). This is a different product from
  the Instagram Login that was approved; its permissions are the `pages_*` family.
- What already works, checked in production on 2026-10-13 (counts only): 1 Facebook Page connected and subscribed to
  webhooks; Messenger messages arrived and a reply went out (last both ways on 2026-09-30); 1 Lead Ads test form arrived
  as a customer (2026-10-07). All of it under the founder's app role, which is how Meta lets you use a permission
  before review.

---

## 1. Why Meta grants this

Reviewers decide one thing: does the app use the data for the feature it states, and does it protect the person on
the other end? Lead with what the code already does:

1. **A business only ever sees its own conversations and forms.** Every customer is created under the connected
   business, and every read is scoped to it.
2. **Nothing sends without a person, out of the box.** `Business.holdAllForApproval` defaults to `true`. Every reply
   FollowUp writes waits on Today until the owner presses Send, with a 10-second undo. Sending on its own is opt-in.
3. **It only answers people who wrote first.** A Messenger reply goes to someone who messaged the Page; a lead-form
   reply goes to someone who filled in the Page's own form. No cold outreach, no bulk sends, no scraping.
4. **Friends and family are kept out.** A new chat is checked first; a personal chat is set aside, never answered.
5. **It stops the moment the customer replies.** Check-ins cancel on any reply.

---

## 2. What to request (and what not to)

| Permission | Request? | What the code uses it for |
|---|---|---|
| `pages_show_list` | **Yes** | At connect, list the Pages the owner manages so they pick which one to connect |
| `business_management` | **Yes** | Without it, `/me/accounts` leaves out Pages owned by a business portfolio (found 2026-09-29: the founder's own Page was invisible) |
| `pages_manage_metadata` | **Yes** | Subscribe the connected Page to webhooks: `messages`, `message_echoes`, and `leadgen` |
| `pages_messaging` | **Yes** | Receive Messenger messages to the Page and send the owner's approved reply |
| `leads_retrieval` | **Yes** | Read a Lead Ads form submission (`GET /{leadgen-id}?fields=field_data,created_time,form_id`) |
| `pages_read_engagement` | **Check first** | No FollowUp code reads Page posts or engagement. It is requested only because the Oct 7 Lead Ads setup paired it with `leads_retrieval`. On the App Review page, if Meta lists it as required for `leads_retrieval`, request it and say so; if not, drop it from `LEAD_ADS_SCOPES` before recording. An unused permission is a common rejection |
| **Human Agent** (Messenger) | **Yes** | A reply a person sends between 24 hours and 7 days after the customer's last message goes out with the `HUMAN_AGENT` tag (`sendFacebookMessage`, `humanAgent: true`). Never on an automated send |
| `public_profile` | No action | Standard |

**Found while preparing this:** Meta's Instagram approval lists only `instagram_business_basic` and
`instagram_business_manage_messages`. The Instagram pack planned a Human Agent request too, and the app tags a person's
Instagram reply after 24 hours the same way (`lib/instagram.ts`). If Instagram Human Agent was never granted, those
late Instagram replies will be refused by Meta. Add it to this submission (Video F) rather than a third one.

---

## 3. Written answers, ready to paste

### `pages_show_list`

> FollowUp helps a small business answer the people who message its Facebook Page, so no enquiry is missed. When the
> owner presses "Connect with Facebook" in FollowUp's settings, we use `pages_show_list` once, during that step, to
> show the Pages they manage so they can choose which one to connect. We store only the chosen Page's ID and name. We
> do not use this permission after the connection step.

### `business_management`

> Many small businesses keep their Facebook Page inside a business portfolio. Without `business_management`, the list
> of Pages returned during connection leaves those Pages out, even when the person has full control of them, and the
> owner cannot connect their own Page. We use it only for that list at connection time. We do not read or change any
> other business portfolio data.

### `pages_manage_metadata`

> When the owner connects a Page, we use `pages_manage_metadata` to subscribe that Page to our webhooks for new
> messages and, where the owner uses Lead Ads, new lead form submissions. This is how a message or a form reaches
> FollowUp within seconds. We do not change any Page settings or content.

### `pages_messaging`

> When someone sends a message to the connected Page, we receive it by webhook and add the person as a customer for
> that business only. FollowUp writes a suggested reply. That reply is not sent: it waits on the owner's Today screen
> until they read it and press Send, with ten seconds to undo. Sending on its own is off for every new account and can
> only be turned on by the owner. Follow-ups stop as soon as the customer replies. We only ever message people who
> messaged the Page first, and never for bulk or promotional messaging.

### `leads_retrieval`

> Small businesses run Lead Ads, and the answers people leave in the form often sit unseen in Ads Manager. When someone
> fills in the connected Page's lead form, we receive the `leadgen` webhook and use `leads_retrieval` to read that one
> submission: the answers and the time it was sent. FollowUp shows it to the business owner as a new customer, marked
> "Facebook lead form", with every answer as it was given, and writes a suggested reply that waits for the owner's OK.
> We read only submissions to the connected Page's own forms.

### `pages_read_engagement` (only if Meta lists it as required)

> Requested only because Meta requires it alongside `leads_retrieval` for reading lead form submissions on a Page.
> FollowUp does not read Page posts, comments, followers or insights.

### Human Agent (Messenger, and Instagram if not yet granted)

> FollowUp uses the human agent tag only for a message a person has personally read and sent. Small business owners
> are often away for a day, on a job or with a client. When they come back to a customer message older than 24 hours,
> the standard window has closed and they cannot answer someone who asked them a question. The tag is applied only
> when a signed-in person presses Send on that one message, within 7 days of the customer's last message. Automated
> replies never use it: they are timed to go out inside the 24-hour window, and our bulk "send the routine ones" action
> never uses it either, because nobody read those one by one. If the tag is not granted, the owner is told plainly that
> the window has closed and to reply from Messenger directly.

**Checkable in the code:** `messaging_type: "MESSAGE_TAG", tag: "HUMAN_AGENT"` only when `options.humanAgent` is set in
`lib/facebook.ts`; `UNANSWERED_META_DM_MAX_HOURS = 20` in `lib/metaWindow.ts`; `humanSend` is left out on purpose in
`lib/bulkApprove.ts`.

---

## 4. Before recording (Oct 14–17)

Each line is a thing to have ready, not a thing to type into Chrome. Nobody pastes a password or a token into chat or
into Claude in Chrome.

1. **A test Facebook Page for the review**, separate from the founder's own. FollowUp lets one Page belong to only one
   FollowUp account (`facebookPageId` is unique), and the founder's Page is already connected to the FollowUp business.
   Connecting it to the reviewer account on camera would show "already connected to another FollowUp account". Create
   a new Page from the founder's Facebook account (Pages → Create), any plain name such as "Maple Key Realty Demo".
2. **The reviewer account** (`followupbase.review@gmail.com`) signs in, is ADMIN, has finished setup, and has
   "Every reply waits for you" on. Change its password first (the old one is visible on the approved submission's
   details page), and give Meta the new one in the submission form only.
3. **Lead Ads on for the reviewer business.** In Vercel, `LEAD_ADS_BUSINESS_IDS` must include the reviewer business id
   (or be `*`), or the connect screen won't ask for `leads_retrieval` and the form never arrives. The founder sets
   this himself in Vercel; Claude can read the business id from the database and give it to him.
4. **A second Facebook account with a role on the app** (App roles → Testers, accepted). Until Meta approves
   `pages_messaging`, Messenger only delivers messages from people with a role on the app. A stranger's message will
   not arrive on camera.
5. **The Lead Ads Testing Tool** works for that Page: developers.facebook.com/tools/lead-ads-testing, pick the test
   Page, create a test form if there is none, and press "Create lead". Do one practice lead the day before.

### Things that ruin a take

- **Starting inside the app.** Every video starts logged out on followupbase.io.
- **The wrong Facebook account in the browser.** The consent screen uses whatever Facebook session the browser has.
  Log into the founder's Facebook (who manages the test Page) before starting, in that same browser.
- **A first message that reads like a friend.** "hey" or "lol" can be set aside as personal chat. Send a clear
  customer question (below).
- **Cutting the 10-second undo short.** After Send, let "Sending to … in 10s" run out. Narrate it: it's a trust feature.

---

## 5. What to record

English, zoom in on small text, and put a text label on screen naming the permission being shown. Narration lines are
in quotes; say them in your own words.

### Video A: `pages_show_list` + `business_management` (about 1 minute)
1. followupbase.io, logged out. "This is FollowUp. It helps a small business answer people who message its Page."
2. Sign in with the reviewer account.
3. Settings → **Instagram, Facebook, WhatsApp** → Facebook → **Connect with Facebook**.
4. **Meta's consent screen.** Pause and zoom on the permissions list. "FollowUp asks to see the Pages I manage, so I
   can choose which one to connect."
5. The Page picker: it shows when the Facebook account manages more than one Page (the founder's Page and the test
   Page). Choose the test Page. "This list includes Pages kept in a business portfolio, which is why FollowUp asks
   for `business_management`."
6. Back in Settings: "Connected — <Page name>". "Only this Page is connected, and only this business sees it."

Upload this video to both permissions and say in the notes which step shows which.

### Video B: `pages_manage_metadata` (about 30 seconds, can follow A in the same take)
1. In Settings, show the connected Page and that it is receiving messages (no "isn't sending messages here" warning).
2. "When I connected, FollowUp subscribed this Page to new messages and new lead forms. That is how they reach FollowUp
   in seconds. It doesn't change anything on the Page."
3. Video C then proves it: the message arrives.

### Video C: `pages_messaging` (about 2 minutes)
1. Logged out → sign in → show the connected Page.
2. **On the phone, from the second account**, send the Page: *"Hi, is the 3 bedroom on Elm Street still available?"*
   Show the phone.
3. Back in FollowUp, **Today**: the person appears with their message and the reply FollowUp wrote.
4. **Stop here and say it:** "Nothing has been sent. Every reply waits for me. I read it, and I decide."
5. Press **Send**. Let the 10-second undo run out.
6. **Cut to the phone: the reply has arrived in Messenger.**
7. Optional: reply again from the phone and show the check-in stops.

### Video D: `leads_retrieval` (+ `pages_read_engagement` if kept) (about 1.5 minutes)
1. Logged out → sign in.
2. Open the Lead Ads Testing Tool, choose the test Page and form, press **Create lead**.
3. Back in FollowUp, **Today**: a new customer marked **"Facebook lead form"**, within a minute or two.
4. Open them: every form answer is shown as it was given ("When are you looking to buy? …"), and "Why it may write"
   says "Filled in your Facebook form".
5. "FollowUp reads only this Page's own form answers, so the owner sees them instead of them sitting in Ads Manager.
   The reply waits for my OK, like every other."

Meta's test lead has placeholder answers; FollowUp shows it as **"Test Lead"** with "(test answer)". That is expected.

### Video E: Human Agent, Messenger (about 1 minute)
1. A Messenger conversation where the customer's last message is more than 24 hours old (send one from the second
   account the day before recording).
2. On that customer, FollowUp says **"Messenger's reply window has closed"** and "FollowUp won't send anything on its
   own now. A reply you send yourself can still go out for …". Zoom on it.
3. The owner opens it, reads it and presses Send personally.
4. The reply arrives on the phone.

### Video F: Human Agent, Instagram (only if it was never granted)
Same as E with the Instagram account. Record it from the conversation already past 24 hours.

---

## 6. Rejection risks for this one

| Risk | Fix |
|---|---|
| `pages_read_engagement` requested with no use | Check Meta's dependency list first (§2); drop it if not required |
| One video for every permission | One video per permission (A may cover two, said in the notes) |
| Consent screen not visible | Pause and zoom on it in Video A |
| Message from an account with no app role never arrives | Second account added as a Tester and accepted (§4.4) |
| Lead never arrives | `LEAD_ADS_BUSINESS_IDS` includes the reviewer business (§4.3); practice lead the day before |
| Page already connected elsewhere | A separate test Page (§4.1) |
| Reviewer can't sign in | New password, tested in an incognito window off your network |
| Human Agent sounding like automation | Lead with "only when a person presses Send" |

---

## 7. Order

1. Oct 14–17: §4 (test Page, reviewer password, `LEAD_ADS_BUSINESS_IDS`, tester role, practice lead). Claude checks
   the reviewer account's settings in the database, read-only, once these are done.
2. Oct 18–19: record A–E (and F if needed).
3. Paste §3, upload the videos, add the reviewer login, submit. The Instagram review took 11 days (Sep 28 → Oct 9).
