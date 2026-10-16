# Make Activity a quiet, short record

*Research report for FollowUp, 16 October 2026. Question: what should the Activity page keep, remove and add, for busy solo realtors who use it mostly on a phone?*

Activity should be a short, calm record of what FollowUp did on its own. Nothing on it should be urgent. A row may offer an optional next step, but anything the owner must act on belongs on Today, plus a buzz on the phone. Every kind of product we looked at splits things this way: CRMs, real-estate AI tools, automation tools, banking apps and AI assistants. Each keeps "needs you" in one place and history in another. Research on alerts finds that repeats, not volume, are what make people stop looking. FollowUp's own numbers fit: **95 of the old bell's 108 lines repeated Today, and only 31 of 108 were ever opened** ([R-116](../design-brain/decisions/rejected.md)). So the proposed drawing is mostly right. Remove the "Held a reply for you" lines. Remove the tabs. Keep "Sent on its own" and the stopped and finished rows. But change three things. First, fold routine sends into one line per day that opens to the list. Second, move the "Needs you" box to Today. Activity then records a problem only after it is fixed. This changes an approved decision (A-256), so it needs the founder's yes. Third, skip a separate "coming up next" line. Instead, each sent row says what happens next. Today's "Later" section already has a line for tomorrow, and a Coming up page exists. One warning: the researchers read almost every vendor page only through search snippets. The strongest evidence here is Apple's and Microsoft's design guidelines, which were read in full, and a few peer-reviewed studies. No study has tested an activity page for realtors.

## How strong each piece of evidence is

Four research notes fed this report. They covered CRM and lead tools, automation tools and banking feeds, AI assistants, and UX research. **The network blocked most vendor help centers.** Follow Up Boss, HubSpot, Pipedrive, Lofty, Ylopo, Zapier, IFTTT, Stripe, Monzo and Apple Support pages were all seen only as search-engine summaries. A summary can paraphrase a page while seeming to quote it. No researcher saw a live screen of any product, so nothing here describes an observed UI. Only Apple's Human Interface Guidelines and Microsoft's HAX guideline library were read in full and quoted word for word. NN/g, Google PAIR and arXiv papers were blocked, so those claims come from abstracts or from other sites that quote them.

| Label | What it means | How much weight to give it |
|---|---|---|
| **Study** | Peer-reviewed experiment or field study | Strongest, but none studied realtors or activity pages |
| **Preprint** | Research not yet reviewed (arXiv) | Useful signal, not settled |
| **Guideline** | Apple HIG, Microsoft HAX, design-system rules | Expert consensus, not a measured result |
| **Product docs** | A vendor's own help page (seen through a snippet) | Shows what a product does, not whether it works |
| **Vendor claim** | Marketing or blog | Treat as marketing |
| **Third-party** | Reviews, guides, partner blogs | Lower reliability |
| **Anecdote** | Forum posts, one-off incidents | A story, not a pattern |
| **FollowUp data** | Production counts given in the brief or the design brain | Direct, but small (8 outside testers) |

## Every product we studied keeps "needs you" out of the history

### CRMs and real-estate AI tools put the full record on the person

The lasting record in CRMs is the customer's own timeline, not a global feed. **Follow Up Boss splits each lead's timeline into 8 tabs by type of message** (Product docs, snippet) ([FUB Help](https://help.followupboss.com/hc/en-us/articles/9538400649495-Lead-Profile-Overview)). When an automated email fails, its help page tells agents to check the earliest timeline event on that person. That suggests there is no separate failure log (Product docs, snippet) ([FUB Help](https://help.followupboss.com/hc/en-us/articles/4402377886743-Why-did-my-action-plan-email-fail-to-send)). Pipedrive splits each record into "Focus" (what is next) and "History" (what happened). Its phone app leads with Focus: today's and next week's activities (Product docs, snippet) ([Pipedrive KB](https://support.pipedrive.com/en/article/focus-view-in-the-mobile-app)). HubSpot keeps three separate places. It has a filterable timeline per record, an admin log per workflow, and a personal feed with notifications (Product docs, snippet) ([HubSpot KB](https://knowledge.hubspot.com/records/filter-activities-on-a-record-timeline)). Workflows reach a person only through a "send notification" step or a "needs review" state (Product docs, snippet) ([HubSpot KB](https://knowledge.hubspot.com/user-management/how-to-set-up-user-notifications-in-hubspot)).

Raw automation logs are treated as admin tools and kept out of sight. **Pipedrive keeps automation history for 15 days, and only on the Advanced plan or higher.** Its users complain that the log doesn't even name the contact each run touched (Product docs and Anecdote, snippet) ([Pipedrive KB](https://support.pipedrive.com/en/article/workflow-automation-history); [Pipedrive Community](https://community.pipedrive.com/discussion/17699/ability-to-search-automation-history-automation-log-for-leads-deals-people-etc)). HubSpot keeps workflow action logs for 90 days (Product docs, snippet) ([HubSpot KB](https://knowledge.hubspot.com/workflows/workflow-enrollment-history)). Lofty, a real-estate CRM, puts its AI agent's full activity log under **"Sales Agent settings > Activity"**, not in the main navigation. Its overview shows counts instead: leads engaged, outreach sent, lead updates (Product docs, snippet) ([Lofty Help](https://help.lofty.com/hc/en-us/articles/39659584983067-Getting-Started-with-AI-Sales-Agent)). GoHighLevel shows every wait, branch and error in its execution logs. It is built for agencies that build automations, and that level of detail is the "fake complexity" FollowUp's brand rules forbid (Third-party) ([GHL Scale Up](https://www.ghlscaleup.com/blog/gohighlevel-enrollment-history-execution-logs)).

The real-estate tools keep the "needs you" signal rare on purpose. **Ylopo reserves priority texts "only for high-value opportunities"** and adds a note to the contact for each one (Product docs, snippet) ([Ylopo Help](https://ylopo.zendesk.com/hc/en-us/articles/360021902531-Priority-Leads)). BoldTrail keeps two things apart: an event being recorded, and the agent being pinged. Its alert switches "only toggle the notifications to YOU" (Product docs, snippet) ([BoldTrail Help](https://help.insiderealestate.com/en/articles/3332635-boldtrail-behavioral-automation-overview)). A stop on reply is treated as good news, not as an alert. **In Close, an incoming reply pauses the workflow and "is counted as a conversion"** (Product docs, snippet) ([Close Help](https://help.close.com/docs/workflow-reporting)). Follow Up Boss has a box that pauses a plan "when the lead responds" (Product docs, snippet) ([FUB Help](https://help.followupboss.com/hc/en-us/articles/1500008539982-Action-Plans-Overview)). Close puts system changes in a separate "Log" tab beside the conversation, so the default view stays human (Product docs, snippet) ([Close changelog](https://close.com/changelog)).

### Automation tools sort outcomes three ways and send problems outside the log

Zapier's run log is built for builders and has about eleven statuses. The useful lesson is how they group. Some runs are done. Some runs were deliberately not done, and that is normal ("Safely halted", "Filtered"). Some runs are broken or waiting on you ("Errored", "On hold", for example because an app account is disconnected) (Product docs, snippet) ([Zapier Help](https://help.zapier.com/hc/en-us/articles/20505304170637-Review-run-statuses-in-Zaps)). Problems reach the user mainly outside the log, by email. Zapier switches a Zap off automatically if it fails 95% of the time over 7 days (Product docs, snippet) ([Zapier docs](https://docs.zapier.com/platform/manage/error-handling)). One trust lesson: **users received Zapier error emails with no matching entry in their history**, which confused them (Anecdote) ([Zapier Community](https://community.zapier.com/how-do-i-3/zap-gets-email-error-but-there-s-nothing-in-the-task-history-7572)). Make keeps failed runs in their own "Incomplete executions" list, where each can be fixed and retried, apart from plain History (Product docs, snippet) ([Make Help](https://help.make.com/manage-incomplete-executions)).

IFTTT, the most consumer-facing of the three, is the closest model for FollowUp's owners. **Its single Activity feed shows only the last few days, up to 100 items.** It uses four plain verbs: ran, failed, skipped, deleted. It shows service connections and disconnections in the same feed. Its help page explains that "skipped" "isn't necessarily a problem" (Product docs, snippet) ([IFTTT Help](https://help.ifttt.com/hc/en-us/articles/115004914234-How-to-use-the-IFTTT-Activity-feed)).

### Banking apps group by day, fold repeats and show what is coming

Banking feeds share one shape. Items run newest first under date headers, with a clear name for who was paid. **Monzo folds upcoming bills into one incoming and one outgoing item "so they don't take up much screen space"** (Vendor claim, engineering blog) ([Monzo blog](https://monzo.com/blog/how-we-unified-our-customers-activity-on-the-new-home-screen)). Older Monzo material showed tomorrow's Direct Debits at the top of the feed (Vendor claim, 2018) ([Monzo blog](https://monzo.com/blog/2018/08/15/manage-your-bills-with-monzo)). Wealthsimple's activity view includes "upcoming scheduled activities" (Vendor claim) ([Wealthsimple](https://product-news.wealthsimple.com/meet-our-re-designed-wealthsimple-app-appui)). Tasks live apart from the feed. Mercury shows approvals "in their list of tasks" (Vendor claim) ([App Store](https://apps.apple.com/app/id1491984028)). Stripe's Home page carries open items such as disputes, while its event logs sit in a separate developer area (Product docs, snippet) ([Stripe Docs](https://docs.stripe.com/dashboard/basics)). On the phone, **Stripe sends a daily summary push instead of asking merchants to browse events.** It also keeps a 30-day "Sent emails" list on each customer's record, so merchants can see what Stripe sent for them (Product docs, snippet) ([Stripe mobile](https://docs.stripe.com/dashboard/mobile?locale=en-GB); [Stripe Billing emails](https://docs.stripe.com/billing/revenue-recovery/customer-emails)).

### AI assistants show their work on the thing they changed, not in a feed

None of the email assistants found has a separate "what the AI did" page: not Superhuman, Fyxer, Gmail, Copilot in Outlook or Shortwave. The proof sits on the email itself: a label, a draft in the thread, or a thread brought back to the top. Most of them also avoid sending on their own (Product docs, snippet) ([Superhuman Help](https://help.superhuman.com/hc/en-us/articles/50229742688659-Superhuman-Mail-for-Gmail); [Fyxer Help](https://support.fyxer.com/en/articles/12051599-your-first-5-steps-in-fyxer-a-workflow-guide)). FollowUp does send, so it sits closer to agent products. **Lindy, a workflow-agent tool, added filters for just two things: "errored" and "unread"** (Vendor claim, changelog) ([Lindy changelog](https://www.lindy.ai/changelog)). In other words: what is broken, and what I haven't seen.

Apple's history with Shortcuts shows the balance in practice. iOS 15.4 added a "Notify When Run" switch so people could silence routine automations. iOS 17 then required a notification again for some types (Third-party) ([Cassinelli](https://www.matthewcassinelli.com/shortcuts-beta-adds-notify-when-run-toggle-to-hide-automations-summary-view/); [Cassinelli](https://matthewcassinelli.com/automations-run-immediately-shortcuts-notifications)). So pinging on every routine action became noise, but no record at all was not acceptable either. Google's full "My Activity" log is tucked into account settings as an audit tool, not an everyday screen (Product docs, snippet) ([Google Help](https://support.google.com/accounts/answer/54068)). SaneBox's daily digest sends **nothing at all when nothing new happened** ("You won't receive a Digest if there's no new activity") (Product docs, snippet) ([SaneBox Help](https://www.sanebox.com/help/170-daily-digest-how-to-guide)). The reported trust failures concern AI that acted wrongly or without asking, not missing logs. In one incident a founder disconnected her email after an assistant sent a message without checking first (Anecdote, date unverified) ([AI Incident Database](https://incidentdatabase.ai/cite/1674)).

| Product | Where "needs you" lives | Where the full record lives | Repeats |
|---|---|---|---|
| Follow Up Boss, Pipedrive, HubSpot, Close | Focus, notifications, "needs review" | Each customer's timeline | Not documented |
| Lofty, Ylopo | Rare priority alert | AI log under Settings; counts on overview | Counts, not rows |
| Zapier, Make | Email; separate fix-it list | Technical run log | Not folded (Zapier) |
| IFTTT | Same feed (failed, disconnected) | Short feed, ~100 items | Not documented |
| Monzo, Stripe, Mercury | Home open items; task list | Date-grouped feed; per-customer "Sent emails" | Upcoming bills folded into one line (Monzo) |
| Email assistants, Lindy | Label on the email; "errored" filter | The thread itself | Not documented |

*All rows rest on product docs or vendor pages seen through search snippets.*

## Repeats, not volume, teach people to stop looking

The best-measured cause of ignored alerts is repetition. In a study of health-record alerts sent to 112 primary-care clinicians, **the chance a reminder was accepted fell 30% for each extra reminder in a visit, and 10% for each five-point rise in the share of repeated reminders.** The study found no effect from workload itself (Study, via search) ([Ancker et al. 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5387195/)). Apple's guidelines say the same in plain words: "Avoid sending multiple notifications for the same thing… people may turn off all notifications from your app" (Guideline) ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/notifications)). FollowUp has two numbers of its own. The old bell repeated Today in 95 of 108 lines and was opened 31 times ([R-116](../design-brain/decisions/rejected.md)). Among outside testers' held-reply lines over 30 days, **17 of 61 repeated the same customer and reason within a day** (FollowUp data). That second case has since been folded into one line a day ([design-decisions.md, 2026-10-16](../design-brain/decisions/design-decisions.md)). The risk is concrete. A list that mostly repeats Today teaches the owner to skip it, and then the one line that matters ("Gmail disconnected") gets skipped too.

There is also such a thing as too much explanation. In Kizilcec's CHI 2016 study, people who got a surprising result trusted the system less unless it explained itself. But **"providing too much information eroded this trust"**, and people whose expectations were met did not care either way (Study, via abstract) ([Kizilcec 2016](https://www.cs.mcgill.ca/~jeromew/data/COMP766/CHI2016/p2390-kizilcec.pdf)). In a pre-registered study with 3,800 participants, people shown a fully transparent model were *less* able to spot its big mistakes. The authors blame information overload (Study, via abstract) ([Poursabzi-Sangdeh et al. 2021](https://arxiv.org/abs/1802.07810)). For FollowUp this means a routine send needs almost no words. A stop, a skip or a failure needs its reason close at hand.

Guidelines agree on what each automated action should let a person see, and they map onto FollowUp's five brand questions. Microsoft's HAX guidelines say "Make clear why the system did what it did" (G11), "Make it easy to edit, refine, or recover when the AI system is wrong" (G9), "Make it easy to dismiss" (G8), and "Display information relevant to the user's current task" (G4) (Guideline, read in full) ([Microsoft HAX](https://www.microsoft.com/en-us/haxtoolkit/library/)). Agent-transparency research adds the part most logs leave out: what happens next. **In the SAT model studies, people trusted an agent most, and understood the situation best, when it showed predicted outcomes on top of its actions and reasons.** But a later review found that some extra transparency made performance worse (Study, via search) ([Mercado et al. 2016](https://journals.sagepub.com/doi/reader/10.1177/0018720815621206); [DST Group TR-3413](https://www.dst.defence.gov.au/sites/default/files/publications/documents/DST-Group-TR-3413.pdf)). So a short "next: Thursday, unless she writes first" helps. A long forecast does not.

Things that need action and things to read later should live apart. NN/g separates action-required notifications from passive ones. It warns that passive items "are easily missed" (Guideline, via a secondary source; wording unverified) ([NN/g](https://nngroup.com/articles/indicators-validations-notifications); [UMass guide](https://design.umassp.edu/node/111)). Apple's interruption levels treat "an account security issue" as Time Sensitive, not passive. Apple also says to "Use an alert — not a notification — to display an error message", and never to rely on a badge alone for essential information (Guideline) ([Apple HIG, Managing notifications](https://developer.apple.com/design/human-interface-guidelines/managing-notifications); [Apple HIG, Notifications](https://developer.apple.com/design/human-interface-guidelines/notifications)). A disconnected Gmail is that kind of issue. It cannot live only on a page the owner visits at leisure.

Other findings are thinner, but they point the same way. Design systems say an empty screen should say why it is empty and what happens next. NN/g's three rules are to show system status, teach the system and offer a path to key tasks (Guideline, via search) ([NN/g](https://www.nngroup.com/videos/empty-states-in-application-design-guidelines/); [SAP Fiori](https://www.sap.com/design-system/fiori-design-web/v1-96/foundations/best-practices/global-patterns/designing-for-empty-states)). Apple's list guidance favours short rows, grouped under headers, with details on a separate screen (Guideline) ([Apple HIG, Lists](https://developer.apple.com/design/human-interface-guidelines/lists-and-tables)). **No rigorous evidence shows that "you saved X hours" recaps help.** One VC author says he believes usage digests work but has no data (Anecdote) ([Boldstart](https://boldstart.vc/resources/email-product-adoption-reporting-metrics/)). Finally, a log is not a safety net. In one survey of 300 people overseeing an AI agent, people often preferred the agent's leakier reply, and **harmful disclosure rose from 15.7% to 55.0%** (Preprint) ([Zhang et al.](https://arxiv.org/abs/2411.01344)). Safety comes from holds on Today and from careful defaults. Activity's job is to answer afterwards: "What did FollowUp say to Ana, and why?"

## The drawing is mostly right, with three changes

| Drawing choice | What the evidence says | Strength | Verdict |
|---|---|---|---|
| Remove "Held a reply for you" lines | Every product keeps held or escalated items in one queue (Intercom's Escalated folder, Ylopo priority, HubSpot "needs review", Make's fix-it list). Repeats drive ignoring (Ancker, Apple). FollowUp's 95/108 and 17/61. | Study + Guideline + Product docs + FollowUp data | **Supported.** A held reply may show once, after the owner deals with it, as plain history ("You sent Dana's reply"). |
| Remove the tabs | Filters exist in desktop CRMs. Documented phone screens are single lists (Pipedrive Focus, IFTTT). Lindy's only filters are "errored" and "unread". | Product docs | **Supported.** With the list short and repeats folded, nothing is left to filter. |
| Keep "Sent on its own" | It is the one thing a solo owner can't otherwise see. Peers mark automated sends (Front labels AI-sent replies; Stripe's "Sent emails"). | Product docs + Third-party | **Supported, but refine.** Fold routine sends into one line per day ("Sent 6 check-ins · Ana, Raj, Mei and 3 more"), as Monzo does with bills. Tap opens the list. Each person opens the exact message and the reason. |
| Keep "stopped" and "finished" rows | Peers treat stop-on-reply as success and record it on the person (Close, FUB). Zapier and IFTTT call deliberate non-runs normal. Kizilcec: surprises need their reason. | Product docs + Study | **Refine.** Keep both, one line each. "Stopped: Priya wrote back" reads as good news. "Finished Raj's check-ins. No reply." is the one stop that carries a choice (call, or let go), so give it one action. Both also belong on the customer's page. |
| "Needs you" box on top of Activity | Needs-action and history should live apart. Passive pages are "easily missed". Errors call for an alert. R-116's own principle is that a place must show something no other place shows. | Guideline + Study | **Contradicted in part.** Problems (Gmail lost, a reply that couldn't go, a customer who is back) belong at the top of Today and in a phone buzz. Activity should record them once fixed ("Gmail disconnected 9:14 · reconnected 9:20"). This changes A-256, so it needs the founder's yes. |
| A "coming up next" line | Showing what happens next raised trust (SAT). Monzo and Wealthsimple show upcoming items. But FollowUp already has a Coming up page, and Today's "Later" section already gives one line each to Tomorrow and to what FollowUp does on its own ([A-266](../design-brain/decisions/approved.md)). | Study + Vendor claim | **Weakly supported as a separate line.** Better: each sent row ends with its own next step ("Next: Thursday, unless she writes first"). Use a separate line only in the empty state. |

Two smaller points refine the drawing. Activity should not carry a count badge on its tab. Apple says badges are for unread notifications, and Activity is passive reading ([Apple HIG](https://developer.apple.com/design/human-interface-guidelines/notifications)). And the wording should state what FollowUp *did*, never an outcome it cannot know. People disputed Intercom's automatic "resolved by Fin" stamps after a human had replied (Anecdote) ([Intercom Community](https://community.intercom.com/fin-product-feedback-member-group-49/fin-s-flawed-resolution-assumption-10516)).

## What the Activity page should look like on a phone

Here is the recommendation in plain words. Activity answers one question: "What did FollowUp do while I was busy?" Nothing on it is urgent. A row can offer an optional next step, like calling a customer who never replied, but anything the owner must act on goes on Today and buzzes the phone.

```
Activity
What FollowUp did for you. Nothing here needs you.

TODAY
  Sent 6 check-ins · Ana, Raj, Mei and 3 more        ›
  Stopped Priya's check-ins. She wrote back.          ›
  Gmail disconnected 9:14 · reconnected 9:20.
     2 check-ins went out after you fixed it.         ›

YESTERDAY
  Sent 4 check-ins · Dana, Leo and 2 more             ›
  Finished Raj's check-ins. He never replied.
     Call Raj or let go?                              ›
```

Tapping "Sent 6 check-ins" opens six short rows. Each row shows the name, the channel and the time. Tapping a name opens that customer, with the exact message, why FollowUp sent it, and what happens next ("Next: Thursday, unless she writes first"). That answers the five brand questions without crowding the list: what happened, why, what I can do, what FollowUp recommends, and what needs me (nothing, here).

The page keeps about two weeks of days. Older history lives on each customer's page, where peers keep it too. No study sets the right length. IFTTT keeps about 100 items, Pipedrive 15 days and HubSpot 90 days, so two weeks is a judgment call for the founder. Days with only routine sends stay one line. Anything unusual gets its own line: a stop, a finish, a failure or a fixed problem.

The empty state says what is going on, in one line. When nothing happened: "Nothing sent yet today. Next check-in: Thursday." When something is broken: "Nothing could go out. Gmail is disconnected." That line links to the fix on Today. The two must never look the same. Weekly totals ("12 people followed up, 4 replied") belong in Results, not here. No "hours saved" number, because nothing proves it helps and it would be an estimate, not a count.

## Conclusion

The evidence moves the question. It is not "what should Activity show?" but "what should *only* Activity show?" The answer is narrow: the sends FollowUp made on its own, and the moments it chose not to send. Everything else already has a home. Needs-you items live on Today and in the buzz. The full story lives on each customer's page. Totals live in Results. Activity is worth keeping because it is the owner's way to check FollowUp's work afterwards. That job gets harder with every repeated or duplicated line, and FollowUp's own data shows owners stop reading such lists.

The biggest tension is with A-256. The bell's jobs were moved onto Activity so they would not be lost. The research says those jobs are exactly the kind that a passive page loses. If Today can carry a short problem line at the top, the problems belong there, and Activity becomes purely history. If the founder prefers to keep them on Activity, the box must show only what Today doesn't, disappear when empty, and be backed by a buzz. Either way, nothing urgent should depend on the owner happening to open Activity.

## Keep, remove, add

**Keep**
1. "Sent on its own" sends, folded into one line per day that opens to the list.
2. "Stopped: they wrote back", one plain line, read as good news.
3. "Finished the check-ins, no reply", with one optional next step (call, or let go).
4. Day headers (Today, Yesterday, dates) and the plain one-sentence intro.
5. A link from each row to the customer's page, with the exact message and the reason.

**Remove**
6. "Held a reply for you" lines. Today already shows them. At most, show one line after the owner deals with it.
7. The tabs and filters.
8. The "Needs you" box on top. Problems move to the top of Today plus a buzz (needs the founder's yes, since A-256 approved them on Activity).
9. Any count badge on the Activity tab.

**Add**
10. "What happens next" at the end of each sent customer row ("Next: Thursday, unless she writes first").
11. Problem history once fixed: "Gmail disconnected 9:14 · reconnected 9:20 · 2 check-ins went out after."
12. Two different empty states: "nothing happened" and "something is broken".
13. A two-week window on Activity. The full history stays on the customer's page.

## Open questions for the founder

1. **Where do problems live?** Should "Gmail disconnected", "a reply couldn't go" and "a customer is back" move to the top of Today (changing A-256), or stay in a box on Activity?
2. **How far back?** Is two weeks of history on Activity right, or do you want more?
3. **Finished check-ins:** should "no reply after the last check-in" offer "Call" and "Let go", or just inform you?
4. **Coming up:** is the row-level "Next: Thursday" enough, or do you also want one "coming up" line on Activity, even though Today's "Later" section already has a Tomorrow line and a Coming up page exists?
5. **Daily summary:** do you want an optional end-of-day buzz or email ("Sent 6 check-ins, 1 person wrote back"), sent only when something happened? Nothing proves it helps, so it would need a small test.
6. **Spot-check:** before any of this becomes product copy, should someone with normal web access open the Follow Up Boss, Lofty, Monzo and IFTTT pages cited here? They were read only through search snippets.
