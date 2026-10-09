# The app strategy: four places, each built on a pattern people already use (2026-10-09)

**Asked by the founder:** *"what is our strategy? Let's make a strategy with the help of references and the laws that
big companies use, to make the user experience more simple, accurate, to the point, minimal and easy to learn. Let's
try to copy the stuff that is on the market and is used on a regular basis by the customers, so that they can adopt
it. They can get it quickly with their brain… We'll be having an analytics dashboard where we'll be showing them what
FollowUp did for them. What they need to do should be in Today. What they need, who all their customers are, their
settings."* Earlier the same day: *"I want to make it more simple."*

**Builds on, not repeated:**
- `2026-10-03-laws-of-ux-applied.md`: the ten rules.
- `2026-10-09-whole-app-simple-and-learnable.md`: learnability evidence and the measured screens.
- `2026-10-04-today-inbox-customers.md`: the two-places decision.
- The reference studies: Todoist, Calendly, Stripe, Mercury, Close, Macro, Superhuman, Linear, Wispr.

**Evidence grade:** B for the principles; the app's own numbers are measured. Mobbin (a library of real app screens)
needs a paid plan, so the market patterns below come from the apps' help pages and reviews, and from patterns every
phone user knows.

---

## The strategy in one paragraph

FollowUp has **four places, each with one job**. Each is built on a pattern the owner already uses every day, so
there is nothing to learn. FollowUp does the work and carries the complexity (Tesler). Each screen shows only what
the owner must decide or wants to know, says each fact once, and has one thing to press (Hick, Miller, Von Restorff).
It all uses the homepage's look and words, so the product feels like one thing from the first visit.

## "Copy what's on the market": what that means for us

We borrow **how things work**, never **how a company's screen looks**. Patterns that every phone owner already
knows:
- a list you tap into;
- a chat with your message at the bottom;
- a tab bar;
- a grouped settings list;
- a weekly report.

These are Jakob's law: people expect a new app to work like the ones they use most. A copied screen is something
else. It's against our rules (CLAUDE.md: "never copy a reference"), it's a legal risk, and it doesn't make anything
easier to learn. The pattern does that.

## The four places

| Place | Its one job | The everyday pattern it borrows | On the screen, at most | Not on it |
|---|---|---|---|---|
| **Today** | What needs me now | A to-do app's "Today" (Reminders, Todoist): a short list with an end. A message already written, waiting for Send, like a draft in Gmail or WhatsApp. | One headline (the count). One customer: their message, FollowUp's reply, Send / Edit, three quiet links. One "Next" line. "All done" at the end. | Any count said twice, charts, everyone else's messages |
| **Customers** | Who all my customers are | WhatsApp's chat list, the phone's Contacts | Search on top. One list in order of who needs you. Each row: name, channel icon, last message, state. Tabs only when they have people. | Table chrome, empty tabs, menus, counts said twice |
| **Results** *(the "Numbers" page, A-066, back in the menu)* | What FollowUp did for me | A bank app's balance first; Screen Time's weekly report; Square's "today vs the same day last week" | One sentence (how fast customers heard back). Four numbers beside last week: answered, qualified, booked, won by you. An 8-week chart. A quiet list. | Anything estimated ("time saved" until it can be measured), vanity counts |
| **Settings** | Change how it works | The iPhone's Settings: grouped lists, one row per setting, switches for on/off, tap to go deeper | Six groups at most. One line per row. The one broken thing at the top. | Explanations longer than a line, a link grid |

Two things that aren't places:
- **A customer** is a page you open from Today or Customers: a chat thread, with FollowUp's reply waiting with Send.
  Facts sit behind "Details".
- **Alerts** come as phone notifications ("Nadia is ready"); tapping one opens that customer.

**Menu:** Today · Customers · Results · Settings. Four tabs on the phone, the same four in the desk sidebar. That is
under iOS's five-tab limit, and every tab has a word.

**This changes A-082 and A-027.** Those made two places plus Settings and took Numbers out of the menu. The
founder's message asks for an analytics place, so Results becomes the third place. That is his call, recorded here.

## The Wispr Flow lesson: the work happens where you already are

**Founder:** *"we have to make them feel like they are using the app that they daily use, and Wispr Flow has a very
good user experience too."*

**What Wispr Flow's app does** (its help docs and reviews; grade B):
- **It works in every app.** You hold one key in any app, speak, and the text appears there. Its main surface isn't
  its own window.
- **Its own app is a quiet hub.** Home has a welcome line with your total, your history grouped by day, and a small
  stats card. Then Dictionary (your words), Snippets, Style. A small floating bar is always there and never in the
  way.
- **Setup has you try it in a real app, not a demo.** Pick an action, pick an app you have, and it opens that app so
  you start speaking. Reviewers praise how it walks through permissions one at a time.

**What that means for FollowUp:**
1. **The work reaches the owner in the apps they already use.**
   - A phone notification ("Nadia is ready", "Ivy is waiting 2 h") opens straight to that reply with Send.
   - Replies go out from the owner's own Gmail, WhatsApp or Instagram, so the customer sees the owner, not
     FollowUp.
   - Never a one-tap Send inside an email: link scanners open links on their own, so a Send has to happen in the
     app.
2. **The app is a quiet hub:**
   - Today and Customers are where you act;
   - Results is Wispr's Home stats;
   - "What FollowUp knows" (A-096) is Wispr's Dictionary and Style: it learns your words.
3. **Setup ends on a real customer,** or the practice one (A-093). Never a tour (R-027).
4. **Permissions are asked one at a time, each with one line on why,** as the Gmail step already does (A-081).

## The rules every screen follows (from the laws; budgets are hard limits)

1. **One job per screen.** If a thing doesn't serve that job, it moves to the place that owns it (Hick).
2. **Say each fact once.** Today the Customers page says "17" four times; it gets one (Miller, Prägnanz).
3. **One black button per screen,** the thing to press (Von Restorff, Fitts).
4. **Every icon has a word** (recognition over recall).
5. **Machinery goes behind "Details"** (Tesler). Why it waits stays as one line.
6. **Numbers are real or absent.** Our records only; nothing estimated (brand: "every number true").
7. **Every automatic action answers:** what happened, why, what can I do (CLAUDE.md).
8. **The desk follows the phone.** If the phone needs one card at a time, the desk doesn't add a second column of the
   same thing.
9. **The two good moments get the polish** (peak-end): Sent, and All done.
10. **Same look and words as the homepage.** Display headline, soft-green reply, the homepage's state words.

## Today: two ways, both drawn

- **A, fewer repeats.** The current layout, with repeated lines removed: the handled count, "N more need your OK" and
  "Based on…".
  - Desk: 239 → 213 words.
- **B, one customer at a time.** The phone's shape on the desk too: the next customer and their reply, then
  "Next: Owen Shah · 17 days · See all 15". Everyone else is one tap away in Customers.
  - Desk: **239 → 102 words, 17 → 9 controls.**

**Recommendation: B.** It is rule 1 and rule 8, and it's how a to-do app's "Today" feels: one thing, then the next.
It replaces A-084's two-column desk Today, so it needs the founder's yes.

## How we'll know

Same five tasks with three owners, before and after: find who's waiting; send a reply; change a reply; find a customer
by name; pause all sending. Plus one new task: "show me what FollowUp did for you this week" (Results), under 10 s.

## Open for the founder

1. Results as the third place, named "Results"?
2. Today B (one at a time) or A (the list, fewer repeats)?
3. The three questions from the redraw board:
   - the reply on soft green;
   - "Alerts" on the desk or only on the phone;
   - Ready → Qualified.

## Sources (web-search summaries, 2026-10-09)

- Jakob's law: lawsofux.com/jakobs-law · uxdesign.cc (Facebook redesign case)
- Apple HIG, lists and tables (Settings as grouped lists): developer.apple.com/design/human-interface-guidelines (lists
  and tables)
- Square Dashboard (today vs same day last week; period switch): squareup.com/help article 5183 and 5618
- Shopify mobile home (sales and sessions vs the prior period; a merchant complaint that a gamified home distracts):
  shopify.com/blog/shopify-mobile-app · community.shopify.com thread 654393
- Wispr Flow: docs.wisprflow.ai (navigating the app: Hub, Flow Bar, Home stats; try Flow in your apps after onboarding) ·
  builtformars.com/ux-bites (onboarding review)
- Screen Time weekly report (daily bars, change vs last week; a critique of an unexplained "below average"):
  vickiboykis.com/2019/04/29/breaking-down-apples-ios-screen-time-report

## The founder's recording of Wispr Flow's desktop app (2026-10-09)

**Founder:** *"look how cool and calm, to the point, also easy to use this is."* A 23-second screen recording of the
Windows app. The recording stays private: it shows his account. Only principles are kept here.

What makes it calm, as observed:
- **One quiet sidebar:** a small line icon **plus a word** for every place, about eight of them. Below them, a short
  bottom group (invite, Settings, Help). The current place gets only a soft grey fill.
- **A setup checklist lives in the sidebar:** a small card with a thin progress bar and four steps, ticked as they're
  done. Never a tour or a modal.
- **The content sits on one white sheet** with rounded corners, on a light grey frame. Almost no other boxes.
- **Plain page titles, text tabs underlined.** Lists are grouped under small uppercase day labels (WED, OCT 7). Each row
  has a small icon, a title and a time. Its actions (edit, delete, star) appear only on hover, at the row's end.
- **One black pill button per screen** ("Add new").
- **Numbers page:** three number cards in a row, each a big figure with a small label. A relatable comparison ("you've
  written 1 book chapter") and one small "+135% this month" chip. Then a usage bar list and a streak grid. Mostly
  monochrome, with one deep teal.
- **Each feature page opens with one dismissible banner:** a dark photo, a serif headline with one italic word (the
  same move as our homepage headline), one line of explanation and example chips. Then the plain list.
- **Settings opens over the page as a sheet** with its own short list on the left. Each setting is a row: label, one
  grey line of explanation, and the control on the right (switch, "Change" button or dropdown). Rows are grouped in
  soft boxes.
- **Almost nothing moves.** Pages swap instantly, a sheet dims the page behind it, and that's it.

**For FollowUp's app drawing (A-209):**
- the sidebar with words and the setup card;
- Today and Customers as one white sheet;
- Customers grouped by day;
- row actions on hover on the desk (the phone keeps the swipe);
- Results as three or four number cards plus one plain comparison;
- Settings as grouped rows with one line each.

**For the home page:** calm means few things moving at once. The smoothness fix (design-decisions 2026-10-09) makes the
motion cheap; whether there is still too much of it is his call.
