# The whole app, simple enough that nobody has to learn it (2026-10-09)

**Asked by the founder:**
- *"let me design the dashboard and stuff, let's do research first. I want to make the user experience as simple
  as we can"*;
- *"we also have to do the research about user friendly and easy to learn design of the whole product, to the
  point, minimal and simple"*;
- earlier the same day, *"we also have to start working on the inside design too, we will be using this same
  theme"*.

**The question, in one sentence:** what is the least the app can show, and the most it can do on its own, so that an
owner who has never seen it can find who's waiting and answer them without help, and so that the inside looks like
the home page they just saw?

**Read first, not repeated here:**
- `2026-10-03-too-much-stuff-density-audit.md`: every element on every screen counted; the founder's *"all of it,
  too much stuff"* (R-026).
- `2026-10-04-today-inbox-customers.md`: why the app is two places (A-082).
- `2026-09-25-in-app-experience-benchmark.md`: who / why / what to do, on one card.
- `2026-10-05-psychology-ease-results-return.md`: ease, results, return.
- `2026-10-03-laws-of-ux-applied.md`: Hick, Jakob, Fitts.
- Decisions this builds on:
  - Today, approved in three rounds: A-087, A-088, A-089.
  - White ground: A-090.
  - Swipe for Later: A-095.
  - Phone rules: R-015, R-021.
  - Rejections that bound any redesign:
    - R-001: subtraction alone reads as unfinished.
    - R-026: never add a panel without naming what it replaces.
    - R-028: a tidier copy of the same page is not a new look.
    - R-058: the peach-and-blue wash.
    - R-018: the reply as a big black card.
    - R-103: green on every surface.

**How sure this is:**
- **High** on the app's numbers below. They are the screens, measured on 2026-10-09 at 1280 px and 390 px with a
  17-customer local account.
- **Medium** on the principles. They come from long-standing usability research, read as summaries.
- **Low** on how new owners will behave. Only a few testers have used the app, and nobody has watched a first use.

---

## In plain words

1. **Nobody reads instructions.** People start using an app at once and learn only what the next click needs (the
   "paradox of the active user", IBM, 1987). So the screen is the manual: every button says what it does, in words.
2. **Fewer things at the start makes people faster.** In IBM's "training wheels" studies, people given only the
   basic functions finished 21–26% faster, and learned more, than people given everything.
3. **FollowUp already has the right skeleton.** It has two places (Today, Customers) and Settings, one reply card
   used everywhere, an undo instead of "are you sure?", and safe defaults (every reply waits).
4. **What's left to fix isn't amount. It's consistency.** The app and the home page look and speak like two
   products:
   - **Words:** the home page says *Qualified · Booked · Won by you · Time saved*. The app says *Needs you · Going
     quiet · Waiting · Up to date · Won*.
   - **Look:** the home page is paper, ink and forest green, with a serif headline. The reply card inside still
     uses the peach-and-blue wash you rejected for the website (R-058).
5. **Customers offers more ways to look than an owner has customers.** It has four tabs (two showing 0), Filter,
   More, Add customer and a six-column table: 24 controls and 309 words for 17 people.
6. **A few controls are icons with no word:** the bell, ⋯ and + on the phone. An owner has to guess or remember
   them.
7. **The software should carry the complexity, not the owner** (Tesler's law). Sorting, writing, timing and
   stopping are already FollowUp's job. The owner's job is two buttons: Send, or Edit.
8. **One designed moment, not more stuff.** When Today is empty, the "done for today" card can become the home
   page's photo panel, with the owner's own week in the same glass bubbles visitors saw:
   - it shows only when there is nothing to do, so it never competes with the work;
   - it is the "wow" R-001 asks for, without the clutter R-026 forbids.
9. **Measure it, don't guess.** Five tasks with three owners, before and after:
   - find who's waiting;
   - send a reply;
   - change a reply;
   - find a customer by name;
   - pause all sending.

   Target: each under 30 seconds, with no help.

---

## 1. What the owner actually does

| Job | How often | Where it happens | What the screen must answer |
|---|---|---|---|
| See who needs me, answer them | Several times a day, often on the phone between jobs | Today | Who? What did they ask? What will FollowUp send? Send or change it |
| Find one person I'm thinking of | A few times a week | Customers | Where is Ella? What did we say? |
| See whether it's working | Once a week, or when doubt creeps in | Today's end card, the Monday email | What came of it: qualified, booked, won |
| Change a rule | Rarely: setup, then almost never | Settings | How does it send? When? Pause it |
| Set up | Once | Sign in → connect Gmail → Today | Is it connected? What did it find? |

The first job matters more than all the others together. Every other place exists so that one stays clean.

## 2. The app today, measured (2026-10-09, local, 17 customers)

| Screen | Words (desktop / phone) | Controls (desktop / phone) | Page height on phone |
|---|---|---|---|
| Today | 239 / 213 | 17 / 17 | 1,832 px |
| Customers | 309 / 309 | 24 / 25 | 1,667 px |
| A customer | 95 / 84 | 8 / 8 | 1,132 px |
| Settings | 102 / 102 | 13 / 13 | 1,315 px |

**Already right (keep):**
- Two places plus Settings, with words under the phone's tab icons.
- One reply card that is the same on Today and on the customer page.
- One black button per card (Send). Edit happens in place.
- "Why it's here" is said in plain words.
- A 10-second undo instead of confirmations.
- "Every reply waits for your OK" as the default.
- Settings is one list, with the rare things under "Advanced".
- Practice customers (A-093) let a new owner try FollowUp before a real one writes.

**Where the owner still has to learn something:**

| # | Where | What | Why it costs |
|---|---|---|---|
| 1 | Customers | Four tabs (All 17 · Needs you 15 · Going quiet 0 · Waiting 0), Filter, More, Add customer, and six columns (name, channel, last message, waiting, state) | Hick's law: every option is a decision. Two tabs are empty. The list is already sorted by who needs you, so the tabs repeat the sort. |
| 2 | Everywhere | Two vocabularies: the home page's results words vs the app's state words | A visitor who signs up meets new words for the same things. One product should speak once. |
| 3 | Reply card | The peach-and-blue wash | Rejected for the website, "should match with our theme of the app" (R-058). It is the one thing that looks like neither the app nor the new home page. |
| 4 | Header (phone), Customers (phone) | The bell, ⋯ and + with no word | Recognition over recall (Nielsen's sixth heuristic): an owner shouldn't have to remember what an icon does. |
| 5 | Today (phone) | The open card plus eight closed rows, "7 more need your OK", "Show 7 more", "Booked call…": 1,832 px tall | Mostly approved pieces (A-087, A-088). The open card is long on a phone because the reply sits in a tall wash with helper text below. |
| 6 | The look | Inside, the app is the pre-redesign style. Outside, the new home page has a serif headline, paper, ink and a glass results bar | The founder's ask: *"we will be using this same theme"*. The inside should feel like the place the home page promised. |

## 3. What makes software learnable (the evidence)

| Idea | Source (grade) | What it means for FollowUp |
|---|---|---|
| **Paradox of the active user:** people skip instructions and start doing; they also map new things onto what they already know | Carroll & Rosson, IBM, 1987; summarised by NN/g and Laws of UX (B) | No tours and no help pages to read. The screen teaches by its words. Conversations should look like the chats owners already use every day (WhatsApp, iMessage, Gmail): their message on the left, the reply on the right, newest at the bottom. |
| **Training wheels:** start with a few functions, reveal the rest later | Carroll's experiments, summarised by NN/g: 21–26% faster on tasks, more facts learned, more satisfied (B) | The first screens show only Send and Edit. Rare actions (Later, Don't send, Already spoke) stay as quiet words, never more buttons. |
| **Recognition over recall** | Nielsen's sixth heuristic (B) | Every control has a word. Every state is said ("Waits for your OK", "Sent"), not coded by colour alone. |
| **Progressive disclosure:** rare features one level down | Nielsen (B) | Settings → Advanced is right. Customers' Filter and More belong one level down, or nowhere. |
| **Tesler's law:** every product has a fixed amount of complexity; someone has to carry it | Tesler, via Laws of UX and Wikipedia (B) | FollowUp carries sorting, timing, writing and stopping. The owner carries only the judgement: Send or Edit. |
| **Jakob's law:** people expect your app to work like the ones they use most | NN/g, already in our laws-of-UX file (B) | The customer page should read like a chat thread; Customers like a contact list; Settings like a phone's settings. |
| **Hick's law:** more choices, slower decisions | Hick-Hyman, already in our laws-of-UX file (B) | Every screen has one obvious next move. |
| **Learn by doing, with real data** | Onboarding studies and vendor data, mostly unsourced statistics (C) | Land on Today with their real customers, or the practice one, already waiting. One line: "Read it, then press Send." Never an empty shell. |
| **Peak-end** | Kahneman (B), in our psychology file | The best moment should come at the end: Today empty, and the week's real results shown well. |

**Honest limits:** no study found tests "chat-like layouts help small-business owners adopt an app". The WhatsApp
figures in search results are vendor numbers. Familiarity is a strong, reasonable bet, not a measured fact for this
audience.

## 4. The proposal, for drawing (nothing is built)

The structure comes from the owner's jobs (R-001). Each change names what it replaces (R-026). The change must be
visible at a glance (R-028).

1. **One product, inside and out (the theme):**
   - the screen's one headline in the home page's display serif, with the italic green phrase ("15 customers *need
     you.*");
   - Public Sans for everything else, and mono for the small labels;
   - the white ground stays (A-090);
   - forest green means done or won, the orange dot means needs you, ink is the one action.
   - **Replaces:** today's plain headline style.
2. **The reply card without the wash.**
   - The customer's message is a grey bubble on the left, as in a chat.
   - FollowUp's reply is a white card with a fine edge, labelled "Written by FollowUp · waits for your OK", with
     the ink Send.
   - Not a big black card (R-018), not green (R-103), not peach-and-blue (R-058).
   - **Replaces:** the wash.
3. **One vocabulary:**
   - States, everywhere: *Needs you · Qualified · Booked · Won*.
   - Results: *qualified, booked, won by you*, plus time saved, if we can make that number true (see open
     questions).
   - **Replaces:** "Going quiet", "Waiting" and "Up to date" as tabs, and the separate words in Numbers.
4. **Customers as one list:**
   - search on top, then everyone, already in order of who needs you;
   - a tab shows only when it has people in it;
   - three columns on the desk: who (with the channel icon), what they last said, and the state with its time.
   - Filter and More go one level down, under the search.
   - **Replaces:** four tabs, Filter, More and two columns.
5. **Every icon gets its word, or goes.** The bell becomes "Alerts" with its count; + becomes "Add". ⋯ goes, because
   its items move under Settings or the search.
   - **Replaces:** guessing.
6. **The designed moment.** When Today is empty, the done card becomes the home page's blurred photo panel, with the
   owner's own week in glass bubbles. Real numbers only (A-088's facts), the same look visitors saw on the home page.
   - **Replaces:** the plain "done for today" card. Nothing new appears while there is work.
7. **First use is the real thing.** After setup, Today opens with their real customers, or with the practice
   customer already waiting, and one line: "Read it, then press Send." No tour and no question row (R-027).
   - **Replaces:** nothing; this is the route already built (A-081, A-093), with one line added in the place of
     the empty headline.
8. **The phone open card gets shorter.** The reply sits in the white card, and the helper line moves under Edit only
   when it applies.
   - **Replaces:** the tall wash block.

## 5. How we'll know

Run it with three owners using `workflows/watch-a-tester.md`, on the current app and then on the redrawn one:

| Task | Target |
|---|---|
| Find who's waiting on you | under 10 s |
| Send the reply as it is | under 15 s |
| Change a reply, then send it | under 30 s |
| Find a customer by name | under 15 s |
| Pause all sending | under 30 s |

Plus one question at the end: "What does FollowUp do?" If the answer isn't close to "it answers my customers and
follows up for me", the words are wrong, not the owner.

## 6. Not proposed, and why

- Dashboard tiles or charts on Today (R-001, R-026, A-046 calm Today).
- Keyboard-first as the organising idea (R-002).
- Tours, coach marks, or a row of questions after setup (R-027).
- A tidier version of the current screens as the whole answer (R-028).
- Green surfaces (R-103), the wash (R-058), a big black reply (R-018).
- More places in the menu. Two stays two (A-082).

## 7. Open questions for the founder

1. **Draw this direction?** The plan is Today, a customer and Customers, desk and phone, in the home page's theme.
2. **"Time saved" inside the app.** It is only honest if we count it the same way every time, for example "about
   N min: replies FollowUp wrote × a fixed minutes-per-reply, shown as an estimate". Count it like that, or leave it
   out of the app until we can measure it?
3. **The states' words.** Should the app adopt the home page's words (Qualified, Booked, Won), so a new owner meets
   the same words they read before signing up?

## Sources (web-search summaries, 2026-10-09)

- Paradox of the active user (Carroll & Rosson 1987): nngroup.com/articles/paradox-of-the-active-user ·
  lawsofux.com/paradox-of-the-active-user
- Training wheels interface: nngroup.com/articles/training-wheels-user-interface
- Recognition over recall: uxdesign.cc (Nielsen's sixth heuristic) · progressive disclosure:
  brajeshwar.com/2006/progressive-disclosure-by-jakob-nielsen-usability-expert
- Tesler's law: en.wikipedia.org/wiki/Law_of_conservation_of_complexity · lawsofux.com/teslers-law
- Learnability definition: thebehavioralscientist.com/glossary/learnability
- Onboarding by doing (vendor sources, grade C): parallelhq.com/blog/saas-onboarding-patterns-activation ·
  wearetenet.com/blog/saas-onboarding-ux-best-practices
- Field-service apps (reviews, not design write-ups): fieldservicesoftware.io/comparisons/housecall-pro-vs-jobber ·
  capterra.com/compare/127994-140363
- WhatsApp Business use by small firms (thin evidence): journals.ufs.ac.za (micro-retailers, South Africa) ·
  research.tees.ac.uk (WhatsApp Business API)
