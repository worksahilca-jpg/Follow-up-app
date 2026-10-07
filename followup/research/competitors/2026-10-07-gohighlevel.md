# Competitor: GoHighLevel, as a realtor team actually uses it

**Date:** 2026-10-07
**Question:** A realtor team that runs on GoHighLevel loses half its booked meetings to
no-shows and parks half its leads in an email-only "nurture" pile for about two months.
Is that something GoHighLevel can't do, and should FollowUp compete with it, sit beside it,
or connect to it?

**Trigger:** the founder's discovery conversation on 2026-10-07 with a realtor who leads a
sales team (no names kept). Two of the team said the CRM, "sounded like GoHighLevel", is not
user friendly; one said it is different but learnable.

**Evidence grades:** **A** = said first-hand by the people we spoke to · **B** = the vendor's
own docs or help pages, via search snippet · **C** = review sites, agency blogs, user
idea boards. WebFetch is blocked for capterra.com, ideas.gohighlevel.com and
marketplace.gohighlevel.com from this environment, so nothing was read in full. We have
**not used GoHighLevel**; everything about its screens is second-hand.

---

## 1. What the team told us (A)

- **600 leads a month**, mostly from paid ad campaigns, plus an older Facebook Marketplace
  tactic (see §6). Few inbound leads.
- Sales staff call every lead **within 24 hours**. They prefer calls to texts, because a
  person on the phone can explain things and **book a meeting**. A booked meeting is the
  goal, not a reply.
- About **50% don't pick up** and go into a **"nurture" pipeline**: an email chatbot sends
  marketing, and someone may call again in about two months. A lead who replies becomes "hot".
- About **25% of leads get a meeting booked**, **about half of those show up**, and
  **6–8 deals close** a month (about 1%).
  Per month: about 150 booked, about 75 no-shows. Per year: about 900 no-shows.
- **Reminders 2 hours before a meeting are already automated.** No-shows are still about 50%.
- Managers judge each salesperson on **meetings per week**, with a target of about 10 new
  conversations a day (40–50 dials). Meetings are tracked in the CRM **and** in a separate
  Excel sheet that an assistant keeps up: lead distribution, meetings per salesperson,
  weekly totals, who had none.
- The team uses the CRM's **calendar** for lead meetings.

## 2. What GoHighLevel is

An all-in-one marketing platform built for agencies to resell: CRM, pipelines, funnels and
websites, email, SMS, calendars, workflows, reviews, and AI add-ons (B/C). Our earlier pass
called it "everything, for people who configure things for a living. The anti-FollowUp"
(`market/2026-10-04-crm-study-why-followup.md` §6).

**Price** (B/C, several 2026 pricing guides agree):
- Starter $97/month, Unlimited $297/month, SaaS Pro $497/month. Annual billing saves about 17–20%.
- On top of that: phone and SMS by usage (about $0.0075 per SMS segment before carrier
  fees), and email by usage.
- AI per sub-account: pay-per-use (Conversation AI about $0.02 a message), or
  "AI Employee" at $50/month (capped) or $97/month (uncapped).
- Voice AI since 20 May 2026: about $0.16 a minute all in.

## 3. It already has every feature this team is missing (B/C)

This is the main finding. Every leak in §1 has a GoHighLevel feature built for it:

| The team's leak | GoHighLevel feature that exists |
|---|---|
| No-shows | Appointment status trigger: **"No-show"** starts a workflow. Agencies sell "no-show recovery" sequences built on it. |
| Unanswered calls | Call status trigger with **"no answer"**, which can start a text or a nurture sequence. Missed-call text-back for inbound calls. |
| 2-month nurture silence | Workflows, email/SMS sequences, Conversation AI that replies on SMS, Messenger, Instagram and web chat, qualifies, books, and hands off to a person. |
| Reminders | Appointment reminders (the team already uses these). |
| Team reporting | Pipelines and reporting per user. The team still keeps a separate Excel sheet anyway. |

**So the team's problem is not a missing feature.** The features are there, and the team
either hasn't built the workflows or doesn't trust them. Each one is a flowchart someone has
to design, test and maintain. Real-estate workflows don't come out of the box (C). Setups are
often bought from an agency as a "snapshot" (C).

## 4. Where it fails this kind of user

1. **Hard to learn.** Reviewers report a **6–8 week** learning curve, menus **3–4 levels
   deep**, and an ease-of-use score around 3.5/5. Many say you need an expert to set it up
   properly (C, several review sites agree). This matches what the team told us (A).
2. **The owner builds the logic.** "When X, do Y" has to be designed by a human, and every
   exception (rebooked already? said no? a real person needed?) is another branch. Agency
   guides warn to check "has this contact rebooked since the no-show?" before every step,
   or the system keeps chasing someone who already rebooked (C). That is exactly the
   judgment FollowUp makes for the owner (held-by-default, stop when the customer answers,
   no reminders after a no).
3. **Weak mobile app.** The LeadConnector app is described as outdated and "terrible
   especially for service based business" (C). A team that lives on the phone feels this.
4. **Data it may get wrong.** A request on GoHighLevel's own idea board is titled "GHL
   Records Call As 'Answered', Regardless of the Contact Answering Or Not" (C; title only,
   the page is blocked). **Unverified.** If true, any "no answer" automation fires
   unreliably. Don't repeat this claim outside this file until it is read in full.
5. **Two sources of truth.** The team keeps meetings in GoHighLevel *and* Excel (A). The CRM
   isn't trusted, or isn't quick enough, as the record.

**What it does well (be honest):** one bill for everything, unlimited contacts and users at a
flat price, a big community, a real API, and AI that can text and call. For an agency
running many clients, it is hard to beat.

## 5. Could FollowUp connect to it? (B)

Yes, technically:
- **API v2** with OAuth 2.0 (authorization code), through a HighLevel Marketplace app.
- **Webhooks** for ContactCreate/Update, AppointmentCreate/Update (with an
  `appointmentStatus` field; workflow statuses include New, Confirmed, Cancelled, Showed,
  No-show, Invalid), OpportunityCreate, NoteCreate and more.
- Webhooks are signed with an RSA key (`x-wh-signature`), with a timestamp and id against replays.

It would be a new integration of about the size of Outlook: a marketplace app listing,
OAuth, signed webhooks, sending through their conversations API, and their per-message
usage charges landing on the customer's bill. Not small.

## 6. The Marketplace tactic: a trust note

One team member described an old tactic: listing cheaper Hamilton townhouses on Facebook
Marketplace as if they were in Toronto, then calling only the people who left a phone
number. That draws curious people, not ready buyers, which may explain part of the 50%
no-show rate. **FollowUp is never designed to help with misleading ads** (CLAUDE.md: "never
designed as a spam tool, a scam, or an aggressive sales platform"). Whether this breaks
real-estate advertising rules is a legal question and is not answered here.

## 7. Options

| | What it means | Verdict |
|---|---|---|
| **Compete** | Rebuild calendars, pipelines, team reports, nurture campaigns | **No.** It turns FollowUp into a feature checklist against a $97–$497 suite (PRODUCT_DIRECTION rule 4). |
| **Sit beside, unconnected** | The team uses FollowUp for email/DMs and GoHighLevel for the rest | **Weak.** Their leads land in GoHighLevel, not the inbox, so FollowUp wouldn't see them. Double entry, which they already suffer with Excel. |
| **Connect, later** | FollowUp reads new leads, no-shows and unanswered calls from GoHighLevel, decides who needs what, drafts it, waits for an OK, and sends through GoHighLevel | **The only version that could work** — "keep GoHighLevel; FollowUp does the thinking it makes you build". Too big to do on one conversation. |

## 8. Recommendation

1. **Build no GoHighLevel connection now.** Correction (same day): an earlier draft said this
   team is "a different buyer". That was wrong. `PRODUCT_DIRECTION.md` (2026-09-26) makes
   teams first-class: "anyone with more leads than follow-up, solo or team". The team is in
   scope; only the GoHighLevel *connection* waits. What a call-first team needs from
   FollowUp itself (a one-tap "No answer" beside "We talked", rebooking no-shows, meetings
   per person per week) is listed for the founder in the 2026-10-07 diary and is his call.
2. **Revisit when 3 or more prospects or testers say they run on GoHighLevel.** Then the
   §5 integration is worth sizing. Until then, the evidence is one team.
3. **Carry one general lesson:** reminders weren't enough here; no-shows stayed at 50% even
   with them. If FollowUp ever handles meetings, the value is in **rebooking the no-show and
   telling serious buyers from curious ones**, not in another reminder.
4. **Next questions for the team** (in the founder's hands):
   - What exactly is hard in GoHighLevel? Watch them do one task on screen.
   - What do they pay a month, and who set it up (themselves or an agency)?
   - When someone doesn't show, does anyone rebook them, and how?
   - Which source shows up more: ads, Marketplace or referrals?
   - Roughly what does one closed deal earn them?

## Sources

- Learning curve, ease of use, real-estate gaps: [GHL Scale Up review](https://www.ghlscaleup.com/blog/gohighlevel-review), [reSimpli review for investors](https://resimpli.com/blog/gohighlevel-review-for-real-estate-investors/), [schedulingkit review](https://www.schedulingkit.com/reviews/gohighlevel-review), [AI Funnel Insider 2026](https://aifunnelinsider.com/gohighlevel-review-2026/), [Capterra listing (blocked; snippet only)](https://capterra.com/p/177156/HighLevel/reviews/?page=3)
- Pricing and usage: [GHL Experts plans](https://ghlexperts.com/gohighlevel-plans-pricing), [schedulingkit pricing](https://schedulingkit.com/pricing-guides/gohighlevel-pricing), [$97 plan limits](https://buttondown.com/gohighlevel/archive/gohighlevel-97-plan-limits/), [AI pricing explained (BotPenguin)](https://botpenguin.com/blogs/gohighlevel-ai-pricing), [rsla.io pricing 2026](https://rsla.io/blog/go-high-level-pricing)
- No-show and call-status workflows: [appointment status triggers (consultevo)](https://consultevo.com/gohighlevel-appointment-status-workflow-triggers/), [no-show recovery (ATJ)](https://automatethejourney.com/blog/no-show-recovery-appointment-based-businesses), [call status workflows (consultevo)](https://consultevo.com/gohighlevel-call-status-workflows/), [missed-call text-back (Omni)](https://omnionlinestrategies.com/blog/gohighlevel-missed-call-text-back)
- "Answered regardless" idea-board post (title only): [ideas.gohighlevel.com](https://ideas.gohighlevel.com/call-tracking/p/ghl-records-call-as-answered-regardless-of-the-contact-answering-or-not)
- Mobile app: [joinsecret reviews](https://joinsecret.com/highlevel/reviews), [GetApp Canada](https://www.getapp.ca/software/2058429/highlevel)
- Real-estate use and snapshots: [GHL Experts real estate](https://www.ghlexperts.com/industries/gohighlevel-for-real-estate), [SupplyGem](https://supplygem.com/gohighlevel-for-real-estate-agents/)
- API and webhooks: [OAuth 2.0 docs](https://marketplace.gohighlevel.com/docs/Authorization/OAuth2.0/index.html), [AppointmentUpdate webhook](https://marketplace.gohighlevel.com/docs/2023-02-21/webhook/AppointmentUpdate/index.html), [community SDK README](https://unpkg.com/@gnosticdev/highlevel-sdk@4.0.3/README.md)
