# From first visit to "it caught someone I forgot": a benchmark

**Date:** 2026-09-25
**Lane:** product narrative. Research and recommendations only.
**Code read at:** `claude/followup-demo-to-production-4k39hr`, HEAD `b7b1f72`.
**Scope:** the path from the public site → sign-in → onboarding → connecting Gmail, Instagram and WhatsApp → the first real value, including every permission and consent moment on that path. The in-app screens (Today, leads, inbox) belong to another agent's pass. They appear here only where the first run lands on them.
**What changed:** this file, plus one line in `research-log.md`. No code, copy in code, component, page or token was touched. Nothing here is approved.
**The founder designs the UI.** Each recommendation says *what* should be true and *why*. None says how it should look.
**Open question this answers:** `ux-patterns/README.md` lists *"What makes an OAuth/permission request feel safe enough to accept?"* as unanswered. §4 (P2–P5, P11) is the answer, at medium confidence.

---

## In plain words

1. The best products do four things. They ask for one thing at a time. They say why right next to the button. They show the product working on *your* stuff in the first session. And a real person is there the first time.
2. FollowUp already gets a lot right. Sign-in asks only who you are. Every source is optional. The "nothing goes out behind your back" promise is true. Prices are public and flat. There's a safe test button.
3. FollowUp has something Calendly and Loom don't: your last 90 days of email. It can find a customer you forgot within minutes of connecting. It doesn't need a new lead to prove itself.
4. Today it doesn't show that. Onboarding ends on a number ("Found 18 leads already, 15 scored") and a Continue button. The first written reply can take until the next morning.
5. The scariest moment is Google's permission screen. It says "Send email on your behalf" and "View and edit events on all your calendars." FollowUp's screen just before it mentions neither.
6. Google's own advice is to ask for calendar access only when someone turns on a calendar feature. FollowUp asks for it on day one.
7. Owners who live on Instagram may tap your link inside Instagram. Google blocks sign-in inside Instagram's built-in browser. Nothing on the sign-in page warns them.
8. Superhuman's founder onboarded hundreds of customers himself before he built the self-serve version. With about ten hand-picked testers, Sahil can do the same.
9. The one safe demo, "Send a test lead to myself", reports a failure even when it worked. That was written up this morning and is still live.
10. Confidence is medium. Every outside source was read through search snippets, because direct page fetches are blocked here. Nothing was run or watched live.

## Top 5 recommendations (highest impact on activation first)

1. **Put the promise next to the Connect button.** "Google will ask to let FollowUp read and send email. Nothing is sent until you press send." Add a heads-up about Google's "unverified" warning. **S**, copy.
2. **End onboarding on one real person, not a number.** "Priya asked about the price 6 days ago. Nobody replied. Here's a reply. Send it?" This needs one yes from you: let FollowUp *write* drafts at any hour. It would still *send* only in the day. **M**.
3. **Sit in on each tester's first ten minutes.** Use a call or a screen share. Write down every pause. **S**, no code.
4. **Ask Google for less.** Ask for calendar only when booking is switched on. And if an owner unticks "send", say so plainly instead of failing later. **M**, your call.
5. **Unblock sign-in from Instagram's browser.** Detect Instagram's and Facebook's built-in browsers on the sign-in page and say "Open this in Safari or Chrome to sign in with Google." **S**.

---

## 1. The problem

- **Who:** an owner, not a software person, who got a link from Sahil. Usually on a phone, often between jobs. They have been pitched hard by lead-gen and "AI sales" tools before, so they arrive skeptical (`research/customers/2026-09-05-icp-pain-and-trust-objections.md`).
- **What they want:** proof that this finds the customers they forgot, before they trust it with their inbox and DMs.
- **When:** once, for about ten minutes. If the first ten minutes go badly, there is rarely a second visit.
- **If it goes badly:** we already know what that looks like. Manoj connected Gmail, got scared, and disconnected the next evening (`research/product/2026-09-25-first-run-hunt.md` §1).

**What matters right now.** Sign-up is invite-only (`PRODUCT_DIRECTION.md`, 2026-09-18; R-012). Every real user today arrives through Sahil, not through the site. So the recommendations for sign-in → consent → first value rank above the site ones. When the beta opens, the site recommendations move up.

## 2. What the repo already says (read first, not repeated)

| File | What it settles | How this report uses it |
|---|---|---|
| `followup/research/product/2026-09-25-first-run-hunt.md` | Code-level walk of the first run; exact wording fixes for the consent row, test lead, Access Denied, granular consent | Cited by section. Its wording is reused, not rewritten |
| `…/2026-09-24-simplify-the-app.md` | The one-minute bar; "hold drafts at any hour" (#10); drop team size | #10 is the unblocker for recommendation 2 |
| `…/2026-09-10-ux-simplification.md` §3 | The original "proof screen" idea | Recommendation 2 is that idea, updated for approval-first |
| `…/2026-09-13-usability-and-engagement.md` | First-week value and churn; gamification ruled out | Why no celebration or streaks on the proof screen |
| `…/2026-09-13-landing-page-research.md`, `…/2026-09-14-landing-page-company-strategy.md`, `design-brain/research/landing-page/2026-09-18-structure-v1.md` | Site mechanics, what competitors lead with, the approved page structure | Not re-researched. The site section here is only what's new |
| `…/2026-09-16-positioning-after-the-carrier-drop.md` | Who the product fits after the phone channels were dropped | ICP context |
| `design-brain/decisions/design-decisions.md` 2026-09-19 "Beta gates are said before the click" | Say who can connect *before* the button, not after a refusal | Recommendation 1 applies this decided principle to Google's screen |
| `design-brain/decisions/design-decisions.md` 2026-09-21 "Onboarding asks where the leads come from" | The three steps; the founder wants step 2 kept and skippable | Nothing here removes step 2 |
| `rejected.md` R-002, R-005, R-009, R-012, S-11, S-13 | Keyboard layers, dashboard heroes, request forms, 12px text, AI gimmicks | Checked against every recommendation (§7) |

## 3. FollowUp's path today, step by step

Read from the code at `b7b1f72`. Not run live.

| # | Screen | What it asks | What the owner reads | Trust earned / lost | Where |
|---|---|---|---|---|---|
| 0 | Landing | Nothing. Nine "Start free" buttons, counting the nav and the sticky bar | "Never lose a lead because you forgot to follow up." Under the button: "Free while in beta. No card. It follows up for you — nothing sends without your OK." | **Earned:** the promise sits at the first button. Prices are public. The FAQ names read, send and calendar. **Lost (small):** the FAQ's Instagram answer says FollowUp "replies by itself", which the beta hold makes untrue today | `src/app/page.tsx:44-66`, `:564-568` |
| 1 | Sign-in | "Continue with Google" | "FollowUp is in a private beta. Sign in with the Google account Sahil added." | **Earned:** names a person and is honest. **Lost:** a wrong Google account gets NextAuth's unbranded "Access Denied" page (still `pages: { signIn }` only, `src/lib/auth.ts:134-136`). Inside Instagram's browser, Google refuses sign-in outright (§5, T1) | `SignInClient.tsx:113` |
| 2 | Google account chooser | Pick an account | Google's words; name and email only | Fine. Identity, not access | — |
| 3 | Onboarding 1 | Business name (pre-filled "{name}'s Business"), industry, team size | "A couple quick questions and you're set up." | **Lost (small):** the name goes into messages to customers, and nothing says so. Industry is used, but the owner isn't told why | `OnboardingForm.tsx:332-382` |
| 4 | Onboarding 2 | Nothing. "Got it" or "Skip" | Three beats. The third: "Nothing goes out behind your back. Every message it writes waits for your OK…" | **Earned:** true, plain, no AI words. **Lost:** it is 12px text (`text-xs`), it can be skipped, and it sits one screen away from the button it is about | `:458-531`, body size at `:512` |
| 5 | Onboarding 3 | Connect Email / Instagram / Facebook / WhatsApp / website form | "Where do your leads come from?" Email row: "Gmail or Outlook — where most enquiries already land." | **Earned:** every source is optional, there's no row of Skip buttons, and the button says "Continue". **Lost:** the row with the button says nothing about sending, calendar, or Google's warning | `:227-307`; `OnboardingSources.tsx:186-216` |
| 6 | Google: unverified warning | Continue, or back | "Google hasn't verified this app" | **Lost** unless someone warned them first. Only Sahil's welcome text does | Testing mode (`docs/tester-onboarding-checklist.md`) |
| 7 | Google: permissions | Three checkboxes | "View your email messages and settings" · "Send email on your behalf" · "View and edit events on all your calendars" | **This is where Manoj's fear lives.** The calendar line comes with no context at all | `src/lib/integrations/gmail.ts:41-46`; wording per Google (§9, Grade B) |
| 8 | Back on step 3 | Nothing | "Pulling in your first leads…" then "Found 18 leads already, 15 scored." Then "Help improve FollowUp" (off) | **Earned:** the improve switch is a model of honest consent: off, one sentence, easy no. **Lost:** a count, our word "scored", and no next step | `:125-128`, `:408-429` |
| 9 | Today | Nothing | On a holding account: "FollowUp is watching your inbox. When a lead writes, it writes the reply and puts it in Approvals for you…" plus "Watching you@… — last checked…" | **Earned:** true, calm, with a live "watching" line. **Lost:** the queue stays empty until the next hourly check inside 08:00–18:00 business time. That defaults to New York and can't be changed yet | `dashboard/page.tsx:222-233`; `automation.ts:565` |
| 10 | First held draft | "Approve & send" | The card | **Earned:** a 10-second undo. **Lost:** the card just disappears. It never says "Sent" (first-run hunt §2.7) | `ApprovalQueue.tsx` |

**Count.** From "Start free" to Today there are eight screens (steps 1–8), three of them Google's. The first *written reply for a real customer* arrives at the next hourly check in business hours. After an evening sign-up, that means the next morning. None of this has been timed on a real run.

### What already works, so nobody "fixes" it

- **Identity first, access later.** Sign-in shares only name and email. Gmail is a separate, later ask. Google exempts basic sign-in from Testing-mode limits (first-run hunt §5). This is the P1 pattern below.
- **Invite-only is said on the sign-in card**, with a person's name and a contact address.
- **Step 2's third beat is true** and names the stop rule.
- **Every source is optional**, with no row of Skip buttons, and the main button says "Continue", not "Skip for now".
- **The Instagram and WhatsApp panels in Settings say who Meta lets connect, *before* the click** (decision 2026-09-19).
- **The import is scoped:** 90 days only, with promotions, social, updates and forums excluded (`gmail.ts:874`).
- **"Help improve FollowUp" is honest consent:** off by default, with one sentence on what it does today.
- **The site pre-discloses the three things Google will show.** The FAQ's "Is my data safe?" answer names reading, sending from your address, and calendar (`page.tsx:568`).
- **Public, flat prices, no card, no contract.** This is the opposite of Podium's documented complaints (P12).
- **"Send a test lead to myself" exists.** It is the right pattern (P7) with the wrong words (recommendation 6).
- **The first send has a 10-second undo.** The Disconnect confirm says it revokes access at Google.

---

## 4. What the best products do: the patterns

**Grades.** **A** = primary source read in full (none this pass; WebFetch returned `EGRESS_BLOCKED` for `developers.google.com` and `plaid.com`). **B** = primary source (the company's own docs or help, Google or Meta docs, a peer-reviewed paper), seen through a search snippet. **C** = third-party teardown, review site, news or partner docs, via snippet. **D** = one weak report, or attribution unclear. **[code]** = read in FollowUp's source, highest confidence. Every external claim was checked on 2026-09-25.

Each pattern: **what** works, **how** (the mechanism), the **strategy** behind it, the **evidence**, and **FollowUp today**. These are principles to apply, not screens to copy (S-16).

### P1. Ask who they are first. Ask for access later.
- **What:** sign-up is one click that shares only a name and an email. Inbox or calendar access is a separate, later step.
- **How:** HubSpot has you create the account first, then "Connect personal email" from Settings. Google treats sign-in-only scopes as a separate, lighter class.
- **Strategy:** the first yes is cheap. The expensive yes comes after the person has put in a little effort and knows what they're getting.
- **Evidence:** HubSpot KB "Connect your personal email" (B); Google OAuth overview (B, via first-run hunt §5).
- **FollowUp today:** does this. [code]

### P2. Ask for the smallest thing, at the moment it's needed.
- **What:** request each permission in context. Don't bundle them.
- **How:** Google's own best-practice page says to request scopes "incrementally, at the time access is required". Its example: an app "should not request Google Calendar access until the user presses the 'Add to Calendar' button". NN/g separates *context-related* requests, which users understand and accept, from *system-initiated* ones, which interrupt and are more likely to be refused. HubSpot owners complained in HubSpot's community about "intrusive privileges" (Drive access requested just to connect an inbox). HubSpot then changed each Google integration to "only request access to the minimum required functionality" (thread marked solved, 2024).
- **Strategy:** every extra line on a consent screen is one more reason to say no. A permission asked at the moment of use explains itself.
- **Evidence:** Google best practices (B); NN/g permission requests (B); HubSpot community thread and vendor reply (C).
- **FollowUp today:** asks for read, send and calendar on one screen at step 3 [code] (`gmail.ts:41-46`). Calendar is not mentioned anywhere in onboarding. The code already copes with a token that has no calendar access: Settings tells older accounts to "click Reconnect once to grant calendar access" (`settings/page.tsx:899-903`). So asking later is a path that already exists.

### P3. Say why next to the button, just before the hand-off.
- **What:** a short "here's what will happen and why", directly before the third-party screen.
- **How:** Plaid's pre-Link guidance says to explain that the user will be asked to link an account, what data you'll collect and why, the benefit, and that it's secure. Keep it short ("long blocks of text can reduce Link uptake"), and link to the privacy policy for more. Plaid's Data Transparency Messaging puts a one-line disclosure *above the Continue button*, with a "Learn more → Why is this needed" half-pane for detail. Tan et al. (CHI 2014, 772 smartphone users) found that permission requests with an explanation were significantly more likely to be approved. NN/g adds: in context, plain words, and a promise that the access won't be abused.
- **Strategy:** the Google or Meta screen uses *their* words, not yours. The owner reads those words with whatever you said last still in their head. So the last thing you say has to match the scariest line they're about to see.
- **Evidence:** Plaid docs (B); Tan et al. (B, peer-reviewed, abstract via snippet); NN/g (B).
- **FollowUp today:** the true sentence is on step 2. "Got it" and "Skip" both pass it. The Email row, the one with the button, says "where most enquiries already land". Google then shows "View your email messages and settings", "Send email on your behalf" and "View and edit events on all your calendars". (Those are Google's documented strings, Grade B via snippet. One screenshot would confirm them.) Sahil's welcome text to testers does this job well, but outside the product (`docs/tester-onboarding-checklist.md`).

### P4. Name what you don't touch.
- **What:** specific negatives beat general reassurance.
- **How:** Calendly says it "only checks the duration and status (free or busy)" of your events and doesn't store "who you're meeting with". SaneBox has a help page titled *"I don't want SaneBox reading my mail!"*, explaining that it reads headers only and never downloads message bodies.
- **Strategy:** "we take privacy seriously" is noise. "We never see who you're meeting" can be checked.
- **Evidence:** Calendly help (B); SaneBox help (B).
- **FollowUp today:** FollowUp reads whole messages, because it has to. It must never borrow SaneBox's "headers only" claim. But it has true, specific negatives it doesn't say at the button [code]:
  - It skips the promotions, social, updates and forums tabs, and it looks back 90 days (`gmail.ts:874`).
  - On every account today, nothing is sent until you press send (`holdAllForApproval` default).
  - On WhatsApp, personal chats such as family or the bank are set aside, not turned into leads (#325).
  - Nothing is ever texted automatically to someone who never wrote first (#327).

### P5. A partial yes is a real answer.
- **What:** when a user grants only some permissions, the app keeps working for what was granted and says plainly what's off.
- **How:** Google shows per-permission checkboxes whenever an app asks for more than one non-sign-in scope. Its guidance is to check which scopes were granted, disable only the affected feature, and explain. NN/g: rather than showing an error when a refused permission is needed, "explain why that functionality can't be used, and make it easy to grant access."
- **Strategy:** the owner who unticks "send" is the careful one, which is exactly the owner approval-first was built for.
- **Evidence:** Google granular permissions (B); NN/g (B).
- **FollowUp today:** doesn't read the granted scopes, so the first "Approve & send" fails with Google's raw error [code] (first-run hunt §2.6).

### P6. Show it working on their own stuff, in the first session.
- **What:** the first action *is* the aha moment.
- **How:** Loom builds onboarding around recording and sharing a first video within minutes. Linear's activation event, resolving a first issue, happens inside the onboarding session. Zapier's "test trigger" pulls a recent *real* record from your connected account, so you see your own data flow before anything goes live.
- **Strategy:** show value before doubt sets in. A count is inventory. A named person is value.
- **Evidence:** Loom (C, teardowns); Linear (C, Candu and Supademo teardowns); Zapier help (B).
- **FollowUp today:** FollowUp is ahead on the ingredients. The 90-day import is its Zapier test record, and it is real data. Calendly and Loom both need a second person before anything happens; FollowUp doesn't. But onboarding ends on "Found N leads, M scored" and Continue [code] (`OnboardingForm.tsx:125-128`). The first draft waits for the drafting window (`automation.ts:565`). This has been recommended three times (09-10 §3, 09-13, 09-24 #10) and is still not built.

### P7. A safe rehearsal when there's nothing real yet.
- **What:** a clearly labelled practice run.
- **How:** HubSpot seeds two contacts marked "(Sample Contact)". Follow Up Boss points trial users at a sample Lead Profile to practise on. ManyChat's "Preview → In Messengers" sends an automation to your own account before it goes live.
- **Strategy:** let people press the scary button where nothing is at stake.
- **Evidence:** HubSpot (C, third-party review); Follow Up Boss help (B); ManyChat help (B).
- **FollowUp today:** "Send a test lead to myself" is exactly this pattern. But on every holding account it reports "the reply didn't go out (check that Gmail is connected in Settings)", when in fact the reply is waiting for OK [code] (`test-lead/route.ts:74`, `:89`; first-run hunt §2.2).

### P8. Only ask what you'll use, and say what you'll do with it.
- **What:** each onboarding question should visibly change something.
- **How:** Notion asks what you'll use it for and shows about five matching templates. Jobber asks industry and team size to load defaults, and one teardown faults it for other questions (how you heard about it, annual revenue) that changed nothing.
- **Evidence:** Notion (C, Candu teardown); Jobber (C; the critique came from a third-party review, either connecteam.com or workyard.com — the snippet didn't say which).
- **FollowUp today:** industry *is* used. The classifier is told the inbox belongs to "a {industry} business", which helps it separate customers from noise [code] (`openai.ts:442`). The owner just isn't told that. The business name is pre-filled and goes into messages to customers (first-run hunt §2.9). Team size changes nothing the owner sees (09-24 §1.1).

### P9. A person at the first session. Build what you learn later.
- **What:** a human-led first session while the product is small.
- **How:** Superhuman ran 30-minute one-to-one onboarding calls. Its founder personally onboarded hundreds of customers before hiring specialists, and it took years more to move those lessons into self-serve screens. Follow Up Boss runs a daily 20-minute live "Bootcamp" for new users. Housecall Pro assigns onboarding specialists (reviews say within 48 hours).
- **Strategy:** at ten users, a person beats any screen. It is also how you learn what the screen should say.
- **Evidence:** First Round Review, two articles (B for the story; the "doubled activation" figure comes from a teardown and is not used); Follow Up Boss help (B); Housecall Pro (C).
- **FollowUp today:** Sahil adds each tester by hand and sends a good primer text. There is no live first session. The one tester who left took nineteen days to reconstruct from logs (first-run hunt §3.3).

### P10. Give the safe mode a name and keep it visible.
- **What:** users always know whether their actions are real.
- **How:** Stripe's sandbox works the moment you create an account, with no business details. A "Test mode" toggle is always visible, and test mode shows an orange banner.
- **Evidence:** Stripe docs (B); the banner detail comes from third-party guides (C).
- **FollowUp today:** the safe mode exists (every account holds every message), but it has no single name and isn't always on screen. Five lines in Settings still describe sending (first-run hunt §2.3). **Handed to the in-app pass.** It's noted here because it is what the owner meets in minute four.

### P11. Show the exit at the entrance.
- **What:** when someone connects, say how to disconnect and what that does.
- **How:** Plaid Portal lets consumers see every app connection, what each can see, and disconnect it.
- **Evidence:** Plaid consumer help (B).
- **FollowUp today:** the Disconnect confirm says it revokes access at Google (`settings/page.tsx:705`). That's true and good, but it is only seen when leaving.

### P12. The counter-example: sell first, onboard later.
- **What goes wrong:** Podium sells through demos and annual contracts. Its reviews are strong on the software (G2 about 4.6) and weak on the business (Trustpilot about 1.5). Complaints include being told during onboarding that cancelling would be easy.
- **Evidence:** review aggregators (C).
- **FollowUp today:** the opposite: public prices, no card, no contract. Keep it that way. It's a trust asset, not only a price.

**Asked about, but nothing distinctive found:** Front (14-day trial, no card, the first person becomes admin; nothing specific on consent) and Housecall Pro beyond P9. That's said here so nobody assumes they were skipped.

---

## 5. Traps particular to this owner

### T1. Google refuses sign-in inside Instagram's and Facebook's built-in browsers
- Since 2021, Google has blocked sign-in from "embedded webviews". Users see *"403: disallowed_useragent — Google can't sign you in safely inside this app."* Developer reports repeatedly name the Instagram, Facebook and Messenger in-app browsers (Google Developers Blog and Google help, B; developer issues, C).
- FollowUp's buyer lives on Instagram. NAR's 2025 technology survey ranks social media as realtors' top lead-generating technology, at 39% (on file: `followup/research/customers/2026-09-13-what-leads-actually-say-first-contact-patterns.md`, Finding 6). Sign-in is Google-only, and `SignInClient.tsx` does nothing to detect these browsers.
- **Also, for engineering:** the Capacitor wrapper loads the live site in a WebView (`mobile/capacitor.config.ts`, `server.url`). If it ships as-is, Google sign-in inside it will very likely be refused. Not tested.

### T2. WhatsApp's connect flow needs two screens
- Meta's "coexistence" signup shows a QR code on screen. The code has to be scanned by the phone that runs WhatsApp Business. Partner docs describe it as a computer-plus-phone flow (C).
- An owner onboarding *on that phone* can't scan their own screen.
- The onboarding row says "The number already in the WhatsApp Business app on your phone." Settings says "Have the phone … ready — you'll scan a code with it" (`WhatsAppConfig.tsx:320`). Neither says "do this step from a computer".
- WhatsApp may not be open to testers yet (tester checklist), so the impact is low today.

### T3. On email alone, Google already gives part of this away free (Rule 4)
- Gmail's "Nudges" ("Received 3 days ago. Reply?") has been free since 2018 (C).
- Superhuman's Auto Drafts (July 2026) writes replies in your voice and keeps a human approval step (Superhuman help, B; TechCrunch, C).
- So "you forgot to reply to Priya" *on Gmail* is not enough of a first-value moment. FollowUp's has to carry what those don't: the reason in plain words, the DM channels, the reply in the customer's language, and the stop-when-they-reply rule.

### T4. Google asks testers to re-consent every seven days
- Already on file (first-run hunt §2.1). Each re-consent is another trip through Google's screen.
- Google verification is the only real fix (`docs/google-verification-pack.md`). Until then, P3 matters weekly, not once.

---

## 5a. Four routes to first value, and which to take

The research workflow asks for genuinely different options before a recommendation.

| Route | How it works | Good at | Gives up |
|---|---|---|---|
| **A. The proof screen** | After connecting, show one real person from their own past who is waiting on them, with a reply already written | Real, specific, in the first session. Plays to the asset nobody else has (the backlog) | Needs drafts written outside the send window. An empty inbox gets nothing |
| **B. Rehearsal first** | "Send a test lead to myself" before any connect | No permission needed first. Always works | It isn't their customer. It proves the machinery, not the value |
| **C. A person** | Sahil is there for the first ten minutes | Highest trust. Learns *why* people stop | Doesn't scale past a few dozen testers |
| **D. Wait** (today) | "Watching your inbox" until a new lead arrives | Honest and calm | Depends on luck. Can take days |

**Recommendation:** A and C now, with B as A's fallback when the inbox is quiet. D is what happens when nothing is done.

---

## 6. Recommendations, ranked by impact on activation

| # | What | Effort | Type | Principle | Rule |
|---|---|---|---|---|---|
| 1 | The promise and the warning next to the Connect button | S | Copy with UX weight | The promise travels with the button (P3, P4) | 3 · table stakes |
| 2 | End onboarding on one real person, with a reply waiting | M | UX, plus one behaviour call | Prove it on their own past (P6) | 1 + 3 · partly moat |
| 3 | Sahil sits in on each tester's first ten minutes | S | Process | A person first (P9) | 3 · table stakes |
| 4 | Ask Google for less; treat a partial yes as an answer | M | Behaviour, founder's call | Smallest ask, in context (P2, P5) | 3 · table stakes |
| 5 | Unblock sign-in from Instagram's and Facebook's browsers | S | UX + small code | The door opens where they already are (T1) | table stakes |
| 6 | Make the test lead tell the truth | S | Copy | A rehearsal reports what happened (P7) | 3 |
| 7 | Make the trust sentences readable | S | Visual, founder's call | S-11 | 3 |
| 8 | Brand the "Access Denied" page | S | Config | No dead ends on someone else's page | table stakes |
| 9 | Say why each onboarding question is asked | S | Copy | Ask only what you use (P8) | 3 |
| 10 | Tell WhatsApp owners to use a computer for the connect step | S | Copy | T2 | table stakes |
| 11 | Stop the site and Instagram panel promising sends the hold doesn't allow | S | Copy, founder's call | Say only what's true today | 3 |
| 12 | Bring Privacy and Terms up to date with the product | S–M | Legal, founder's call | Consent needs accurate documents | 3 |
| 13 | Hide the "Meta console reference" from owners | S | UX | Principle 9 | table stakes |
| 14 | *Question:* say "by invitation" next to "Start free"? | S | Copy, founder's call | Set expectations before the hand-off (P3) | — |
| 15 | Time "Two minutes to connect" once, or drop the number | S | Copy | Never claim what you haven't measured | 3 |

### 1. The promise and the warning next to the Connect button (S)
**What should be true.** On the row with the Connect button, in one or two lines at a readable size:
- what Google will ask for: *"Google will ask to let FollowUp read and send email."*
- the guarantee: *"Nothing is sent until you press send."*
- the beta heads-up: *"Google will warn that FollowUp isn't verified yet. That's expected in the beta."*
- a "What can FollowUp see?" link that opens four short lines, all true today: the last 90 days; it skips promotions and newsletters; nothing is sent until you press send; disconnect any time and Google access ends too. (The Plaid "Why is this needed" pattern, and P11.)

After connecting: *"Connected as {email}. Nothing is sent from it until you press send."*

Apply the same pattern to:
- the Settings Gmail row, which still says "Required — FollowUp reads sales conversations… to score leads and draft replies" (`settings/page.tsx:863`). "Required" is false, and sending isn't mentioned.
- the Instagram and Facebook rows in onboarding. They lack the Meta tester line that the Settings panels already carry.

The guarantee line must change for an account that has granted sending (first-run hunt §2.1 shows how).

**Why.** P3 and P4. It also applies the decided principle "beta gates are said before the click" (2026-09-19) to the one gate that was missed: Google's own warning.
**Builds on:** first-run hunt §2.1. That wording is good; use it. New here: the specific-negatives link, the Meta rows, and the outside evidence.
**Checks:** no AI words (S-13). Step 2 stays (the founder asked for it). This is *not* the landing-page "channel line" the founder declined on 2026-09-18; this lives on the connect row. Needs a `design-decisions.md` entry when shipped.

### 2. End onboarding on one real person, with a reply waiting (M)
**What should be true.** After the first sync, the owner sees one real person from their own conversations who is waiting on them. They see the reason in plain words, a reply already written, and one way to read and send it. One person, not a list and not a count. Up to two more names underneath at most. If there is no one: one honest sentence, plus "Send a test lead to myself" (which must then tell the truth; see recommendation 6).

**Which person.** The most recent customer who wrote last and got no reply. Not a months-old thread, and never a batch. FollowUp's own reactivation code says someone ignored for months is owed an apology and a real answer, not "still interested?" The drafting handles that, but the first impression shouldn't lead with it. If a DM channel is connected and has such a person, prefer them. That is the catch Gmail's free Nudges can't make (T3).

**The one behaviour call (yours).** Let FollowUp *write* drafts at any hour. The send window would keep gating *sending* only. This is 09-24 #10 and 09-16 §5; the gate is at `automation.ts:565`. Without it, the proof screen is empty after about 6 pm New York time. **This decision, not design, is why this idea has sat unbuilt for fifteen days.**

**Measure it.** Add "First reply sent" as a fifth count on the /admin tester funnel. Today the funnel stops at "First lead" (`admin/page.tsx:91-93`). "First lead" is inventory; "first reply sent" is value.

**Why.** P6 (Loom, Linear, Zapier's real test record); NN/g on starter content.
**Builds on:** 09-10 §3, updated. That version said "FollowUp already replied for you". On today's accounts it must say "wrote a reply — it's waiting for you."
**Checks:** this is not a dashboard hero (R-005 and R-009 are about the landing hero). No sparkle and no "AI found…" (S-13). No celebration, confetti or streak (09-13 ruled out gamification). No "send all" (brand principle 7). Not subtraction (R-001).

### 3. Sahil sits in on each tester's first ten minutes (S, no code)
**What.** For each new tester, Sahil is on a call or a screen share from "Start free" to the first reply sent. He stays quiet unless asked, and notes every pause. Afterwards he asks the neutral question from 09-24 §3: *"What did you expect FollowUp to do, and what did it do instead?"* The interview guide is already written (`followup/research/customers/2026-09-15-owner-interview-guide.md`).
**Why.** P9. With about ten testers, this is the cheapest way to raise activation. It is also the only way to learn why owners stop, because nothing records sign-ins or reasons today (first-run hunt §3.3).
**Cost.** About twenty minutes per tester. It stops scaling at a few dozen testers. By then, the screens should say the things Sahil keeps finding himself saying.
**Checks:** these are invited testers, not strangers, so R-012 doesn't apply.

### 4. Ask Google for less; treat a partial yes as an answer (M, your call)
- **(a) Calendar later.** Drop calendar from the first Gmail connect, and ask for it when the owner turns on booking. The reconnect-for-calendar path already exists. Google's screen then shows two lines instead of three, and neither one is a surprise.
- **(b) Read what was granted.** At connect, check which permissions Google actually gave. If "send" is missing, say: *"Connected for reading. FollowUp can write replies, but Google wasn't allowed to send them. Reconnect and allow sending when you're ready."* (first-run hunt §2.6). The approve button then says the same thing instead of failing.

**Why.** P2 and P5, with Google's own guidance behind both.
**Honest limit.** This reduces *fear*, not paperwork. `gmail.readonly` is a restricted scope and needs the full review either way (`research/integrations/2026-09-06-gmail-oauth-verification.md`).
**Check first:** does any tester use booking? If none do, the case for (a) is stronger.

### 5. Unblock sign-in from Instagram's and Facebook's browsers (S)
**What.** When the sign-in page is opened inside Instagram's, Facebook's or Messenger's in-app browser, show a line above the Google button: *"Google doesn't allow sign-in inside Instagram. Tap ⋯ and choose 'Open in browser'."* Add a copy-link button. Add the same line to the tester welcome text.
**Why.** T1. For whoever hits it, this is a complete block, and it happens on Google's page, so FollowUp never gets to explain.
**Unverified:** whether any tester has hit it, and how WhatsApp opens links (it depends on the phone and its settings).

### 6–15, briefly
6. **Make the test lead tell the truth (S).** When the reply was held, say so: *"Test lead added. FollowUp wrote a reply and it's waiting for your OK at the top of Today."* The wording is ready in first-run hunt §2.2. It is still live at `test-lead/route.ts:74`, `:89`.
7. **Make the trust sentences readable (S, your call on size).** The step-2 beats and every source-row line are `text-xs`, which is 12px (`OnboardingForm.tsx:512`; `OnboardingSources.tsx:112`, `:198`, `:223`). S-11 sets 14px for real content. The sentence written to prevent another Manoj is the smallest text on its screen.
8. **Brand the "Access Denied" page (S).** It needs one line of config: `pages.error: "/signin"` (first-run hunt §2.5). `auth.ts:134-136` still has only `signIn`.
9. **Say why each question is asked (S).**
   - Name: *"This name goes in messages to your customers."* Stop pre-filling it (first-run hunt §2.9).
   - Industry: *"So FollowUp can tell a customer's message from everything else."*
   - Team size: ask it later (09-24).
10. **WhatsApp needs a computer (S).** On both WhatsApp rows: *"Do this from a computer. You'll scan a code with the phone that has WhatsApp Business."*
11. **Stop promising sends the hold doesn't allow (S, your call).**
    - The FAQ's Instagram answer says *"Inside that time, FollowUp replies by itself"* (`page.tsx:567`).
    - The Instagram panel says new DMs *"get the instant reply, automatically"* (`InstagramConfig.tsx:163`).
    - "As it happens" says *"FollowUp sends something for you"* (`page.tsx:422`).
    - Your 2026-09-22 call deliberately left *pitch* lines alone. But the FAQ's first answer was changed precisely so the page wouldn't contradict itself (comment at `page.tsx:557-563`), and the Instagram answer is a reply to a *rules* question. That makes it the one line still doing the contradicting.
12. **Bring Privacy and Terms up to date (S–M, you or a lawyer).**
    - The privacy page is dated September 10 (`privacy/page.tsx:39`).
    - Both pages say sending happens only on Send "or when you've explicitly turned on automated sending for a specific lead" (`privacy:66`, `:74`, `:154`; `terms:43-45`). Settings now also has an account-wide "Let FollowUp send without asking" (2026-09-22).
    - Privacy lists Twilio for WhatsApp (`:186`), but WhatsApp now connects through Meta on the owner's own number.
    - It says whole-account deletion is by email within two business days (`:161-167`), while Settings → Your data offers export and permanent delete (`settings/page.tsx:1834-1843`).
    - There is no Outlook section (this matters only if Outlook is live).
    - Careful owners read this page before granting access, and so do Google's and Meta's reviewers. Rewriting legal text isn't this lane; this is a flag.
13. **Hide the "Meta console reference" from owners (S).** Every owner's Instagram and WhatsApp panel has a collapsed toggle showing a webhook URL and a verify token (`InstagramConfig.tsx:296-327`; `WhatsAppConfig.tsx:390+`). It is a developer tool on an owner's screen (principle 9).
14. **Question: say "by invitation" next to "Start free"? (S, your call).**
    - Every "Start free" (nav, hero, how it works, works with, three price cards, closing band, sticky bar) lands on "FollowUp is in a private beta."
    - R-012 set that route and bans request forms. Nothing here adds one.
    - The only question is whether the hero note should carry three more words ("By invitation for now") so a stranger isn't surprised. P3 says yes. The hero note is your own wording (2026-09-22), so it's your call.
15. **"Two minutes to connect" (S).** The site promises two minutes twice (`page.tsx:137`, `:157`). From sign-in there are about eight screens, three of them Google's. Time one real run and keep the number only if it holds.

**Handed to the in-app pass, not ranked here:** a single named, always-visible "safe mode" (P10), and a "Sent" confirmation after the first approve (first-run hunt §2.7).

---

## 7. What I would not do (checked against `rejected.md`)

- **No product tour or swipe-through cards.** NN/g found that tutorials make tasks *feel* harder with no gain in success. Step 2 is three beats; keep it three.
- **No keyboard layer or ⌘K introduction**, even though Linear's onboarding leads with one. That's R-002: this owner isn't at a keyboard.
- **No waitlist, "request access" form or email capture on the site**, even though Superhuman ran a famous waitlist. That's R-012.
- **No fake sample leads mixed into a real account.** HubSpot's "(Sample Contact)" works because it's labelled and CRM data is low-stakes. Here, a made-up customer beside real ones is a trust risk. The test lead to yourself is the right form.
- **No "AI found 18 leads!", confetti or streaks** (S-13; gamification ruled out on 2026-09-13).
- **No "Send all" as the first action** (brand principle 7).
- **No dashboard mockup, product screenshot or person photo in the hero** (R-005, R-009, R-011). No testimonials or logo strip. No change to the approved headline or buyer line (A-013, A-014, A-015).
- **No per-channel honesty line on the landing page.** The founder said no on 2026-09-18. It lives on the connect rows instead (recommendation 1).
- **No quoting of any number from this report on a screen.** See §8.

## 8. What I'm unsure about, and what I could not verify

- **Nothing was run.** No screenshot and no live Google or Meta consent screen were seen. Google's permission wording is Grade B via a snippet of Google's own page; one screenshot confirms it.
- **WebFetch was blocked** (`developers.google.com` and `plaid.com` both returned `EGRESS_BLOCKED`). Every outside claim comes from search snippets and is graded in §9.
- **The in-app browser block (T1)** is well documented as a Google policy. Whether any tester has actually hit it is unknown, because there's no analytics for it. How WhatsApp's link-opening behaves varies by phone and wasn't checked.
- **Whether the mobile wrapper ships** at all, and whether it would use a system browser for sign-in.
- **Instagram's "Allow access to messages" toggle.** ManyChat's guides say third-party tools need it switched on in the Instagram app. I couldn't confirm whether Instagram's newer login flow, which FollowUp uses, needs it too. If it does, that's another step no FollowUp screen mentions.
- **Whether Outlook is live in production.** Recommendation 12's Outlook point depends on it.
- **Whether writing drafts at night has a cost problem.** It's the same number of drafts, written earlier; the cost files (`2026-09-15-ai-cost-per-lead.md`) weren't re-checked.
- **The ranking is judgement.** Recommendation 3 could sit first: it's zero-code and immediate. It sits third only because 1 and 2 keep working after the beta grows.
- **Numbers seen and deliberately not used,** so no later session cites them as findings:
  - Superhuman "65% full migration / doubled activation" (a teardown's claim).
  - "Quick wins retain 80% more users" (vendor blog).
  - Superhuman Auto Drafts "40% sent within a day, 60% of those unedited" (a vendor figure reported by TechCrunch).
  - "12% more likely / 81% lift" for explained permissions (an aggregator, source unclear; the underlying peer-reviewed finding is cited qualitatively instead).

## 9. Sources (all checked 2026-09-25, via WebSearch snippets)

**Google**
- [OAuth best practices](https://developers.google.com/identity/protocols/oauth2/resources/best-practices): incremental, in-context scopes; the Calendar example; handling refusals. **B**
- [Granular permissions](https://developers.google.com/identity/protocols/oauth2/resources/granular-permissions): checkboxes; check what was granted. **B**
- [Gmail API scopes](https://developers.google.com/workspace/gmail/api/auth/scopes): "View your email messages and settings", "Send email on your behalf". **B**
- [Calendar API auth](https://developers.google.com/calendar/api/auth): "View and edit events on all your calendars". **B**
- [Unverified apps](https://support.google.com/cloud/answer/7454865) and [brand verification](https://developers.google.com/identity/protocols/oauth2/production-readiness/brand-verification): the unverified screen comes before consent; unverified branding means fewer authorisations and more revocations. **B**
- [Embedded webview block](https://developers.googleblog.com/upcoming-security-changes-to-googles-oauth-20-authorization-endpoint-in-embedded-webviews/) and [remediation](https://support.google.com/faqs/answer/12284343). **B**
- [firebase-js-sdk #4421](https://github.com/firebase/firebase-js-sdk/issues/4421) and [TrueLink](https://truelink-group.com/en/blog/why-google-login-fails-in-line-facebook-in-app-browsers-2026/): the Instagram and Facebook in-app browser failures. **C**

**Plaid**
- [Pre-Link messaging](https://plaid.com/docs/link/messaging/). **B**
- [Optimizing Link conversion](https://plaid.com/docs/link/best-practices/). **B**
- [Data Transparency Messaging](https://plaid.com/docs/link/data-transparency-messaging-migration-guide/). **B**
- [Plaid Portal](https://support-my.plaid.com/hc/en-us/articles/4420182916375-How-can-I-view-and-manage-app-connections-made-using-Plaid). **B**

**Nielsen Norman Group and research**
- [Permission requests](https://www.nngroup.com/articles/permission-requests/). **B**
- [Onboarding tutorials vs. contextual help](https://www.nngroup.com/articles/onboarding-tutorials/). **B**
- [Empty states](https://www.nngroup.com/articles/empty-state-interface-design/). **B**
- Tan et al., [CHI 2014](https://dl.acm.org/doi/10.1145/2556288.2557400): explanations significantly raise approval; 772 users. **B**

**Products**
- Calendly: [Your privacy and security](https://calendly.com/help/your-privacy-and-security). **B**
- SaneBox: [I don't want SaneBox reading my mail!](https://www.sanebox.com/help/412-privacy-and-security-i-don-t-want-sanebox-reading-my-mail); [Permissions](https://www.sanebox.com/help/36-permissions-needed-for-sanebox-to-work). **B**
- HubSpot: [Connect your inbox](https://knowledge.hubspot.com/connected-email/connect-your-inbox-to-hubspot) (**B**); [intrusive-privileges thread](https://community.hubspot.com/t5/Account-Settings/Gmail-Inbox-Connection-requires-intrusive-privileges-can-it-be/td-p/750704) (**C**); [sample contacts](https://marcandrews.com/hubspot-free-crm-review-2026-worth-it-for-uk-businesses/) (**C**).
- Stripe: [Set up your account](https://docs.stripe.com/get-started/account/set-up) (**B**); [test-mode banner](https://www.temperstack.com/learn/stripe/switch-test-live-mode/) (**C**).
- Superhuman: [First Round, human-led to self-serve](https://review.firstround.com/inside-superhumans-onboarding-strategy-from-human-led-to-self-serve/) and [onboarding playbook](https://review.firstround.com/superhuman-onboarding-playbook/) (**B**); [Auto Drafts help](https://help.superhuman.com/hc/en-us/articles/46005658551053-Auto-Reminders-Auto-Drafts) (**B**); [TechCrunch, 2026-07-14](https://techcrunch.com/2026/07/14/superhumans-new-auto-draft-feature-almost-makes-me-like-ai-replies/) (**C**).
- Loom: [Supademo teardown](https://supademo.com/user-flow-examples/loom); [Appcues GoodUX](https://goodux.appcues.com/blog/looms-targeted-onboarding). **C**
- Linear: [Candu teardown](https://www.candu.ai/blog/linear-onboarding-teardown); [Supademo](https://supademo.com/user-flow-examples/linear). **C**
- Zapier: [Set up your Zap trigger](https://help.zapier.com/hc/en-us/articles/8496288188429-Set-up-your-Zap-trigger); [How Zap triggers work](https://help.zapier.com/hc/en-us/articles/8496244568589-How-Zap-triggers-work). **B**
- Notion: [Candu teardown](https://www.candu.ai/blog/how-notion-crafts-a-personalized-onboarding-experience-6-lessons-to-guide-new-users). **C**
- Jobber: [Pricing, no-card trial](https://www.getjobber.com/pricing/) (**B**); [Connecteam review](https://connecteam.com/reviews/jobber/) and [Workyard review](https://www.workyard.com/compare/jobber-review) (**C/D**: the unused-questions critique came from one of these; the snippet didn't say which).
- Housecall Pro: [Capterra](https://www.capterra.com/p/140363/HouseCall-Pro/); [Connecteam](https://connecteam.com/reviews/housecall-pro/). **C**
- Follow Up Boss: [Free trial](https://help.followupboss.com/hc/en-us/articles/4414594545303-Getting-Started-with-a-Follow-Up-Boss-Free-Trial); [20-minute Bootcamp](https://help.followupboss.com/hc/en-us/articles/360014690973-Training-The-Follow-Up-Boss-20-minute-bootcamp). **B**
- Podium: [G2 pros and cons](https://www.g2.com/products/podium/reviews?qs=pros-and-cons); [FieldCamp review](https://fieldcamp.ai/reviews/podium/); [WiserReview](https://wiserreview.com/blog/podium-alternatives/). **C**
- Front: [Quickstart](https://help.front.com/en/articles/2194). **B**
- ManyChat: [Preview automations](https://help.manychat.com/hc/en-us/articles/14281198254620-How-to-preview-automations-in-Manychat); [Connect Instagram](https://help.manychat.com/hc/en-us/articles/14281290924444-How-to-connect-Instagram-to-Manychat). **B**
- WhatsApp coexistence: [Meta, onboard Business app users](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users) (**B**, title and snippet); [respond.io](https://respond.io/help/whatsapp/whatsapp-coexistence) and [ChakraHQ](https://chakrahq.com/article/issues-whatsapp-coexistence-onboarding-setup) (**C**).
- Gmail Nudges: [9to5Google, 2018](https://9to5google.com/2018/05/14/new-gmail-web-nudge-ai-reminders/); [Mailmeteor](https://mailmeteor.com/blog/gmail-nudges). **C**

**FollowUp code (first-hand at `b7b1f72`)**
- `src/app/page.tsx`
- `src/app/signin/page.tsx`
- `src/components/landing/SignInClient.tsx`
- `src/components/landing/dark/{NavDark,StickyCta}.tsx`
- `src/lib/auth.ts`
- `src/app/onboarding/page.tsx`
- `src/components/{OnboardingForm,OnboardingSources,ImproveFollowUpToggle,InstagramConfig,WhatsAppConfig}.tsx`
- `src/app/(app)/settings/page.tsx`
- `src/app/(app)/dashboard/page.tsx`
- `src/lib/integrations/gmail.ts`
- `src/lib/automation.ts`
- `src/lib/integrations/openai.ts`
- `src/app/admin/page.tsx`
- `src/app/{privacy,terms}/page.tsx`
- `mobile/capacitor.config.ts`
- `docs/tester-onboarding-checklist.md`
- Commit messages #325 and #327
