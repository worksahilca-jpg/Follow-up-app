# FollowUp's playbook: real estate

**What this is.** Everything FollowUp does for a realtor, in plain words: whom it answers, how it judges them, what
it writes, when, when it stops, what waits for the owner, and how it learns. Written on 2026-10-22 from what the app
actually does that day, not from what we hope it does. Where something is weak or missing, it says so.

**How to change it.** Say what's wrong in your own words. The change is made in the app, then here, and an accuracy
test is added so it can't quietly break later. See [README.md](README.md).

---

## 1. Whom FollowUp answers

**It answers real customers only:** a person who wants to buy, sell or rent through this business, or a client already
working with it (paperwork, a deposit, moving a showing).

**It sets aside, never answers:**
- People **selling to the business**: photographers, designers, marketers, software, other agents pitching. However
  warm or flattering. The tell: a customer asks what *you* charge or whether *you* are free; a seller says what *they*
  are free for and links their own work.
- People the business pays, writing about its own affairs: its landlord, accountant, lawyer, bank, a supplier's bill.
- Newsletters, notifications with no person's request in them, job seekers, personal mail.

**It lets in on purpose, because guessing wrong loses a customer:**
- A lead site passing on one person's request (REALTOR.ca, Zillow, Realtor.com and the like): that person is the
  customer, even though the email comes from a no-reply address.
- On Instagram and Messenger: a bare "Hi", or a photo, video or voice note with no words. People say hi and wait.
- When FollowUp isn't sure, it reads the email a second time. A message is set aside only when both reads agree.

**Everything set aside can be brought back** from "Filtered out" in one tap. When the owner says "this is a customer"
or "this isn't, it's a …", FollowUp uses that as an example for the next ones.

**Never drafted for:** contacts copied from a CRM who have never written; the practice customer.
**Always waits for the owner:** replies to people added by hand or from a spreadsheet, who never wrote first.

*How we check it:* two accuracy tests on Admin → Accuracy tests (emails; Instagram and Messenger chats). Last run on
record, 2026-10-14: emails 121 of 122 right, Instagram 36 of 37.

---

## 2. How FollowUp judges where someone stands

Every time the customer writes, FollowUp fills in a checklist from **their own words**. Every item must be quoted from
what they wrote. If they didn't say it, it stays unknown. Nothing is guessed, and nothing known is forgotten because a
later read missed it.

**The checklist:**
- **Buying:** area, when they move, viewing, already has an agent, money (pre-approved or cash), price range, kind of home.
- **Renting:** area, when, monthly budget, viewing, agent.
- **Selling:** the home's address, when, why they're selling, a home visit, condition, price in mind.

**Where they stand ("FollowUp's call"), by fixed rules:**

| Call | When |
|---|---|
| **Has an agent** | They said they're already working with another agent. FollowUp stops, unless the owner presses "Keep following up anyway". |
| **Ready** | A buyer or renter said yes to a viewing, or named a time for one (whatever else is still unknown). Or, moving within about 3 months and: a **buyer** is pre-approved or paying cash, a **renter** gave a monthly budget (and for both, the agent question was answered or asked); a **seller** said why they're selling. |
| **Warm** | Moving in about 3 to 6 months. Or moving soon, but a buyer isn't pre-approved yet, or the money (or a seller's reason) was asked and not answered. |
| **Later** | More than 6 months away, no plans yet, or "just looking". |
| *(no call yet)* | FollowUp is still finding out. |

"Within about 3 months" includes "as soon as possible", "this month" and a lease ending within 3 months.

**The owner is never asked to grade a call** (founder, 2026-10-22). Whether the calls were right is measured from what
happens next: did the Ready ones book or buy, did the owner change someone's plan.

*How we check it:* the checklist accuracy test (Admin → Accuracy tests). Last run on record, 2026-10-14: 5 misses,
0 made up.
*Weak:* other kinds of business have no checklist yet. Their call comes from a single interest score, which is coarser,
and there's no accuracy test for it yet.

---

## 3. What FollowUp writes

**The first reply** reacts warmly to what they said, answers what they asked, and ends with the first questions, two
together in one sentence: "Are you looking to buy, sell or rent, and roughly when?" A bare "hi" gets a short thanks
for getting in touch, then that question.

**The order it asks things in** (two at a time, each asked once, never twice):
- **Buyer:** area and when → seeing the home (or a quick call) and whether they've been looking with an agent → money
  and price range, last. Money comes last because it's the question that makes new customers go quiet.
- **Renter:** area and when → budget and a viewing → agent.
- **Seller:** the address and when → why they're moving and a home visit → condition and price in mind.
- **Someone 6+ months away:** after the first two questions, only the kind of home. No pressure.
- If the owner wrote their own questions ("Teach it your way"), a buyer is asked those, in the owner's order.

**A viewing or call is offered by the second reply**, or right away if they ask. **They pick the time.** FollowUp
never suggests a day or a time itself.

**How every reply sounds:**
- Like the owner: their facts, their way of writing, in the customer's language, always the polite "you".
- Shows it read the message: any question connects to something they actually said.
- Short. Says something new or says less. Never repeats a sentence or an opening already sent.
- No bragging (no "top agent", "#1", awards), no made-up urgency ("won't last", "lots of interest"), no pressure
  ("if you're serious"), no promises ("top dollar", "guaranteed").
- If they named a feeling ("we're exhausted"), it says so once, tied to what caused it.
- **Never makes up** a price, a number, a date, a time, availability, a booking, a fee or a policy.

**Follow-ups after they go quiet** always carry something useful from the conversation, or one easy question about
what they said. Never "just checking in".

**If they say no**, it writes one short, warm goodbye with no question and no offer, and every later reply stays that
way. **If they're not sure**, it takes the pressure off and offers one useful thing, without asking again.

*How we check it:* the replies accuracy test. Last run on record, 2026-10-14: 10 of 20 judged good; fixes went live
the same day, and no newer run is on record. The founder also trains it on Admin → Train (section 7).

---

## 4. When FollowUp writes

**A new message:** the reply is written within a few minutes. It goes by itself only if the owner allowed that (for
everyone, or for this customer). Otherwise it waits on Today for the owner's OK.

**If nothing real has gone back** within 3 hours of a new customer's first message, FollowUp steps in so they aren't
left waiting (24 hours for someone already in a conversation). This is the "Reply for me when I haven't" switch, on
unless the owner turned it off.

**If they go quiet**, one of three plans:
- **Fast** (most customers): day 1, 3, 7, 14 and 30 after they went quiet.
- **Long** (Later customers): the Fast days, then once a month, up to 6 months.
- **The owner's own**: the days the owner picks.

**Rules on every plan, whatever the owner sets:**
1. It stops when they book, reply or say no.
2. It stops 6 months after their last message. If they write again, it starts again. (The founder set this from
   Canada's anti-spam guidance; it's not a legal opinion.)
3. Never more than 1 message a day, or 3 a week, to one customer.
4. If they say when to come back ("try me in March"), nothing goes before then, and FollowUp brings them up on that day.

**Messages FollowUp starts by itself only go out between 8am and 8pm** in the business's time zone. A reply to someone
who just wrote can go at any hour.

**Instagram and Messenger:** Meta only allows a reply within 24 hours of the customer's last message, so FollowUp
follows up the next day, inside that window, and asks once for an email so it can keep in touch after.

**People who said yes to hearing from you** get a note when the owner has something new for them.

---

## 5. When FollowUp stops

- They said **no**, not interested, or went with someone else: no reminder ever, until they write again.
- They said **STOP**: nothing more on any channel.
- They **booked** (the booking link, or a booking in the owner's CRM).
- They **have an agent**, unless the owner presses "Keep following up anyway".
- The owner marked them **won or lost**, or turned FollowUp **off** for this customer.
- The owner's own **workflow** is running for them: then only the workflow writes.
- The owner's **CRM** says do not disturb, or the CRM is already following up with them: FollowUp only watches.
- **6 months** after their last message.
- The owner said they **already talked to them**.

---

## 6. What always waits for the owner

FollowUp writes the reply but holds it, with one line saying why, when it would:
- use a number, price, day or time nobody in the conversation wrote;
- say whether a home is available (only the owner knows that);
- say a time is booked or confirmed;
- say the owner already sent, called or arranged something the conversation doesn't show;
- say what's free, included, refundable or guaranteed, or what the owner charges, before the owner has said so.

And always when the customer asks **"Am I talking to a real person?"**

A reply that reads as pushy or bragging never goes out by itself: FollowUp writes it again, and if it still reads
that way, the owner sees it first.

---

## 7. How FollowUp learns, and remembers

Everything below is kept in the app's database, so nothing depends on anyone's memory:

- **Facts about the business** ("Commission: 2.5%", "Areas: Toronto and Mississauga"). Learned from replies a person
  sent from FollowUp, word for word. A new learned fact **waits for the owner's OK** before it's used. Never a fact
  about a customer.
- **The owner's way of writing**, from replies they sent and replies they edited.
- **"Not a customer, it's a …"**: each time the owner says it, the next judgement uses it.
- **The owner's CRM call notes** (GoHighLevel) fill in the checklist too.
- **Training by the founder, per kind of business** (Admin → Train):
  - *Talk to it*: the founder plays a customer. "Good" keeps a reply as an example. "Teach a better reply" keeps a
    better one.
  - *Tell FollowUp what's wrong*: the founder's words become one rule for every realtor. Every reply for that kind of
    business reads the newest 20 rules, and up to 3 examples after the owner's own.
  - *Scorecard*: how many good examples each kind has.

**What isn't remembered yet:** the trained rules live in the app, but they aren't copied into this page by themselves.
Until there's a Playbook page in the app that shows them live, each new rule is added here by hand.

---

## Open gaps (to fix before or during the pilot)

1. No accuracy test for the call on businesses other than real estate.
2. The accuracy scores above are from 2026-10-14. Run all four again before the pilot starts.
3. Trained rules (section 7) aren't shown next to this page automatically.
