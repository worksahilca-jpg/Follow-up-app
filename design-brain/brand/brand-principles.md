# Brand principles

The non-negotiables. Everything else in `brand/` is an expression of these.

---

## 1. Trust is the product, not a feature of it

FollowUp is given access to a business's leads, inbox, and reputation — and then acts on
its behalf. Every design choice either deposits trust or withdraws it.

**Design consequence:** no dark patterns, no hidden automation, no "we sent 47 messages"
surprises. The user must always be able to see what was sent, to whom, why, and how to
stop it. A confirmation step that costs a click is cheaper than a customer who feels
ambushed by their own software.

**Test:** would a business owner be comfortable if their customer saw this screen?

---

## 2. Calm over urgent

The category norm is manufactured urgency: red badges, flashing counters, "12 HOT LEADS!"
FollowUp inverts this. The product's job is to *remove* the owner's anxiety about leads
going cold — an interface that generates anxiety is working against its own purpose.

**Design consequence:** urgency is stated once, precisely, where it's actionable. Not
repeated across every surface. Color signals meaning, never excitement. Silence is a valid
state and empty screens are allowed to look calm rather than apologetic.

**Test:** does this screen feel like a to-do list that's on top of things, or an inbox
that's drowning?

---

## 3. AI is invisible capability, never personality

The moment FollowUp feels like "an AI product," it has lost. Business owners don't want a
robot colleague — they want their follow-ups done. AI is the mechanism, not the pitch.

**Design consequence:** no sparkle icons as a substitute for explanation, no typing-dot
theater, no chat bubble mascot, no "✨ AI-powered" labels on things. When automation acts,
it explains itself in plain language a busy person reads in two seconds.

Every automated action must let the user answer, unaided:
- **What happened?**
- **Why did it happen?**
- **What can I do about it?**
- **What does FollowUp recommend?**
- **What needs my attention?**

**Test:** remove every AI-referencing word from the screen. Is it still fully
understandable? It must be.

---

## 4. The user is busy, distracted, and not a software person

The ICP is an owner or a small team running the business *and* the follow-ups. They open
FollowUp between jobs, on a phone, with 90 seconds. They will not read a paragraph, learn
a mental model, or hunt through settings.

**Design consequence:** the most important thing on a screen is the biggest, first, and
unambiguous. Defaults are correct for the 80% case. Jargon is banned — no "cadence",
"sequence enrollment", "orchestration" where "follow-up", "added to", "plan" will do.
Configuration is progressive: powerful when sought, invisible when not.

**Test:** would someone who has never seen this screen know what to do in five seconds?

**The phone is not a shrunk desktop** (founder, 2026-09-26: *"it is not supposed to be same… the information should be same, the message should be same… the diagrams and all that are consuming lots of space in mobile version"*). On a phone, keep every word and every claim, and cut or compress the pictures: big mock cards become one compact example, card grids become divider lists, several stacked demos become tabs showing one at a time, three price cards become a switcher. A visual stays on the phone only if the words can't carry that point alone.

*SUPERSEDED IN PART (2026-09-27) by A-063:* on the landing page the phone keeps every **claim**, said once, not every word. A picture that shows the product working (the demo) beats the paragraph that describes it.

**Said again, for the app** (founder, 2026-10-10: *"for phone we gotta figure out something, because we cannot just fit
the desktop in this mobile one"*). The app's phone screens get their own layout, not the computer's stacked into one
column. Research: `research/ux-patterns/2026-10-10-phone-vs-computer.md`.

**The phone must be habitable** (founder, 2026-09-26: *"make it more simple so that I can also be habitable with my phone, because users will be mostly using their phone"*). In the app, one screen = one decision: the next person who needs you, their message, your reply, and a big Send. No progress bars, filter chips, section labels, colour dots or stats on the phone. If the owner wouldn't open it between jobs with one thumb, it's too much.

---

## 5. Clarity over cleverness, always

A clever interaction that needs explaining is a bug. Novelty is not a value; recognition
is. Conventional patterns, executed with unusual precision, beat invented patterns.

**Design consequence:** familiar structures — list, detail, form, table — refined to a
high finish rather than replaced with something original for its own sake. Originality is
spent on the *problem* (how a lead's urgency is communicated), not on the *chrome* (how a
dropdown opens).

**Test:** did this need a tooltip to be understood? Then redesign it, don't add the tooltip.

---

## 6. Show the reasoning, not just the verdict

FollowUp makes judgments — this lead is hot, this one needs you, this one can wait. A
judgment without its reasoning is either blindly obeyed or entirely ignored. Both are
failures.

**Design consequence:** a score is always accompanied by why. A recommendation always
carries its evidence. A confidence level is stated honestly, including when it's low.
"Not reviewed yet" is a real, distinct state from "nothing needed" — the product must
never imply it has looked at something it hasn't.

**Test:** can the user disagree with FollowUp on an informed basis? They must be able to.

---

## 7. Never design the spam tool

There is a version of this product that is a bulk-blast machine, and it must never be
built, visually or functionally. FollowUp follows up *where permission exists*, in
conversation, at human scale.

**Design consequence:** no "blast" affordances, no bulk-message-everyone as a primary
action, no volume metrics celebrated as success (messages sent is not a success metric;
replies and deals are). Compliance and permission state are visible, not buried.

**Test:** does this screen make sending more messages feel like winning? Then it's wrong.

---

## 8. Precision is the aesthetic

FollowUp doesn't look premium because of gradients, glass, or animation. It looks premium
because of alignment, consistent spacing, restrained type, deliberate color, and things
lining up. The discipline referenced in Apple/Linear/Stripe/Notion is *restraint*, not
style — and restraint is what gets copied here, never their interfaces.

**Design consequence:** a limited palette, a small and deliberate set of typefaces, a strict
spacing scale, real alignment, and the removal of anything that doesn't carry information.
Polish is achieved by subtraction far more often than by addition.

**CORRECTED (2026-09-22).** This read "one typeface" until today, and had been false since
the landing-page rebuild. What actually ships is three faces, each with one job: **Public
Sans** for everything structural (`--font-display`, `--font-body` in `globals.css` both
resolve to it), **IBM Plex Mono** for small uppercase labels and figures, and **Instrument
Serif** for the landing page's emphasis italic — the *"because you forgot to follow up"* in
the approved hero ([[approved#^A-013|A-013]]). Flagged as gap 8 of the 2026-09-13
landing-page research and left standing until now. The principle was never really about the
count: three faces doing three jobs is restraint; two sans-serifs competing for the same job
is not. **That** is the test, and it is what the wording above now says.

**Test:** what can be removed from this screen without losing meaning? Remove it.

---

## Which of these now carry external evidence

Added 2026-09-12 after the first research pass. Principles 3, 4, 6 and 7 are no longer only
convictions — see `research/ux-patterns/2026-09-12-trust-and-approval-for-automated-follow-up.md` (medium confidence; the underlying sourcing is
search-snippet-based, good enough to steer design, not to quote on a screen).

| Principle | Evidence |
|---|---|
| **3 — AI is invisible capability** | 65.5% of owners fear AI makes their business feel less authentic; 79% of customers prefer a human. The fear is specific and about *their customer's* experience — every sparkle icon feeds it |
| **4 — The user is busy and not a software person** | Competitors are repeatedly marked down by this exact ICP for setup burden and learning curve; "up a ladder" is the literal usage context |
| **6 — Show the reasoning, not just the verdict** | 77% want human approval before an agent acts; approval is meaningless without the reasoning to approve *on* |
| **7 — Never design the spam tool** | TCPA liability ($500/violation) sits with the business, not FollowUp — visible permission state is a real user need, not a posture |

## How to use these

When two principles conflict — and they will — the order above is roughly the priority
order. Trust beats calm; calm beats clarity-of-density; nothing beats trust.

When a design decision is hard, name which principle it serves. If it serves none, it's
probably decoration.


## 9 — Every word must be understood by someone who has never used software like this

Added 2026-09-18, founder's words on the landing page: "the information is very complex. I want
to make it very simple so that every single user can understand. Even if someone wants to use it
without any tough things, they should understand."

**In practice:** one idea per sentence. The customer's word, not ours ("customer" over "lead"
where a customer would read it, "going quiet" over "scored at risk", "written down" over "on
the record"). No product-internal names on a public screen (sequence, draft, autonomy, window,
CRM, integration, real-time). Fewer things on the screen beats a clearer explanation of many.

**Test:** read the section aloud to someone who runs a shop and has never used a CRM. If they
ask "what does that mean?", the line is wrong, not the reader.

**Reinforced 2026-10-08, website home page:** *"use simple information so that they read it its
too much."* People skim a website; they do not read it. A line longer than about ten words, or
a second sentence under a heading, mostly goes unread. **In practice:** a heading plus at most
one short line; labels of one or two words ("Writes", "Sends", "Follows up", "Stops"); example
messages as short as a real text ("Is the house still available?"); pictures of the product
carry the detail, not paragraphs.

**Added 2026-10-08, founder (A-110):** *"We have to let them try this thing."* On a public page, doing beats
reading: the first action a visitor can take is the product itself (type a customer's question and watch it get
answered), with no competing choice next to it. Explanations come after the try, not before.

**Added 2026-10-08, founder (R-045):** *"I don't want any AI images. Arts are good, but not AI."* Every image on
FollowUp is made by a person: public-domain or licensed art, commissioned illustration, or real photos of real
owners with their permission. Never AI-generated pictures, in any style.

**Added 2026-10-09, founder (R-060):** *"We don't want to keep the whole page like a 2D model with boring written
information."* Show, don't tell, section by section: each point gets something to look at or play with (a control to
drag, a moment that plays, a photo card), and the words shrink to labels. Facts still need sources; they just arrive
inside the picture, not as a list.

**Added 2026-10-09, founder:** *"We'll be leaning more towards Mac or iOS, or Apple's thing… if we use their style, we
might be able to connect with the users more impactfully, rather than just explaining to them."* Familiar beats
explained: show the visitor things they already know from their own phone (home-screen app icons, notifications, the
device's own font, the chat bubble colours of the app the message came from). Borrow the platform's language, never a
company's whole screen (R-029, references are principles).

## Learned 2026-10-09 (home page comments)

- **Guarantees and facts never move.** *"Don't scroll them, don't slide them. It should be readable, so they should get
  to know in just one second."* Anything a visitor must trust (data promises, privacy points, prices) is static and
  readable in one glance.
- **Use the apps owners know.** *"do not try to use the webhook logo. Use… WhatsApp, Gmail, Instagram, Messenger, so that
  they can relate."* Show familiar channels, not abstract or technical icons.
- **Motion speaks Apple.** *"everything should follow iOS- and Mac-based transition themes… I don't want any
  out-of-the-box animation."*
  - One damped spring (cubic-bezier(.32,.72,0,1)), 0.35–0.6 s, no overshoot or wobble.
  - Badges, notifications and sent messages behave the way they do on an iPhone or a Mac.
  - **Added 2026-10-15, founder, for the app itself:** *"I want the feel of this product as Apple, I mean animations
    smoothness that Mac or iOS have, and also style too."* The product, not only the home page: the way a page
    opens, a sheet rises, a card leaves and a button answers should feel like an iPhone or a Mac app, at 60 frames
    on a mid phone. The direction is recorded here; what exactly changes is drawn first and decided in
    `decisions/` (the motion rules in `brand/motion.md` that this touches, such as "no page transitions between app
    routes", are re-decided there, not quietly dropped).
- **Every number moves for a visible reason.** A counter only changes when something visibly lands on it, and the thing
  that lands carries the counter's own name ("Qualified" lands on "qualified").

- **Scroll, not drag (2026-10-09).** *"nobody will be dragging this."* A picture that only tells its story when someone drags a control will go unseen. Drive it with the scroll, and keep dragging as an extra.

## No two neighbouring sections in the same format (2026-10-09)

**On hold:** the first attempt (v119) was reverted; apply this only to the sections he names, the way he describes.

The founder: *"we are using the same background box style format for every single page… be more creative."* A page
where every section is the same box reads like a template, however good each box is. Before adding a section, look at
the one above and the one below. Pick a different format: a photo card, open on the page, the product on its own, art,
or a short scene that plays. Keep photo cards for the places they earn it. See R-094.

## On dark, go bigger and brighter than the contrast check asks (2026-10-09)

He flagged dark areas as "not readable" three times in one day: the dark message cards, "too dark", and the footer.
Each one passed or nearly passed the contrast check. On a dark ground, use at least 16px for anything meant to be read,
and near-white text, not soft grey. Keep small labels for real labels only.


## It must never sound like a CRM, and never like software you have to learn (2026-10-09)

**Founder, in chat:** *"we also have to show the key features too right, it should not sound like a crm"* and *"it
should sound like they don't have to learn this software, it's quick and easy to learn"*. He also said the page needs
a strategy: show how we help, what makes FollowUp unique, and convert straight away ("this is the product they
wanted").

- **Not a CRM.** No CRM words on the page: CRM, pipeline, contacts, deals, dashboard, workflow, sequences, fields,
  integrations. Use the owner's words: customers, messages, replies, your inbox, booked, closed. Features are named by
  what they *do for the owner* ("answers every message", "follows up until they reply"), never by module.
- **Nothing to learn.** Every feature is shown working, never explained as a setting. The setup claim stays true and
  plain: connect your inbox once and it starts working. One question a day replaces a setup form.
- **Key features are shown, not listed.** Each feature gets its own small picture of the product doing it.

## One second per section (2026-10-09)

**Founder, on the preview:** *"too much information. I will just look for a sec and I will move on. I want you to make
it understood, or catch the attention of the user, in that one sec."*
- **Rule:** each section must make its point in one glance, with one big line and one picture. Everything else is for
  people who stay: the playing conversation, the details. If a section needs a paragraph to be understood, the picture
  is wrong.
- **First applied:**
  - Nadia's week became "Two endings." with "Lost by tomorrow." in red and "Booked by Thursday." in green.
  - "What it does" dropped its description lines.

## Lean toward the win, but every number must be true (2026-10-09)

**Founder, on the hero numbers:** *"make this dashboard more accurate, not just a clickbait; lean towards it but it
should be true."*
- Example numbers must be believable for one small business in one week.
- Never credit FollowUp with what the owner does. Deals are "done, by you"; FollowUp catches, answers, follows up and
  books.
- Counters that run live must stop at a plausible total, never climb forever.
- Prefer a promise FollowUp keeps by design ("0 forgotten") over a big money figure it can't prove.

## The home page has 4–5 sections, no more (2026-10-09)

**Founder:** *"we just have to make 4 to 5 sections only."* Every extra section must replace one, not add to them. If
a section's answer already lives elsewhere on the page (FAQ, "nothing to learn"), fold it in as one line.


## Every page is designed for the phone too (2026-10-09)

**Founder:** *"we also need to design for mobile too."* An owner often sees FollowUp first on a phone, between jobs.
- Every page is checked at 390 px and 360 px before it is called done, not only at desktop width.
- A phone gets the same story, not a lesser one. If something is cut on a phone (the floating messages, the lanes of
  the demo), the point it made must still land another way.
- Nothing may sit under the screen's edge or overlap: buttons stay on one line, cards keep their spacing, and nothing
  scrolls sideways.

## Every frame is smooth, on an ordinary laptop and a mid phone (2026-10-09)

**Founder:** *"the animation and the motions are not smooth, I want all the frames to be smooth."*
A stutter reads as cheap and breaks trust, however good the design is. Motion that can't run at 60 frames is cut, not
kept. How we keep it smooth (measured on the home page, see design-decisions 2026-10-09):
- Animate only **transform and opacity**. Never width, height, margin, top/left, padding, box-shadow or filter blur.
- **Never write a scroll value onto a big container** (`<html>`, a whole section). A CSS variable flows into every
  element inside it, so the browser restyles all of them each frame. Write the value onto the few elements that read
  it, and register it as non-inherited (`@property … inherits: false`).
- **No frosted glass (backdrop-filter) or blur over anything that moves.** Each frame re-blurs the area. Use a plain
  see-through fill instead; over a calm background it looks the same.
- Scroll listeners measure **at most once a frame** (requestAnimationFrame). Never read layout on every scroll event.
- A counter writes a number **only when it changes**.
- Things that move on every scroll frame get their own layer (`will-change: transform`).
- Check with a trace before calling it done: no main-thread task over 16 ms while scrolling, desk and phone.


## A reply answers what they asked, the way a person would (2026-10-11)

**Founder,** after testing his own Instagram: *"dms works need more improvement"*, then *"explain why it sent that reply
of that message"*. The customer asked *"how much do you charge and are you free?"* and the draft asked which listing
they meant. The next one answered *"looking in Etobicoke"* with *"Looking in Etobicoke works. Is this for a weekday
showing or weekend showing?"*
- **Every question they asked gets an answer first**, or a plain "I'll confirm that". Then, at most, one question of
  ours. A reply that skips a question tells them nobody read it.
  *SUPERSEDED IN PART (2026-10-14) by A-246:* while qualifying a realtor's customer, up to two questions of ours,
  joined into one natural sentence. Their questions are still answered first.
- **Read the question the way the business would.** "How much do you charge" to a realtor is the realtor's fee, not a
  home's price.
- **Don't jump ahead of the customer.** No showing before there's a home to show. Ask what they're looking for first.
- **Sound like the owner on their phone**, warm and plain. Never hand their words back as a verdict ("Etobicoke works.",
  "Noted.").
- **Never sound like AI, and learn the owner's own way of writing in every language** (founder, 2026-10-14: *"make the
  replies more humanistic. It should not sound like AI that is talking ... it should be learning from all those
  replies too, in every language"*). An owner writes to a Punjabi customer differently from an English one, so the
  style FollowUp copies comes from their replies in that customer's language first. The eight reply rules are A-247.

## FollowUp picks up customers, not every message (2026-10-11)

**Founder,** after a Reel with no words landed on Today as "Instagram DM": *"if someone sends a reel, a post, or a sticker
with no question, and neither does it say it's interesting nor does it sound like a lead, why should we pick it up?
... We'll be picking up only those who are actually customers or leads, or who are planning to buy, or who have a query
about the business."*
- Every message FollowUp picks up costs the owner attention. One that isn't a customer is noise on Today and a buzz
  for nothing.
- When unsure whether a message is a customer, keep it. A photo or file someone sends can be the question itself.
- Built so far: shared content with no words (A-233); new Instagram and Messenger chats get the same "is this a
  customer?" check as emails (A-234). A bare "hi" still gets through on purpose.

## Today is the owner's whole day on one page (2026-10-14)

**Founder,** on the built A-243 Today (a count, one sentence, one reply card): *"Today is the gist of everything: all
that the user ... needs to do, what he needs to plan, and what he needs to focus on. Why are just 5 customers waiting
for you? What the hell is that, and what is he going to do with that? ... This is my progress, this is what I'm going
on with, and this is everything that I need to do today. Okay, what's next? Tomorrow is this. How many calls do I need
to do? How many meetings do I have to do? Everything should be on today's page. That's why they're going to open it
again and again."*
- Today answers, on one page: what to focus on now, everything to do today (replies, calls, viewings and meetings),
  how far through the day the owner is, and what is coming tomorrow.
- A bare count ("5 customers are waiting for you") is not information: say what the five are and what to do about them.
- Results shows what FollowUp did; Customers keeps everyone. Today is the owner's own day.
- Still true (R-113): plain words, one main action at a time. Whole day ≠ cluttered: every line says what it is.

## Settings says Connect, Connected, Done; the technical part happens in the back (2026-10-14)

**Founder** (R-115): *"whatever we want user shouldn't see or if there is anything that the user doesn't mean to see or
that doesn't make sense, you have to remove all of that part. You have to do it in the back. We just have to show
"Connect this" or "that," like two or three options. Say "Connected," "Okay," "Done."*
- **Each place customers write is one row:** its logo, its name, and either "Connect" (one tap) or "Connected ✓".
  A connected row opens to who it's connected as, and Disconnect.
- **Two or three choices per screen,** each one line. No paragraph under a control.
- **FollowUp picks the numbers, schedules and wiring** (hours before a check-in, routing, webhooks, tokens). They run
  in the back with good defaults.
- **Only something broken asks for attention,** in one line with the fix ("Gmail stopped. Reconnect").
- **Test:** could an owner go through Settings without reading a sentence?

## Fewest, simplest words (founder, 2026-10-17)

*"We dont have to use complex words anywhere, be as simple and minimal as we can."* Every line in the app is the
fewest everyday words that are still true. Name the thing ("Connect your apps"), not the behaviour behind it ("Where
do customers write to you?"). One short line beats two sentences. See R-121.

## People should love using it, the way they love Wispr (founder, 2026-10-17)

**Founder, verbatim:** *"i want people to love the app like wisper there is no point of using its app but i love
exloping and all because i love using it right so people should love using it it should not be complex like gohighlevel
and all right"*.

- The bar is not "works" or "clean": an owner should *enjoy* opening FollowUp, even when nothing needs them, the way the
  founder enjoys opening Wispr when he has no reason to.
- Never complex like GoHighLevel: no menus of features, no setup maze, no dashboard of numbers to learn. Every screen
  stays one clear thing.
- Joy comes from how it feels to use (speed, feel, small rewarding moments, real content), never from gimmicks,
  streaks or AI personality (CLAUDE.md standing rules still hold).

## The computer matters as much as the phone (founder, 2026-10-17)

**Founder, verbatim:** *"my laptop iterface means a lot dont just keep focusing on phone desighn bro"*.
- Every drawing shows the computer (1280 wide) **and** the phone (390), side by side. Never phone-only.
- The computer is not a stretched phone: it uses the room (sidebar, the customer and their details side by side).
- "Phone first" (design-brain rules) still means the phone must work; it never means the computer comes second.
- **Update (founder, 2026-10-17, later):** *"laptop is priortiy"*. The computer now comes **first** in design work: draw
  and check the computer screen first, then make sure the phone still works. The phone is not dropped (owners still
  answer on it between jobs); it is checked second.

## The job they needed (founder, 2026-10-22)

**Founder, verbatim:** *"make it so accurate and effective that business owners should think, 'Oh yeah, this is the job
that I needed,' because that's something that I wouldn't have done with my experience … We should get the results and
stuff to the users … so that we can help them grow their businesses."*

- FollowUp does the expert's part of the job, the part an owner wouldn't do alone: who is serious, what to do next, and
  when. Writing replies is only the start (every CRM writes replies now).
- Every judgment must be accurate enough to act on, say why in the customer's own words, and let the owner correct it in
  one tap.
- The results come back to the owner in their own numbers: what came of FollowUp's calls, not how many messages went.

## Build what only FollowUp can see, so a CRM can't copy it (founder, 2026-10-22)

**Founder, verbatim:** *"we have to focus more on the differentiation we are creating, I don't want CRMs to get all these
features and eat us."*

- Every new feature should lean on what only FollowUp sees: the owner's inbox, DMs and forms, and what was said there.
  A CRM never sees those, so it can't add the same thing next quarter (first case: "Missed by your CRM", A-315).
- Writing replies, sequences and reminders are what every CRM already has; they are not where FollowUp wins.

## Everything lives where its name says (founder, 2026-10-22)

**Founder, verbatim:** *"keep everything organise bro we should have proper spaces for everything … All the
applications should be right there. You cannot put it in your business or something like that … Everything should be
organised properly according to what it is saying."*

- Each thing has one home, and the home's name says what is in it. Every app FollowUp connects to (email, Instagram,
  Facebook, WhatsApp, the website form, the CRM, the calendar, the phone line) is under **Connected apps**, nowhere else.
- "Your business" holds only things about the business (who you are, what FollowUp knows, how you work). "Sending
  replies" holds only how replies go out. A setting that fits two places goes in the one its name matches, and the other
  place may link to it; it is never kept in two places.
- A new setting is placed by this rule before it is built, and the app map (design-brain/components/app-map.md) says
  where.

## How FollowUp reacts comes from what realtors do, not from the founder's guess (founder, 2026-10-26)

*"For this we need to know how that business owner or realtors react, not me. If they say no for these situations we go
no; if they have any other strategy we should use that."* (Said when asked to judge 50 test conversations about
customers saying no.)
- When FollowUp decides how to act on a customer (stop, wait, check back, hand to the owner), the answer comes from what
  working realtors actually do: published practice (`reports/Realtor follow up conversations.md`) and real realtors'
  checks. The founder is not the judge of a realtor's craft; a test set is labelled from realtor practice, then a
  realtor checks the hardest cases.
- Where realtors stop, FollowUp stops. Where they have another move ("not now" becomes "when should I check back?"),
  FollowUp uses that move instead of a blanket rule.

## The app must show FollowUp working, not hand the owner a to-do list (founder, 2026-10-28)

*"i feel like what we are making and the direction of the product dosent matches the app i mean it is working good
right but dosent feel like working."* (Said on the built A-335 Today, after "i didnt like it".)
- The product's direction is that FollowUp does the following up and the owner supervises
  (`followup/PRODUCT_DIRECTION.md`). Today as built opens with "16 people are waiting for your reply. Start with Zoe."
  That is a to-do list for the owner. It says the opposite of the product: the work is yours.
- **A screen says what the product is.** When FollowUp answered four people overnight, booked a call and is waiting
  on three replies, Today must show that, in the present tense, with names and times: what it did since the owner
  last looked, what it is doing now, what it will do next on its own, and who it is waiting on. The owner's own
  decisions sit on top of that, few and clear. The page changes between visits because FollowUp did things.
- The fix for "dead" (R-143) is therefore not decoration (R-142) and not less on the screen (R-144): it is evidence of
  work. Less on the screen cut exactly the lines that showed FollowUp working ("FollowUp wrote to 3 customers for
  you" went behind a fold), which is why the calmer Today read deader, not calmer.
- Confirmed the same day: asked "is 'the app should show FollowUp working, not give me a to-do list' the feeling
  you mean?", he answered *"yes draw it"*. So "doesn't feel like working" means "I can't see it working".

## What the owner must do catches the eye; FollowUp's work is the quiet proof beside it (founder, 2026-10-28)

*"bro the tasks that a user need to do should be eyecatching right so that they can get to know what to do right?"*
(Said on the step-2 drawing of the opening page, where both sides had the same weight.)
- On any screen that mixes the two, the owner's part comes first and is the loudest thing: first in reading order
  (left on a computer, top on a phone), a real heading that says the action and the count ("16 replies need your OK"),
  the card raised, the one black button. FollowUp's own work sits beside it, smaller and greyer: present, so the
  page shows FollowUp working (the principle above), but never competing with what the owner must do.
- Loud by position, size and the one black button. Never by colour, a badge or a dot alone (R-141), never neon or
  urgency (standing rules).
- Both principles hold together: the page proves FollowUp worked *and* makes the owner's next move unmistakable.


## Point the owner to their task, don't hand them a newspaper (founder, 2026-10-29)

*"I feel like we are just putting a newspaper in front of them, with too many words and stuff. We got to figure out a
way where we need to direct them to their task, something like that, like Instagram does, I guess, or WhatsApp and
other stuff do: to do their task if something needs them. We can't just open them to the whole chat like a
newspaper. That makes them confused."* (Said on the live A-337/A-338 Today, after R-146.)
- Opening the app should tell the owner, in a few words, *that* something needs them and *which* thing, then take
  them to it. The full conversation, the drafted reply and the reasons open only when they go to that one task.
- Few words on the first screen. A wall of sentences, quotes and replies, however well written, reads as a newspaper
  and confuses.
- The way Instagram and WhatsApp do it (principle only, never their screens): a short signal that something is
  waiting, who it is, one tap to it. *(From general knowledge of those apps; no screens were studied for this note.)*
- This sharpens the two principles above, it doesn't undo them: FollowUp's work stays visible but short, and the
  owner's task stays the loudest thing, now by being the thing the screen points to rather than the thing it prints
  in full.
