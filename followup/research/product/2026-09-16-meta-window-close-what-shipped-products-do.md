# When Meta's 24-hour window closes, what do shipped products actually do?

**Date:** 2026-09-16. Branch `claude/followup-demo-to-production-4k39hr`.
**The question, in one sentence:** the founder has made Instagram DM, Messenger and WhatsApp the
core channels; a day-3 AI-drafted follow-up has no compliant API path on Instagram or Messenger;
**what do real products in this space do at that moment, and what should FollowUp do?**
**Commissioned to inform a decision, not to make it.** §6 takes a position because
`design-brain/workflows/research-workflow.md` step 10 requires one; §7 argues against it.

**No code was changed.** Every `file:line` below is a first-hand read of the working tree today.

**Which PRODUCT_DIRECTION rule this serves:** Rule 4 (don't build what a platform gives away free)
— §5.4 argues the window splits FollowUp's Meta-channel behaviour into a half Meta already does for
free and a half FollowUp is not allowed to automate, which is a Rule 4 problem stated precisely, not
a compliance footnote. Also Rule 3 (trust ships like a feature): whatever is chosen, the owner has to
be told what happened and why, and today they are told nothing.
**Moat or table stakes:** the options in §6 split cleanly. Tiers 1 and 3 are **table stakes** —
Manychat, respond.io, Chatwoot and Tidio all do some version, and a Meta-channel product without
them is not credible. Tier 2 (§6.2b — timing the follow-up *into* the window on purpose) is the
only part I found no competitor doing, and is the **moat-leaning** piece.

---

## What this builds on — read these first, they are not repeated

| Prior doc | What it already settled |
|---|---|
| `research/integrations/2026-09-16-meta-channels-production-audit.md` §3a | The window rules themselves, the code's total absence of window handling (`facebook.ts:46-50` sends `messaging_type: "RESPONSE"`, `instagram.ts:118-122` sends no tag at all), error code 10 / subcode 2018278, `human_agent` being humans-only, the tag retirement. **This file starts where that section ends.** |
| Same, §1 | The WhatsApp side — template retry, error 63016, and the recording bug. WhatsApp is the one Meta channel that already has a designed (if flawed) answer; this file is about the two that have none. |
| `2026-09-06-instagram-meta-business-verification.md` §"24-hour messaging window" | Flagged this ten days ago and recommended a UI warning. Nothing was built. |
| `research/product/2026-09-09-followup-cadence-best-practices.md` | The cadence evidence behind `UNANSWERED_FIRST_REPLY_HOURS = 3` and `DEAD_LEAD_DEFAULT_DAYS = 45`. §5 below re-reads those constants against the window; it does not re-derive the cadence research. |
| `research/product/2026-09-15-reaching-back-out-to-ignored-leads.md` | What a belated message should *say*. Orthogonal: that file answers "what words", this one answers "is there any legal pipe to put them in". |
| `research/product/2026-09-15-reactivation-consent-spec.md` | The consent screen for back-catalogue sends. §6.3 reuses its posture, not its screen. |

---

## Evidence quality — read before quoting anything

`WebFetch` is EGRESS_BLOCKED in this sandbox for `developers.facebook.com`, `www.twilio.com` and the
vendor help centres, consistent with every prior pass in this repo. **Every external claim below is
WebSearch-snippet-sourced. I fetched no primary page and read no vendor help article in full.** URLs
are given so a human can check; the summary is the search engine's, not mine.

| Grade | Means |
|---|---|
| **B** | Several independent sources agreeing, at least one of them a vendor's own help-centre page or a summary of Meta's own docs. |
| **C** | Vendor/practitioner blogs agreeing with each other; no primary source seen. |
| **D** | Single source, or sources that disagree with each other. Recorded so nobody re-finds it and believes it; do not quote. |
| **Code** | First-hand. I read the file. |
| **Inference** | My reasoning from the above. Never quote as a finding. |

**Time-sensitivity:** Meta changed these rules at least twice in the twelve months before this pass.
Everything in §3 was checked on **2026-09-16 only**. Treat any §3 claim older than about a quarter as
needing a re-check before it goes into code or copy.

---

# 0. The short version

**What shipped products do, converged across seven of them:** they **do not attempt the send**. They
pre-flight the window and suppress the automation. Then they do exactly two things: (a) let a
*human* send it — on Messenger and, per most sources, Instagram, using the `human_agent` tag, which
their inbox applies on the human's click; and (b) tell the business to have collected an **email or
phone number inside the window** and continue there. Nobody found has a third answer. The two
products with the most at stake either narrowed to WhatsApp (where templates exist) or left the
category entirely — MobileMonkey/Customers.ai says in its own announcement that it pivoted because
"Meta controlled what features could be offered […] and could kill popular features at any time."

**What I recommend FollowUp does:** three tiers, in this order — (1) never call the Send API out of
window, ever, on any Meta channel; (2) make the window not matter, by asking for a second channel
inside it *and* by moving FollowUp's own follow-up timing to land before the cliff rather than just
after it; (3) past the window, send by email if there is an email, and if there isn't, put a
one-tap, owner-sent message in front of the owner — which requires the `human_agent` App Review.

**The founder's instinct was right on the email half and, I'd argue, half-right on the other half.**
"Write the draft and hand it to the owner to send from their phone" is the correct *act*. But the
shipped products put that act **inside their own inbox with one tap**, not in the native Instagram
app, and they are right to: a send that happens in the native app comes back to FollowUp only as a
`message_echoes` webhook, and this repo's own research says that path is unverified
(`instagram.ts:194-209`). Handing the owner to the native app costs FollowUp Rule 2 — the record of
what was said stops being ours.

**How often it bites:** **not the tail.** §5 shows it in code: of five automated send triggers, two
are structurally always inside the window and **three are structurally always outside it, 100% of the
time they fire** — including "Auto follow-up on silence," the flagship behaviour that is on by
default. Separately, `SequenceStep.delayDays` is an `Int` (`prisma/schema.prisma:856`), so
**Workflows cannot express a schedule that fits inside a 24-hour window at all** — its finest
granularity is exactly the size of the window.

---

# 1. The one thing about the window that the audit did not say

The audit established the rule. This is the mechanic that changes the product design, and it is the
single most load-bearing external fact in this file:

> **Only the *person's* action resets the clock. Nothing the business sends restarts it.**

Sources put it in almost identical words — "every time the user responds, the 24-hour clock resets,
so if they reply on hour 23, you get another full 24 hours"; "they message, reply to a story, tag
you, or tap a button, and the clock resets to 24 hours. **Nothing you send restarts it.**"
**[Grade B — consistent across four independent vendor explainers and Manychat's own "Understanding
messaging windows" help page as surfaced in search.]**

Why this matters more than it looks: it means the window is not a property of the *conversation*, it
is a countdown attached to the lead's last inbound `Message` row — a value FollowUp already has,
indexed, in a query shape it already runs (`src/lib/sending.ts:47-54`, `:112-118`). FollowUp can
compute the exact second the window shuts for every open Meta lead, today, with no new API call and
no new column. **Everything in §6 is available to build because of that one fact.** The product does
not have to discover the window from an error; it can know.

---

# 2. What shipped products actually do

Seven products plus two adjacent data points. For each I tried to answer the founder's five
sub-questions. Where a row says *could not verify*, it means I could not find a statement I would
stake a real account on — not that the answer is no.

## 2.1 The table

| Product | Attempts a send past 24h? | "You send this one yourself" surface | Pushes to another channel? | Uses Meta's remaining allowances | Confidence |
|---|---|---|---|---|---|
| **Manychat** | **No — suppresses it.** Its docs describe Manychat "automatically preventing scheduled messages from being sent if a subscriber falls outside the 24-hour window." | Yes. **Manual sends from the Manychat Inbox get the `human_agent` allowance automatically** — "it is automatically applied to messages you send manually through Manychat's Inbox, so you don't need to choose or add the tag yourself." Automations do not. | Yes — sells SMS and Email as its own channels, and its guidance is to collect the address *inside* the window. | Messenger Lists / Marketing Messages (opt-in, ads-billed); Utility Messages on Messenger; `human_agent` for humans. States flatly: "In Messenger, Instagram, and WhatsApp, sending **automated** messages outside the 24-hour window is not allowed." | **B** |
| **respond.io** | **No.** "After the messaging window closes, no outbound messages can be sent." | Yes, and it is their marketed differentiator: "respond.io has an extended 7 days messaging window […] due to the HUMAN_AGENT tag integration on the platform," described as automatically granted to their users. Explicitly: "Automated messages, including workflow messages, bot-generated responses, and echoes, are not permitted […] if they are not sent by a human agent." | Yes — omnichannel inbox (WhatsApp, SMS, email) is the product. | `human_agent`; Facebook Message Templates for Messenger. | **B** |
| **Chatfuel** | **No.** | *Could not verify* a dedicated hand-to-human surface. | *Could not verify.* | One-Time Notifications, Recurring Notifications (see §3 — status changed in 2026), Sponsored Messages. Notes plainly that these "are only available for Facebook Messenger. Instagram Messenger has more limited options." | **C** |
| **Tidio** | **No.** "After the initial 24 hours, a 7-day messaging window begins. Within this period, you can continue to send manual messages via Inbox, but **automations will no longer be delivered**." | Yes — manual Inbox sends, same shape as Manychat. Their AI agent (Lyro) is described as handing off to a human "full conversation intact." | *Could not verify* an automated channel switch. | `human_agent` for humans only: "Automated bots can't use the Human Agent tag." | **B/C** |
| **SleekFlow** | **No.** "After the 24-hour window closes, you can no longer send free-form messages." | *Could not verify* a specific surface. | Omnichannel by design. | **Facebook Messenger Utility templates** — creatable and submittable for review inside SleekFlow, "for structured, non-promotional messages, such as order updates, shipping notifications, appointment reminders." Also states: **"Unlike Facebook, Instagram doesn't have a 'human agent tag' to extend conversations."** (This contradicts four other sources — see §3.2.) | **C** |
| **Chatwoot** (open source — the only one where the implementation is readable) | **No.** | Yes — and notably **not automatic**: "the tag is not automatically applied — it must be manually applied by the human agent when responding." A design choice worth noting; it is the most conservative reading of the rule. | n/a | `human_agent`, 7 days. | **B** |
| **WATI / Zoko** (WhatsApp-only) | No free-form. "After 24 hours, you can only send template messages […] The 24-hour window will open again only once the customer responds." | The owner's manual send is *also* template-constrained — "business owners can't send manual free-form messages after 24 hours." | n/a (single channel) | WhatsApp templates, approval "30 minutes to 24 hours." | **B** |

## 2.2 The two adjacent data points, which may matter more than the table

**MobileMonkey → Customers.ai left the category.** Their own announcement gives the reason: Meta
"controlled what features could be offered to customers and could kill popular features at any
time, which limited the extent of innovations that could be created and the size and scope of the
business that could be built," and the company "needed more control over its own destiny." They
pivoted to ad targeting and email; the chatbot became one feature in a broader stack. **[Grade C —
customers.ai's own blog post plus three review sites summarising it; I could not fetch the post.]**
This is the most senior product judgement I found on the founder's exact question, and it went the
other way: a company whose whole product was Messenger follow-up decided the platform risk was not
survivable and left.

**Inrō — the closest AI-native analogue to FollowUp on Instagram — designs its cadence to fit inside
the window.** Its marketed follow-up is "a 24-hour follow-up for non-clickers," and the pattern
described across the Instagram-AI-agent category is "a first follow-up around 4 hours after a
conversation stalls." **[Grade C — Inrō's own product pages and two review/explainer blogs.]**
FollowUp's `UNANSWERED_FIRST_REPLY_HOURS = 3` (`src/lib/automation.ts:57`) is independently the same
answer, arrived at from the cadence research rather than from the window. That convergence is worth
noticing: **the in-window follow-up is not a compromise, it is where the category has settled.**

## 2.3 Answering the five sub-questions directly

**1. Do they attempt a send past 24h at all?** **No — and this is the strongest convergence in the
whole pass.** Every product with a verifiable answer pre-flights the window and suppresses the
automated send rather than letting the API reject it. Manychat's phrasing — "automatically
preventing scheduled messages from being sent […] helping you avoid violating Meta's policies
without having to manually track every subscriber's time window" — frames the suppression as the
*feature*, not as a limitation. That reframe is available to FollowUp too.
**Direct consequence for this repo:** the audit's patch **P1** (pre-flight instead of discovering
from an error), proposed there for WhatsApp, is what the entire category does on all three channels.
It is not a nicety. It is the baseline for being in this business at all.

**2. Do they surface it as "you send this one yourself"? What does the UI look like?** They surface
it as **a manual send from their own inbox that silently carries the `human_agent` tag**. Manychat
and respond.io apply the tag automatically on a human's send; Chatwoot requires the agent to apply
it. **I could not verify the visual treatment** — no banner copy, no disabled-composer state, no
countdown pixel I would describe. respond.io does display a countdown in-conversation, but the one I
could confirm is the *auto-close* timer ("the scheduled closing time is displayed in each
conversation"), which is their own inbox-hygiene feature, not the Meta window. **Treat "what the UI
looks like" as unanswered.** That is a genuine gap in this research and it is also, usefully, a gap
in the market: if nobody has designed this moment well, there is room to.

**3. Do they push to another channel, and how do they get the address?** Yes, and the guidance is
unanimous: **collect it inside the window, by asking, and only if volunteered.** "An AI-powered flow
can ask for a user's email or phone number as part of a lead capture sequence once a user DMs your
account, but **the user must voluntarily provide it** — automated scraping of contact data is not
permitted." And: "the recommended approach is to capture leads from Instagram and follow up via
email or SMS once you've obtained their contact information during the 24-hour window." Manychat's
own community guidance is "go multi-channel with Email, SMS, WhatsApp to keep communications going."
**[Grade B — four independent vendor guides plus Manychat community answers, all agreeing.]**
**This is the single most repeated answer in the corpus and it is the founder's instinct, arrived at
independently.**

**4. Do they use Meta's remaining allowances, for what?** See §3 — the short answer is that the
allowances that still exist are for *transactional* and *paid-promotional* messages, and a
"still interested?" follow-up is neither.

**5. How do they talk about it in marketing?** See §4.

---

# 3. What is current in 2026, and what is stale advice

Checked 2026-09-16. This section is the part most likely to be wrong in three months.

## 3.1 What is dead

- **The old message tags — `CONFIRMED_EVENT_UPDATE`, `ACCOUNT_UPDATE`, `POST_PURCHASE_UPDATE` —
  are retired.** Requests carrying them return **error code 100**, effective **2026-04-27**.
  **[Grade C — Manychat's product-update post and three vendor guides giving the identical date;
  Meta's changelog could not be fetched. Consistent with the audit's §3a finding, independently
  re-found this session.]** Any blog post, StackOverflow answer or LLM memory recommending a tag as
  the follow-up escape hatch is **stale advice** and will now fail.
- **Recurring Notifications are discontinued**, replaced by Marketing Messages. **[Grade D on the
  date — one source says "January 7, 2026", another says "February". Both vendor blogs. The
  replacement is agreed; the month is not. Do not cite a date.]** Chatfuel's help docs still
  describe Recurring Notifications as a live option, which is a good illustration of how quickly
  vendor documentation in this space goes stale — **including, potentially, some of the rows in §2.1.**
- **One-Time Notifications** are still described as live by Chatfuel, but given the RN
  deprecation I would not rely on it without a primary check. **[Grade D.]**

## 3.2 What still exists, and exactly what for

| Allowance | Status | What it is actually for | Usable for a day-3 "still interested?" |
|---|---|---|---|
| **`human_agent` tag, 7 days** | Live. Requires its own App Review. | "Human agent support in cases where a user's issue cannot be resolved in the standard messaging window" — the business was closed for the weekend, the issue took more than a day. | **Only if a human sends it.** "It only applies to human-sent messages. Automated messages are not allowed during the 7-day window." **[Grade B — agreed by Meta's own overview page via search, Chatwoot, Manychat, respond.io, Tidio.]** |
| **Utility templates (Messenger)** | Live — Meta's stated replacement for the retired tags. Approval "up to 24 hours"; submissions final, not editable. | "Structured, **non-promotional** messages, such as order updates, shipping notifications, appointment reminders, or account-related messages." | **No.** A sales follow-up is not a utility intent. A genuine *appointment reminder* would be — which is a real, narrow, honest use if FollowUp ever books appointments. **[Grade C — SleekFlow, respond.io and BotHelp help pages agreeing; the intent list is consistent across all three.]** |
| **Utility templates (Instagram)** | **Unclear.** One source describes Utility Templates with a `post_purchase` intent as available; another says of the tags only `HUMAN_AGENT` works on Instagram, with `ACCOUNT_UPDATE`, `CONFIRMED_EVENT_UPDATE` and `CUSTOMER_FEEDBACK` marked "not available for Instagram Messaging API." | — | **Could not verify. Do not design against this.** **[Grade D.]** |
| **Marketing Messages API** | Live but **in beta, limited countries, rollout continuing through 2026.** | Opt-in promotional re-engagement. Requires the opt-in captured *inside* the window. | **Structurally wrong for FollowUp** — see below. **[Grade C.]** |
| **Sponsored Messages** | Described as still live; paid ad placement; "can reach any user who has previously messaged your page — without requiring an explicit opt-in." An interaction with it reopens the 24-hour window. | Paid re-engagement. | Technically yes. Commercially no — see below. **[Grade C/D — single detailed source.]** |
| **Private replies to a comment** | Live; described as bypassing the window once per comment. | Answering a public comment in DM. | No — needs a *new* public comment from the person. |

**Why Marketing Messages and Sponsored Messages are both structurally wrong for FollowUp, not just
inconvenient:** both are billed through a Meta **ad account with a credit card**, on a budget-based
bidding model. **[Grade C — Omnichat's guide plus Manychat's help page agreeing that Marketing
Messages requires "full access to both a Facebook business page and at least one ad account with a
credit card from a Meta-supported country" and that Meta charges through it.]** That means:
- It breaks the flat **$29/mo, everything included** promise, because the per-message cost is
  variable, billed by Meta, and outside FollowUp's control.
- It requires every customer to hold and fund a Meta ad account — a setup burden on top of Business
  Verification, which this repo already knows is the longest pole
  (`2026-09-10-meta-google-verification-playbook.md`).
- **It is Rule 4 in its purest form.** This is Meta's own paid rail. Building FollowUp's core
  promise on top of a Meta ad product means the promise costs whatever Meta decides it costs, and
  ends whenever Meta ends it. That is exactly the bet MobileMonkey took and then abandoned (§2.2).

**Recommendation on the allowances: use exactly one of them — `human_agent` — and use it only the
way its own documentation describes, for a message a human actually sent.** Everything else on that
list is either the wrong intent, the wrong billing model, or unverifiable.

## 3.3 The one place the audit may now be slightly out of date

The audit (§3a) says: "on Instagram and Messenger there is no template mechanism as there is on
WhatsApp." For **Messenger** that appears to have changed — Utility templates are exactly that
mechanism, and SleekFlow and respond.io both ship template builders for it. **[Grade C.]** It does
not rescue the follow-up case (wrong intent), so the audit's *conclusion* stands unchanged; but the
sentence itself should not be quoted as-is. **For Instagram the audit's statement stands** — I found
no verifiable template path.

---

# 4. How the category talks about the limit

Worth knowing because a product whose whole pitch is follow-up has to say something, and what they
say is a choice.

**The pattern: the limit is explained thoroughly in help centres and SEO blog posts, and is absent
from product marketing.** I could not find a single pricing page, hero section or feature page that
mentions the 24-hour window. The explanations live one layer down, in "Understanding messaging
windows"-style help articles and in long educational posts that rank for the problem. **[Inference
from the corpus — I searched specifically for marketing-page disclosure and found only help-centre
and blog treatments. Absence of evidence in a search-snippet corpus is weak evidence; grade this as
an impression, not a finding.]**

Three rhetorical moves recur, and all three are available to FollowUp:

1. **Reframe suppression as protection.** Manychat describes not-sending as "helping you avoid
   violating Meta's policies without having to manually track every subscriber's time window." The
   constraint becomes a service. This is the most honest of the three and the one that fits
   FollowUp's brand (`CLAUDE.md`: "trust outranks sophistication").
2. **Sell the 7 days as a feature.** respond.io markets its `human_agent` integration as "an
   extended 7 days messaging window." Note what is quietly true underneath: it is seven days *for a
   human*, and their own docs say so a paragraph later.
3. **Redirect to the multi-channel story.** "Go multi-channel with Email, SMS, WhatsApp to keep
   communications going." The window stops being a limit and becomes the reason to buy the rest of
   the product.

**The move nobody makes is to state it plainly on the surface.** One explainer in the corpus does
something close, and it reads as an implicit warning about competitors: *"If a tool markets
automated messages to leads who went quiet weeks ago, you should ask which window that runs in."*
**[Grade D — single source, an SEO blog with an obvious interest in saying it. Quoted because the
*question* is the useful part, not the source.]** That sentence is the one a FollowUp customer will
eventually ask us, and it is better to have answered it first.

**A copy line this research does *not* let us write:** anything on the landing page that promises
automated day-3 follow-up on Instagram or Messenger. Whatever §6 lands on, that claim cannot be
made. If it is already implied anywhere in marketing copy, it needs to change — and
`src/components/WhatsAppConfig.tsx:414-415` already promises an email fallback the code does not
have (audit §1e), which is the same class of problem in the product itself.

---

# 5. How often does this actually bite? (Reasoning, not measurement — nothing here is observed)

The founder's framing was: instant reply and the 3-hour follow-up are both inside the window, so the
closed-window case is specifically "a conversation that went somewhere and then died" — is that the
common case or the tail?

**The framing is right about the shape and wrong about the tail.** Here is why, grounded in code.

## 5.1 Every automated send trigger, against the window

The window closes 24h after the lead's **last inbound message**, and nothing FollowUp sends resets
it (§1). So each trigger's timing can be compared directly against that clock. All **Code**-grade:

| Trigger | Where | Fires at | Inside the window? |
|---|---|---|---|
| Instant acknowledgement | instant-ack path | Minutes | **Always inside.** |
| Unanswered first reply | `UNANSWERED_FIRST_REPLY_HOURS = 3` (`automation.ts:57`), hourly cron | 3–4h after the lead's message | **Always inside**, with ~20h of margin. |
| Unanswered, established conversation | `UNANSWERED_DEFAULT_HOURS = 24` (`automation.ts:46`), on by default (`automation.ts:258`) | 24–25h after the lead's message | **Always outside — by design, structurally, every single time.** |
| Auto follow-up on silence | `auto_send`, `triggerDays: 5`, enabled at signup (`src/lib/auth.ts:119`) | ≥5 days after last contact | **Always outside.** |
| Dead-lead reactivation | `DEAD_LEAD_DEFAULT_DAYS = 45` (`automation.ts:67`) | ≥45 days | **Always outside.** |
| Workflow steps | `SequenceStep.delayDays Int` (`prisma/schema.prisma:856`) | Day granularity | **Any step with `delayDays >= 1` is at or past the boundary.** |

Two findings in that table are sharper than "some sends are out of window," and both are new:

**Finding A — the 24-hour unanswered rule sits exactly on the cliff edge, on the wrong side.**
`findUnansweredLeads` (`automation.ts:161-212`) selects leads whose newest message is *inbound* and
older than the threshold. The window is measured from exactly that message. With the default of 24
hours and an hourly cron, the send is attempted somewhere in `[24h, 25h)` — i.e. **after the window
shut, every time, with no variance to hope for.** One vendor explainer states the general form of
this without knowing about FollowUp: *"A flow that waits a day before its follow-up is a flow that
will find the window closed."* **[Grade C.]** FollowUp's most human-sounding safety net — "Reply for
me when I haven't" — is, on Instagram and Messenger, calibrated to fire one hour too late, forever.
**Moving this threshold to ~20 hours for Meta-channel leads converts it from never-deliverable to
always-deliverable, and it is a constant.** That is the cheapest fix in this entire document.

**Finding B — Workflows cannot express a compliant Meta cadence at all.** `delayDays` is an integer
number of days. The window is one day. There is no value of `delayDays` that schedules a second
touch *inside* the window: `0` means immediate, `1` means at-or-past the boundary. **The feature's
smallest unit is exactly the size of the constraint.** Any Workflow a customer builds for an
Instagram or Messenger lead is, from step 2 onward, undeliverable — and per audit §1d the failure is
classified permanent, skipped, and logged to a cron JSON response. This is not a tuning problem; it
is a schema-shaped one, and it did not surface in the audit because the audit was reading the send
path, not the scheduler.

## 5.2 So: common case or tail?

**Common.** Three independent lines of reasoning, all marked **Inference**:

**(a) The shape of a DM lead makes "died after going somewhere" the *normal* ending, not the
unusual one.** Someone DMs a business from inside the app they are already scrolling. The opening
exchange — their question, FollowUp's instant ack, their reply, FollowUp's answer — collapses into
minutes, not days. That means a very high proportion of DM leads reach the state "a real exchange
happened" quickly, and then the thing that most often happens next is nothing: they got a price and
went quiet. On email, "went somewhere and then died" takes days to reach and many leads never get
there. **On a DM channel it is where most leads end up by lunchtime.** The founder's case is not the
tail; it is the modal outcome of the channel he just made core.

**(b) The two in-window triggers are the two least valuable ones.** The instant ack is a fixed
template. The 3-hour reply is the first answer. Both are real, both matter — and both are the part
of the job an owner *might* have done themselves, because the lead is still fresh in their mind.
**Every trigger that exists specifically because the owner will not do it — the 24-hour backstop,
the 5-day silence rule, the 45-day rescue — is on the wrong side of the window.** The correlation
runs the wrong way: the further a follow-up is from something a human would remember, the more
certainly it is undeliverable.

**(c) The 5-day silence rule is on by default for every business.** It is enabled at signup
(`auth.ts:119`) and PRODUCT_DIRECTION records the CEO's decision to keep it on ("a default of OFF
only moved the thing they forget from 'write the email' to 'click approve'"). So this does not bite
only businesses that configured something; **it bites the default configuration of every account,
on the default channels, from day one.**

## 5.3 The honest counter-argument to my own frequency answer

Volume is not the same as occurrence. If a business gets 30 Instagram leads a month, the instant ack
fires 30 times and the 3-hour reply maybe 15–20 times, while the silence rule might fire on 5–10.
**By message count, most of what FollowUp sends on Meta channels is in-window and fine.** A founder
looking at a send-count dashboard would conclude this is a minor edge case.

I think that reading is wrong, but it is not stupid, and it deserves stating: **the 5–10 are the ones
the owner bought the product for.** Nobody pays $29/mo for an autoresponder. The counter to the
counter is that the correct metric is not messages sent, it is *leads whose outcome changed* — and on
that metric the closed window is where nearly all of it lives. I cannot measure either number. I can
say which one the pricing page is selling.

## 5.4 The Rule 4 problem underneath all of this, stated once

PRODUCT_DIRECTION, Point 3, already records: *"Meta's free inbound agent on WhatsApp/Instagram (June
2026) means FollowUp should ingest what it handles rather than compete on the first DM."*

Put that next to §5.1 and the shape is uncomfortable:

> **On Instagram and Messenger, the half of FollowUp's behaviour that is legal to automate is the
> half Meta now does for free, and the half Meta does not do is the half FollowUp is not allowed to
> automate.**

That is not an argument against the channels. It *is* an argument that the differentiated product on
those channels cannot be "we send the follow-up" — because that specific sentence is the one Meta's
policy forbids and Meta's own agent partly occupies. It has to be something else: knowing which lead
is about to become unreachable, and making the owner's one remaining legal action take five seconds
instead of being forgotten. **That reframe is the actual product decision in front of the founder.**
The rest of this document is implementation of it.

---

# 6. Recommendation

Three tiers. Tier 1 is not optional under any choice. Tiers 2 and 3 are the decision.

## 6.1 Tier 1 — never call the Send API out of window. Non-negotiable, all three channels.

Before any automated Meta-channel send, read the lead's last inbound `sentAt` and compare to 24h. If
closed, the send does not happen — it becomes one of the Tier 3 outcomes. This is the audit's **P1**
generalised from WhatsApp to all three channels, and it is what every product in §2.1 does.

Three reasons it comes first, in order of seriousness:

1. **The enforcement risk lands on FollowUp's app, not on the customer.** Audit §3b: the behaviour
   policies describe "repeatedly contacting people without consent or automating messages to mass
   audiences." A cron that retries an out-of-window send daily, across every customer, from one Meta
   app, is a pattern-matchable version of that even though every individual message is a reply to
   someone who wrote first. One suspended app takes down every customer's Instagram at once.
2. **It stops the silent money burn.** Audit §1d: the current path re-drafts the same undeliverable
   message via OpenAI roughly once a day, forever, and throws it away. `2026-09-15-ai-cost-per-lead.md`
   exists precisely because that cost is tracked.
3. **It is the only way the owner can ever be told the truth.** Everything in Tier 3 depends on the
   system knowing "this is closed" as a *state*, not discovering it as an error after the fact.

## 6.2 Tier 2 — make the window not matter. This is the moat piece.

**(a) Ask for a second channel inside the window.** The category's unanimous answer (§2.3 q3). For
an Instagram or Messenger lead with no email on file, the in-window conversation should naturally
land on getting one — not as a form, as a sentence in a reply FollowUp is already writing. The lead
already has an `email` column; nothing new is needed to store it.

**(b) Time FollowUp's own follow-up to land *before* the cliff.** This is the part I found no
competitor doing, and it is available because of §1: FollowUp can compute the exact second the
window shuts for every open Meta lead, from data it already has.

Concretely, and this is the highest-value-per-line change in the document: **for leads whose reply
channel is Instagram or Messenger, the unanswered threshold should be well inside the window (~20h),
not at the 24h default.** It is a constant plus a channel check. It converts the single most
structurally-broken trigger in §5.1 from "undeliverable 100% of the time" to "deliverable 100% of
the time," and it does so with no App Review, no new permission, no new channel and no new promise
to the customer.

The same logic applies to `SequenceStep.delayDays` (Finding B) — but that one is a schema change and
belongs to `backend-ai-agent` with a decision from the founder, not to this file.

**Why (b) is the moat piece and (a) is not:** anyone can add an email field. Manychat already
suppresses out-of-window sends. **Nobody found schedules a message earlier *because* a platform
window is about to close.** It requires knowing the window per-lead, caring about a single lead's
deliverability rather than a campaign's, and being willing to let a policy constraint move a product
decision. That is the "depth on the one job" Rule 1 describes, and it reads to the customer as
FollowUp being the thing that knew.

## 6.3 Tier 3 — past the window, two outcomes, never a third

**If the lead has an email → send the follow-up by email, automatically. The guarantee survives.**

This needs one specific code change, and the codebase already has the shape for it.
`detectAutomatedReplyChannel` (`src/lib/sending.ts:107-129`) checks `lastChannel` *first*: for an
Instagram lead it returns `"instagram"` and never reaches the `if (lead.email) return "email"`
fallback on the next line. So capturing the email is necessary but **not sufficient** — the channel
picker has to learn "not this channel, this time." The mirror-image function already exists:
`detectNonEmailChannel` (`src/lib/sending.ts:149-168`) is documented as being for "a caller [that]
has deliberately decided NOT to use email for this particular send." The same pattern, inverted, is
the fix. This is a small change with precedent, not a new subsystem.

Two things this must carry, both copy, both non-negotiable:
- **The email has to say where the address came from.** Someone who DM'd on Instagram and then
  receives an email from a business they do not remember emailing reads it as creepy — even though
  they did hand it over, in a DM, three days ago. One clause fixes it. This is the same principle
  `deadLeadMessageHint` (`automation.ts:120-150`) already encodes for reactivation: make it
  unmistakable that *they* made contact first.
- **`src/components/WhatsAppConfig.tsx:414-415` currently promises this fallback and it does not
  exist.** Shipping this closes an existing truth gap. Not shipping it means the copy must change.

**If the lead has no email → hand it to the owner as one tap, inside FollowUp.**

The draft is written, the reason is stated, and the owner sends it with one tap from the Today
screen — FollowUp calls the Send API with the `human_agent` tag, on the owner's action, within the
7-day window. This is exactly what Manychat, respond.io, Tidio and Chatwoot do, and it requires the
**Human Agent App Review permission** — already flagged as an open decision in
`2026-09-10-meta-google-verification-playbook.md` and audit §6.7. **This research resolves that
decision: yes, request it.** Without it there is no legal path at all past hour 24 on these channels.

**Where I'd push back on the founder's instinct, specifically.** "Hand it to the owner to send from
their phone" is the right *act*, and the right instinct about where the owner is (R-002 in the
design brain records the ICP as an owner "up a ladder," interrupted, on a phone, 90 seconds). But
sending it from the **native Instagram app** costs three things the one-tap version keeps:
- **Rule 2 — own the data.** A native send returns to FollowUp only as a `message_echoes` webhook,
  and this repo's own note says that path is unverified and may not fire at all when Meta's Business
  Agent holds the thread (`src/lib/instagram.ts:194-209`). A message FollowUp cannot see did not
  happen as far as the outcome record, the weekly report, and the "stops the instant a lead replies"
  guarantee are concerned.
- **Completion rate.** "Copy this, open Instagram, find the thread, paste, send" is five steps for
  someone on a ladder. One tap is one.
- **The audit trail.** Rule 3 wants an explicit guarantee with a record behind it. A tap inside
  FollowUp is auditable; a paste is not.

I would keep "open it in Instagram" as a **secondary** affordance for the owner who wants to edit
freely or add a photo — not as the primary path.

**And a hard boundary on this tier:** the one-tap send must be a *real* human decision — a thing the
owner sees, reads and taps. It must never be a batch "approve all," a default-on setting, or
anything that could be characterised as automation wearing a human's tag. Multiple sources say
using `human_agent` for bot messages is among the fastest ways to lose API access. **[Grade C —
Chatwoot's help page and two vendor compliance blogs agreeing.]** That is a real constraint on the
UX, and it points the same direction the product already goes: approval-first, one lead at a time.

## 6.4 What I explicitly recommend against

- **Sponsored Messages / Marketing Messages** — §3.2. Breaks flat pricing, requires a funded ad
  account per customer, Rule 4 violation.
- **Utility templates for the follow-up case** — wrong intent, and submitting a sales follow-up as a
  "utility" message is the kind of thing that gets a template rejected at best.
- **Waiting for the lead to re-engage and calling that the answer** — it is what the platform wants
  and it is the negation of the product.
- **Doing nothing and letting the sends fail** — the status quo, and the worst option: it spends
  money, tells nobody, and puts the app's API access at risk for messages nobody receives.

---

# 7. Arguing against my own recommendation

Four real objections. The first is the serious one.

**7.1 Tier 3's one-tap is the owner doing the job — which is the job FollowUp sold them out of.**
PRODUCT_DIRECTION point 4: *"the end state is that no human does this job at all."* A one-tap Send
is a human doing this job. The CEO's own reasoning for defaulting follow-up to ON was that a default
of OFF "only moved the thing they forget from 'write the email' to 'click approve'." **Tier 3 moves
it right back.** An owner who reliably taps things did not need FollowUp.

**This is the strongest argument against my answer and I do not think it can be fully rebutted.**
The honest position: on Instagram and Messenger past 24 hours, FollowUp's promise genuinely degrades
from "the follow-up gets done" to "the follow-up gets *prepared*, and getting it done takes you one
tap." That is a weaker product, on the channels just made core, and no amount of design fixes it —
because the constraint is Meta's, not ours.

What survives the objection: the tap is *last*, not first. Tier 2(b) exists precisely so that the
most common firing of the most-used trigger never reaches Tier 3. Tier 3's email branch keeps full
automation for every lead who gave an address. **The tap is the residue — leads with no email, past
24 hours — not the design.** If it turns out to be most leads, that is a signal Tier 2(a) is failing
and the answer is to fix email capture, not to accept the tap.

**7.2 Email capture may just not happen.** Someone who DMs "how much for a bathroom?" has no reason
to hand over an email, and asking for one is friction that can end a conversation that was going
fine. If capture is low, Tier 3's automated branch is rare and the manual branch is the product.
**I have no data on in-DM email-capture rates and did not find any I would trust.** That is a real
hole in the recommendation and the founder should treat the capture rate as the number that decides
whether this plan works. It is also the first thing real usage will tell us.

**7.3 `human_agent` on an AI-written draft may be closer to the line than I am treating it.** The
tag's documented purpose is a human agent resolving an issue that could not be resolved in the
standard window. A human tapping Send on a message an AI wrote is, in letter, human-sent. Whether
Meta reads it that way is **Meta's call and I could not verify it.** The evidence that it is
tolerated is decent but circumstantial: Manychat and respond.io both auto-apply the tag to any human
inbox send, and their users are demonstrably pasting AI drafts into those inboxes. Tolerance is not
a ruling. **Chatwoot's more conservative choice — require the agent to apply the tag deliberately —
is worth copying in spirit**: make the human's act unambiguous and logged, and do not make the tag
invisible to the person relying on it.

**7.4 Maybe the right answer is that Instagram and Messenger are capture-and-escalate channels, not
follow-up channels.** A genuinely different position, and it deserves a hearing: accept that DMs are
where leads *arrive*, that the in-window exchange is where FollowUp answers them, that the job on
those channels is to get the lead onto email or WhatsApp — and that automated follow-up simply is
not an Instagram feature, stated plainly in the product and the marketing.

This is close to what MobileMonkey concluded before leaving the category (§2.2), and it is cleaner
than my answer: no App Review, no human_agent exposure, no promise that degrades per channel.
**What it costs is the leads with no email and no phone, which on Instagram is a lot of them** —
a DM lead may be nothing but a PSID (`instagram.ts:158-168` creates the lead with `name: "@username"`
and a prefixed id in `phone`, and nothing else). Under 7.4 those leads get one in-window shot and
are then unreachable forever. I do not think the founder will accept that, and I do not think he
should — but **if Tier 2(a)'s capture rate comes back low, 7.4 is what the evidence will be saying,
and it should be re-read then rather than argued down now.**

---

# 8. What I could not verify — explicitly

1. **What any of these products' window UI actually looks like.** No banner copy, no disabled-composer
   state, no countdown treatment confirmed. The single most useful thing a human with five browser
   tabs could add to this file.
2. **Instagram's `human_agent` support.** Four sources say it works on Instagram (and one says it is
   the *only* tag that does); SleekFlow's help centre says Instagram has no human agent tag. **This
   contradiction is unresolved and it is load-bearing for Tier 3.** Resolve it against Meta's own
   Instagram Platform docs before building.
3. **Whether Instagram supports Utility templates.** Sources disagree (§3.2). Do not design against it.
4. **Whether replying from the native Instagram app is genuinely unrestricted.** Several vendor blogs
   say the 24h rule "does not limit your ability to respond manually" and governs API-triggered
   messages only. **[Grade C.]** Plausible — the window is an API policy — but unconfirmed against a
   primary source, and §6.3's secondary "open it in Instagram" affordance depends on it.
5. **The exact Graph error and its classification for an out-of-window send.** Carried forward
   unchanged from audit §5.4.
6. **In-DM email-capture rates.** No trustworthy number found. See §7.2.
7. **Whether Meta treats "human tapped Send on an AI draft" as human-sent.** See §7.3.
8. **Every date and status in §3.** Search-snippet-sourced, checked 2026-09-16 only, in a policy area
   that changed at least twice in the preceding year.

---

# 9. Handover — who does what

Nothing here should be built from this file alone.

- **Founder's decision first:** Tier 3's shape (§6.3 one-tap vs §7.4 capture-and-escalate), and
  whether to request the Human Agent App Review. Everything else follows from those two.
- **`backend-ai-agent`:** Tier 1 pre-flight on all three Meta channels (audit P1, generalised); the
  Tier 2(b) threshold constant; the `detectAutomatedReplyChannel` change in §6.3; and Finding B
  (`delayDays`) as its own scoped decision.
- **`frontend-3d-agent` + the design-brain loop:** the closed-window surface is **copy that carries
  UX weight** — it changes what the owner does next. Per `../CLAUDE.md` it needs
  `decisions/rejected.md` read first (R-002 is directly relevant: this owner is on a phone,
  interrupted, 90 seconds, and will not learn anything) and a dated entry in `design-decisions.md`.
  **This file deliberately does not write that copy.** What it specifies is the *content*: the owner
  must be able to answer, without asking support — what happened, why FollowUp did not send it, what
  it would have said, and what the one action is now.
- **`qa-security-agent`:** the test that pins Tier 1 — an out-of-window Meta lead must produce
  *no* Send API call. Rule 3 asks for a test behind every guarantee; audit §1's test gap is the
  precedent.

---

## Sources checked 2026-09-16

All via WebSearch result summaries. No primary page was fetched; `developers.facebook.com` and the
vendor help centres are EGRESS_BLOCKED in this environment.

**Vendor help centres / product docs (highest-weight in this corpus):**
- https://help.manychat.com/hc/en-us/articles/14281199732892-How-to-send-messages-outside-the-24-hour-and-7-day-windows-in-Messenger-and-Instagram
- https://help.manychat.com/hc/en-us/articles/23358636027932-Understanding-messaging-windows
- https://help.manychat.com/hc/en-us/articles/14281158573852-Messenger-Lists-in-Manychat
- https://help.manychat.com/hc/en-us/articles/24351480518684-Marketing-Messages-on-Messenger
- https://help.manychat.com/hc/en-us/articles/25928347005596-Utility-Messages-on-Messenger
- https://help.manychat.com/hc/en-us/articles/14281070478748-Manychat-Inbox
- https://community.manychat.com/product-updates/meta-s-deprecation-of-the-message-tags-feature-on-messenger-9010
- https://respond.io/help/retain-customers/send-outbound-messages
- https://respond.io/help/instagram/instagram
- https://respond.io/help/facebook-messenger/facebook-message-templates
- https://respond.io/help/inbox/managing-conversations-in-inbox
- https://docs.chatfuel.com/en/articles/5627483-types-of-reengage-messages
- https://docs.chatfuel.com/en/articles/3705639-one-time-and-recurring-notifications
- https://docs.chatfuel.com/en/articles/4821083-sponsored-messages-entry-point-re-engage-bot-users
- https://www.chatwoot.com/hc/user-guide/articles/1745225158-what-is-human-agent-tag-in-instagram-messenger-channel
- https://help.sleekflow.io/en_US/facebook_messenger/facebook-messenger-channel-overview
- https://docs.sleekflow.io/messaging-channels/facebook-messenger
- https://help.bothelp.io/en/facebook-messenger-message-templates/
- https://www.wati.io/en/blog/whatsapp-follow-up-messages/
- https://www.zoko.io/learning-micro-lessons/24-hours-window-in-chat
- https://www.tidio.com/blog/instagram-chatbot/
- https://customers.ai/blog/announcing-customersai
- https://www.inro.social/product/ai-agent
- https://blog.omnichat.ai/facebook-marketing-message-en/

**Meta pages (search summaries only — direct fetch blocked):**
- https://developers.facebook.com/docs/instagram-platform/overview/
- https://developers.facebook.com/documentation/instagram-platform/instagram-api-with-instagram-login/messaging-api
- https://developers.facebook.com/documentation/business-messaging/messenger-platform/send-messages

**Practitioner / explainer blogs (Grade C–D; used for corroboration, never alone):**
- https://www.keyapi.ai/blog/instagram-messaging-api-policy/
- https://creatorflow.so/blog/instagram-dm-compliance-meta-rules/
- https://creatorflow.so/blog/how-instagram-dm-automation-works/
- https://www.spurnow.com/en/blogs/instagram-dm-automation-rules
- https://rapiddm.com/blog/instagram-dm-automation-limits-24-hour-window
- https://www.conferbot.com/limits/instagram
- https://sumgenius.ai/blog/instagram-24-hour-messaging-window-2026/ (Grade D claims only)
- https://elpidan.com/en/blog/instagram-24-hour-rule (Grade C — the native-app claim in §8.4)
- https://www.blotato.com/blog/instagram-messaging-api
- https://chatbotx.io/blog/facebook-marketing-messages-2026-the-ultimate-guide-to-re-engaging-your-messenger-subscribers/
- https://chatimize.com/marketing-messages/
