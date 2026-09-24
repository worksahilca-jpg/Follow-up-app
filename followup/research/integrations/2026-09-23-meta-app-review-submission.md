# Meta App Review — submission pack (FollowUp)

**Prepared 2026-09-23.** Business Verification cleared Sep 22, which was the gate blocking
submission. Nothing else is in the way.

- App: FollowUp — `2713853435677364`
- Business portfolio: FollowUp — `2529845140852589` (verified Sep 22, 2026)
- App mode: Live
- Login flavour: **Instagram Login** (`api.instagram.com` / `graph.instagram.com`), NOT Facebook
  Login. This matters — it means the permission family is `instagram_business_*`, and any guide
  written for `instagram_manage_messages` does not apply to us.

---

## 1. Why Meta grants this

Reviewers are deciding one thing: *does this app use the data for the stated feature, and does it
respect the rules that protect the person on the other end?* FollowUp's case is unusually strong,
and it is strong because of decisions already in the code — not because of how the form is worded.

**The four facts to lead with:**

1. **A business only ever sees its own conversations.** The lead is created under the connected
   business, and every query is scoped to `businessId`. No cross-business access, no scraping.
2. **Nothing sends without a human.** `Business.holdAllForApproval` is `@default(true)`. Out of the
   box every drafted reply waits in an approval queue until a person presses send. Automatic
   sending is off until the owner explicitly turns it on, having read four facts about what it
   does.
3. **It stops the moment the customer replies.** Follow-ups cancel on any inbound message. This is
   the product's central promise, not a setting.
4. **We deliberately do not use the human-agent tag for automated sends.** See §3 — this is the
   single most persuasive thing in the submission, and it is verifiable in the code.

**What FollowUp is not:** not a bulk sender, not a cold-outreach tool, not a scraper. It replies to
people who messaged the business first. That is the whole product.

---

## 2. What to request (and what NOT to)

| Permission | Request? | Why |
|---|---|---|
| `instagram_business_basic` | **Yes** | Identify which IG business account was connected |
| `instagram_business_manage_messages` | **Yes** | Receive the DM, send the owner's approved reply |
| **Human Agent** | **Yes** | Reply to a conversation older than 24 hours |
| `instagram_manage_comments` | **NO — drop it** | Currently "Ready for testing" but **the app never calls the comments API**. `INSTAGRAM_OAUTH_SCOPES` is `instagram_business_basic,instagram_business_manage_messages` and nothing else. Requesting an unused permission invites a rejection and a reviewer asking what you are hiding. |
| `public_profile` | No action | Standard, not something to submit |
| `pages_messaging` | No | Facebook Login family. Not used — we are Instagram Login. |

**One video per permission.** A single walkthrough covering all three is an auto-reject.

---

## 3. Written justifications — ready to paste

### `instagram_business_basic`

> FollowUp is a follow-up assistant for small businesses. When a business owner connects their
> Instagram professional account, we use `instagram_business_basic` once, at connection time, to
> read the account's ID and username. We need the ID to attribute incoming direct messages to the
> correct business in our database, and the username so the owner can see which account is
> connected on their Settings page and confirm it is the right one. We do not read media, insights,
> followers or any other profile data, and we do not use this permission after the connection step.

### `instagram_business_manage_messages`

> FollowUp helps a small business reply to people who message them, so no enquiry is missed.
>
> When someone sends a direct message to a connected Instagram business account, we receive the
> message via webhook and create a lead record for that conversation, visible only to that
> business. Our AI drafts a suggested reply based on the conversation. **That draft is not sent.**
> It waits in an approval queue until the business owner reads it and presses send — the
> `holdAllForApproval` setting is on by default for every new account, and automatic sending is
> opt-in and revocable.
>
> When the owner approves a draft, we use this permission to deliver that reply to the person who
> messaged them. Follow-ups stop immediately if the customer replies.
>
> A business can only ever see conversations from its own connected account. We do not message
> people who have not messaged the business first, and we do not use this permission for bulk or
> promotional messaging.

### Human Agent

> FollowUp uses the human-agent tag only for messages a person has personally reviewed and sent.
>
> Small business owners are frequently away from their phone for a day — on a job, with a client,
> driving. When they come back to a customer message that is more than 24 hours old, the standard
> messaging window has closed and they cannot answer the person who asked them a question. That is
> the case this permission covers: a genuine, human, customer-service reply to someone waiting for
> an answer.
>
> We apply the tag narrowly and deliberately:
>
> - It is applied **only** when a signed-in user presses send on a specific message. Our automated
>   follow-up path never passes it, by design.
> - Our bulk "send the routine ones" action never passes it either, specifically because nobody
>   read those messages individually and claiming a human agent handled each conversation would be
>   a false statement to Meta.
> - Our automated follow-up scheduler is capped at 20 hours from the customer's last message, so
>   automated replies land inside the standard 24-hour window and never rely on this tag.
>
> If this permission is not granted, the owner is told plainly in our interface that the window has
> closed and that they should reply from Instagram directly. We do not work around it.

**Note the third bullet is true and checkable:** `UNANSWERED_META_DM_MAX_HOURS = 20` in
`src/lib/metaWindow.ts`, and `humanSend` is deliberately omitted in `src/lib/bulkApprove.ts`.
If a reviewer probes anything, it will be this — and the answer holds.

---

## 3b. Pre-flight — verified 2026-09-24, before recording

Checked against the live database and the inbound code path, so none of it is assumed.

**The reviewer account is ready.** `followupbase.review@gmail.com` is ADMIN (the Connect route
requires it), onboarded, `holdAllForApproval` **true**, `autonomousAllowed` **false**. No
Instagram connected yet, as expected.

**The webhook plumbing is proven.** The founder's own business has been connected and
webhook-subscribed since 2026-09-20, which means the Meta app's callback URL and verify token
are correct at the app level. A second account connecting does not re-test that.

**The draft appears in seconds, not on a cron.** `processMetaEnvelope` calls
`scoreAndDraftForLead(lead.id)` inline on the inbound webhook. The lead is created, scored and
drafted inside the request. Nothing to wait for on camera.

**Nothing sends on its own — confirmed in code, not assumed.** The inbound path also calls
`acknowledgeNewLead`, which would otherwise fire an automatic DM. `acknowledge.ts` checks
`holdAllForApproval` and returns `{ sent: false, reason: "held for approval" }`, recording an
`ai.hold` instead. **This is what makes §3's justification literally true** for a reviewer
testing the account — worth knowing, because a reviewer who saw an unapproved message go out
would be reading a contradiction of the submission.

### Three things that will ruin a take

1. **"Approve & send" now waits ten seconds.** Shipped 2026-09-24 (#317). The button is
   replaced by *"Sending to <name> in 10s"* and an Undo. Nothing leaves until the clock runs
   out. **Let it run** — pressing again or cutting early will look like a broken product.
   It is worth narrating: a grace period is a trust feature, and Video B is a trust argument.
2. **Be logged into the DEMO Instagram account in that browser.** Meta's consent screen uses
   whatever Instagram session the browser already has, not the one you meant.
3. **Do not connect the founder's own Instagram account.** `instagramUserId` is unique across
   businesses; `28693476873589439` is already bound to the FollowUp business, and the callback
   will refuse with *"That Instagram account is already connected to another FollowUp
   account."* On camera that reads as a broken connect flow.

---

## 4. Screencast shot list

Per the playbook, **most 2026 rejections are here.** Record one per permission. English UI, zoom
on small text, add a text overlay naming the permission being exercised.

**Every video starts logged out, on `followupbase.io`.** Starting inside the dashboard is the most
common single failure.

### Video A — `instagram_business_basic`
1. Logged-out landing page
2. Sign in with the reviewer test account
3. Settings → Connect Instagram
4. **The Meta consent screen, with `instagram_business_basic` visibly listed** — pause here, zoom in
5. Accept
6. Back in Settings: the connected account's username now shown on screen

### Video B — `instagram_business_manage_messages`
1. Logged-out landing page → sign in
2. Show the Instagram account connected (consent screen again, with this permission visible)
3. **From a second phone, send a real DM to that Instagram account**
4. Show that message arriving in FollowUp as a lead, with the drafted reply
5. **Show it waiting for approval** — narrate that nothing sends on its own
6. Press Approve & send
7. **Cut to the phone: the reply has arrived in Instagram**

Step 5 is worth dwelling on. It is the thing that distinguishes FollowUp from the spam tools the
reviewer spends all day rejecting.

### Video C — Human Agent
1. A conversation where the customer's last message is more than 24 hours old
2. Show the interface stating the window has closed
3. Show the owner personally opening it and pressing send
4. The message arriving on the customer's phone

**Recordable today** — your own Instagram works inside the window, and @sahildoes is already past
24 hours for Video C.

---

## 5. Test credentials

- A **real FollowUp account**, created for the reviewer. Not your personal one.
- Must work from outside your network, in an incognito window. Test it that way before submitting.
- No HTTP basic auth or staging password in front of `followupbase.io`.
- The account needs a connected Instagram business account the reviewer can actually see working —
  coordinate this, it is the part that most often fails silently.
- Provide credentials **in the initial submission**, not when asked.

---

## 6. Rejection risks specific to us

| Risk | Fix |
|---|---|
| Requesting `instagram_manage_comments` | Drop it — unused |
| One video for three permissions | Three separate videos |
| Consent screen not visible in the recording | Pause and zoom on it |
| Reviewer credentials that only work for you | Test in incognito, off your network |
| Reviewer cannot see a real DM arrive | Use a second real phone, not a test user |
| Human Agent case sounding like automation | Lead with "only when a person presses send" |

---

## 7. Sequence

1. Drop `instagram_manage_comments` from the request
2. Create + test the reviewer account
3. Record A, B, C
4. Paste the justifications from §3
5. Submit — starts a **~20 day** clock (≈ Oct 13 if filed today)

Gmail testers are not blocked by any of this and should proceed in parallel.
