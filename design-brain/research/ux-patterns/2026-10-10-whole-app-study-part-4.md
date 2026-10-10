# Whole-app study, part 4: how familiar apps solve our five problems (2026-10-10)

**Asked:** *"start part 4"*, then *"I don't know what these are, but keep doing"* (about part 2's questions). Working
assumptions for those questions, each marked as an assumption:
1. Replies weren't sent because owners never saw them.
2. Page analytics are recommended on, after a price check.
3. Suggesting Automatic in setup is recommended, but it is a behaviour change, so the founder decides in part 5.

Page (private): https://claude.ai/artifact/AqxgcMNbj6fbjd2Az3XZ5N. Evidence grade B: help centres, Apple's and
WebKit's own pages, one study (UIE) and one paper (Lee & See). No competitor screen was used.

## Found while researching

**iPhone web push only works for web apps on the Home Screen** (WebKit, iOS 16.4+), and only after a tap to allow.
FollowUp knows this (`AlertsSection.tsx`) but says it in one small line inside Settings › Replies and check-ins, and
setup never asks. That explains why only one phone has alerts.

## Problem → lesson → suggestion

1. **The owner isn't reached.**
   - Follow Up Boss: phone alerts set up to stay on screen, a test button, and fewer duplicate channels.
   - Calendly: a text to the host's own phone, or an app push.
   - Superhuman: unanswered mail comes back to the inbox with a draft.
   - Wispr: the work happens in the apps you already use.
   - **Lesson:** for a busy owner the alert is the product. Make it work during setup, send it on one channel, and
     have it open the one decision.
   - **Suggestion:** setup asks how to reach you (push with a Home Screen walk-through, a text to your own phone at a
     small cost and the founder's call, or email), sends a test, then one alert per decision that opens that reply.
2. **One customer, three layouts.**
   - Linear Peek, Attio's record page set up once, Close's one timeline with "Next lead".
   - **Lesson:** one record, one layout, big or small.
   - **Suggestion:** one customer card everywhere.
3. **One decision split up.**
   - Apple's guidelines: options live where the task happens; settings are only for rare, app-wide choices; never
     duplicate.
   - **Lesson:** one home per decision.
   - **Suggestion:** one "who sends" choice; facts taught in the answer blank and reviewed in one list; one place for
     the plan.
4. **Settings is too big.**
   - UIE: under 5% of Word users changed any setting.
   - Apple's guidelines: keep settings few.
   - Wispr: two short groups.
   - **Lesson:** good defaults; Settings is a small room.
   - **Suggestion:** connections and three or four rules up front, the rest one level down.
5. **Good things are hidden.**
   - Lee & See 2004: how automation is displayed shapes how far people trust it.
   - Close: a timeline on each lead.
   - **Lesson:** what the automation did is one tap from the result.
   - **Suggestion:** "What FollowUp did" opens from Results and appears as a timeline on each customer; hot leads
     become a "Ready for you" group.

## Sources

- https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- https://help.followupboss.com/hc/en-us/articles/13057944487703
- https://updates.followupboss.com/en/streamlined-notifications-for-incoming-texts
- https://followupace.com/blog/checklist-for-setting-up-real-time-alerts-in-follow-up-boss
- https://calendly.com/help/how-to-send-text-messages-with-workflows
- https://help.superhuman.com/hc/en-us/articles/40144492186515
- https://community.ramp.com/t/notifications-reimbursement-vs-card-transactions/982
- https://linear.app/docs/peek
- https://attio.com/help/reference/attio-101/attios-data-model/understanding-records
- https://help.close.com/v1/docs/inbox
- https://developer.apple.com/design/human-interface-guidelines/settings
- https://archive.uie.com/brainsparks/2011/09/14/do-users-change-their-settings/
- Lee, J. D. and See, K. A. (2004), "Trust in Automation: Designing for Appropriate Reliance", *Human Factors* 46(1).
