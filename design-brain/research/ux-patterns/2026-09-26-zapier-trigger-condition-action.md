# Zapier: trigger → condition → action, made simple for a business owner

**Date:** 2026-09-26 · **Asked by:** Sahil · **Status:** STUDIED, proposals pending approval

**Question:** How does Zapier make automation understandable ("when this happens, do that")? Where does it get too
technical for a small-business owner? Where should FollowUp borrow the good part, and simplify?

Sources are Zapier's own help and blog pages plus third-party reviews (listed at the end). help.zapier.com is blocked
from this environment, so its wording comes from search results. These are principles only. We don't copy any
screens.

---

## What Zapier does

- **One sentence is the whole model.** "When this happens, do that." Every Zap is one trigger and one or more actions.
- **Conditions are separate, optional steps:**
  - A **filter** stops the run when the data doesn't match. It has no "else".
  - **Paths** are if/then branches. They're a paid tier, and a Paths step must be the last step.
- **Templates pick the trigger for you.** Starting from a template means the hardest choice is already made.
- **You can test each step on real data.** Zapier pulls a real sample and shows what the action would do before the
  Zap goes on. The catch: testing an action is live and "may result in changes made in your app".
- **Zap history** logs every run with its status (success, filtered, errored) and the data that went through each step.
- **"Describe it in words" (Copilot):** "When X happens, do Y, then do Z" becomes a draft Zap you then check.
- **Failure handling:** after repeated errors the Zap turns itself off and sends an email.

### Where it gets too technical (the part we must not copy)

- Reviewers say non-technical users "need to customize logic and map fields", and that error logs are "intimidating and
  jargon-heavy".
- The turn-off email is often missed. It lands in a folder, or goes to an inbox nobody watches. So automation stops
  silently, and the owner finds out later.
- Branching (Paths) is where the "if this, then that" simplicity breaks down, and it's also where the cost and the
  confusion are.

### The principles underneath

- **P1: One sentence per rule.** "When ___, FollowUp ___." If a rule can't be said in one sentence, it's too complex
  for the owner.
- **P2: Conditions read as "unless" and "stops when".** The owner doesn't build conditions; the rule states them.
- **P3: Start from a ready-made rule, not a blank builder.** Pick, then adjust one number.
- **P4: See an example before it's on, never live.** Show what it *would* write for a real customer, and send
  nothing.
- **P5: Every rule has a record.** "This week: wrote 12, you sent 9, 3 are waiting."
- **P6: A rule that can't run says so where the owner looks.** Not in an email they'll miss.
- **P7: No branching and no flowchart for the owner.** That's where Zapier stops being simple.

---

## Where FollowUp stands (checked in main, 2026-09-26)

**FollowUp already *is* trigger → condition → action, but the owner can't see the shape.**

| Trigger (when) | Condition (unless / stops when) | Action (FollowUp does) | Where it lives now |
|---|---|---|---|
| A new customer writes | Hold all for OK; price or sensitive waits | Instant acknowledgement | Settings toggle "Instant reply to new leads" |
| A customer writes and you haven't answered | Same holds; backstop after N hours | Reply within minutes | Toggle "Reply for me when I haven't" + an hours field |
| A customer goes quiet after you wrote | Stops when they answer or you mark "We talked" | Up to 4 check-ins on days 3, 7, 14, 30 | Toggle "Auto follow-up on silence" + "First reminder after" |
| 45 days of silence on both sides | Once only | Reactivation message | Toggle "Reactivate cold leads" + days field |
| You put a customer on a plan | Stops when they reply | Steps in hours: email or change stage | Separate page, "Follow-up plans" |

**What's good already:**
- The summary sentence "Right now FollowUp drafts … and waits in Approvals" (Settings).
- "Your rules" (A-041) lists the conditions as sentences.
- "What FollowUp did" on each person.

**What's hard:**
- **The rules are toggles with our names on them:** "Auto follow-up on silence", "Reactivate cold leads", "Reply for
  me when I haven't". The owner has to translate each one into what actually happens.
- **The trigger, condition and action for one rule sit in three places:** the toggle, "Your rules" (the price hold),
  and the summary sentence.
- **Follow-up plans is a Zapier-style builder:** "hours after enrollment", "Send email / Change stage", "Proposal
  Sent". It's a blank editor, it counts in hours, and it duplicates the default check-ins. (A-027 already folds it
  into Settings as a plan card.)
- **There's no example before a rule goes on,** and no per-rule record ("this rule wrote 12 this week").
- **When a rule can't run, the owner only finds out on each person's page, one lead at a time.** This happens with
  nothing connected to send from, a closed Instagram window, or sending paused. The rule itself looks "on".

---

## Proposals (ranked)

1. **Rules as "When → FollowUp →" sentences (P1, P2).** Replace the four toggles with four rule cards. Each card has
   one sentence, one switch, and the one number that matters, which you can edit in place. For example:
   - **When a customer writes**, FollowUp writes a reply within minutes. *Anything about price waits for you.*
   - **When they go quiet after you wrote**, FollowUp checks in on day **3**, 7, 14 and 30. *Stops the moment they
     answer.*
   - **When nobody has written for 45 days**, FollowUp writes one welcome-back message.
   - **When a new customer writes for the first time**, FollowUp says thanks right away.

   Each "unless" and "stops when" line comes from the same settings "Your rules" reads, so the card and the list can't
   disagree. This is presentation only: the same settings behind new words.
2. **"See an example" on each rule (P4).** One tap shows what this rule would write for a real recent customer. It's
   marked as an example and never sent. It uses the drafting that already exists, so it's one model call per tap.
   *Model cost is Sahil's call.*
3. **A one-line record under each rule (P5):** "This week: wrote 12 · you sent 9 · 3 waiting". It's counted from the
   audit trail that already exists, only real numbers, and hidden when it's zero.
4. **A rule that can't run says so on the rule, and on Today (P6).** For example: "Paused: nothing is connected to
   send from. Connect Gmail." It's the same facts the person page already computes, raised to where the owner looks.
   No email only.
5. **Follow-up plans become "Pick a plan, change a day" (P3, P7).** This is the plan card from A-027:
   - Three ready plans: After a quote, After a no-show, Seasonal check-in.
   - Each is shown as a short timeline (Today · Day 2 · Day 7).
   - Days, not hours.
   - "Change stage" moves into the step as "and mark them Contacted".
   - No blank builder by default; "Start from scratch" becomes a quiet link.
6. **Later, Sahil's call: "Tell FollowUp in a sentence".** For example, "Don't follow up on weekends" would map onto
   the settings that already exist, with a preview to confirm before anything changes. It's only listed here because
   Zapier Copilot does it. It changes product behaviour and adds model cost, so it isn't proposed now.

**Guardrails:**
- No flowchart, nodes or branching for the owner (P7).
- No "trigger", "action", "filter", "Zap" or "workflow" words on screen. The owner sees "When", "FollowUp" and
  "Stops when".
- No live test that sends anything (Zapier's own warning). Examples are never sent.
- No AI sparkle or chat builder (S-13).
- Every number comes from real records (A-023).

**Rejected-list check:** clean. Nothing here re-proposes R-001 to R-018. It keeps A-041 ("Your rules") and extends
A-027 (plans fold into Settings).

---

## Sources

- Zapier help:
  - [Learn key concepts in Zaps](https://help.zapier.com/hc/en-us/articles/8496181725453-Learn-key-concepts-in-Zaps)
  - [Filters](https://help.zapier.com/hc/en-us/articles/8496276332557-Add-conditions-to-Zap-workflows-with-filters)
  - [Paths](https://help.zapier.com/hc/en-us/articles/8496288555917-Add-branching-logic-to-Zap-workflows-with-Paths)
  - [Filter and path rules](https://help.zapier.com/hc/en-us/articles/8496180919949-Filter-and-path-rules-in-Zap-workflows)
  - [Test Zap steps](https://help.zapier.com/hc/en-us/articles/18811411817741-Test-Zap-steps)
  - [Troubleshoot errors](https://help.zapier.com/hc/en-us/articles/8496037690637-How-to-troubleshoot-errors-in-Zap-workflows)
  - [Copilot](https://help.zapier.com/hc/en-us/articles/23503999825421-Build-Zap-workflows-faster-using-AI-powered-Copilot-Beta)
  - [Generate Zaps with AI](https://help.zapier.com/hc/en-us/articles/15703650952077-Use-the-power-of-AI-to-generate-Zap-workflows)
- Zapier blog and pages:
  - [Paths](https://zapier.com/blog/zapier-paths-conditional-workflows/)
  - [Get started](https://zapier.com/blog/get-started-with-zapier/)
  - [Troubleshoot Zaps](https://zapier.com/blog/how-to-troubleshoot-zaps/)
  - [Templates](https://zapier.com/templates)
- Zapier Community: [Zaps turning off automatically](https://community.zapier.com/how-do-i-3/zaps-turning-off-automatically-8150)
- Automation Ace: [Why does my Zap turn off](https://automationace.com/blog/why-does-my-zap-turn-off-automatically)
- Reviews:
  - [FounderAutomation: Zapier for small businesses](https://founderautomation.com/zapier-review-for-small-businesses/)
  - [Capterra reviews](https://www.capterra.com/p/130182/Zapier/reviews/)
  - [Lindy review](https://www.lindy.ai/blog/zapier-review)
