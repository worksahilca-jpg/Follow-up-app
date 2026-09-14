# Selling a custom automation project

You sell projects, not seats. Each client gets "their own automation for their
business" — their wording, their hours, their systems. What they never see is
that the engine underneath is the same one every other client runs.

That is the whole margin. Protect it: **the client buys an outcome, not a
codebase.** Nothing in a proposal should promise bespoke software.

## What you are actually selling

Not "an automation". Owners do not buy automations — they buy a number they
recognise:

> "You missed 34 calls last month. At your average job value, that is roughly
> $X walking to whoever answered first. This texts every one of them back
> within seconds, and tells you about the ones that still go unanswered."

Get the two numbers before you quote: **how many they miss, and what a job is
worth.** Both come out of the discovery call below. A proposal without them is
a price with nothing to compare itself to.

## Discovery call — 20 minutes, 9 questions

1. When someone calls and nobody picks up, what happens right now?
2. Roughly how many calls a week go unanswered?
3. What is an average job worth to you?
4. Where do new leads come from — website form, Facebook, Google, referrals?
5. When you send a quote, who chases it, and how many times?
6. How do you ask for reviews today?
7. What do you use to track any of this — CRM, spreadsheet, notebook?
8. What are your hours, and what must never happen outside them?
9. Who answers the phone when this works and the calls go up?

Question 9 is not filler. An owner who cannot handle more work will churn no
matter how well this runs, and you want to know that before you build.

## Scoping to a price

Price the project, quote one number, and keep the parts invisible.

**Base — one automation, live, with their wording: $1,200–1,800.**

Add for each of:

| Factor | Add |
|---|---|
| Each additional automation | $400–700 |
| Push into a CRM they already run | $300 |
| A source that has no webhook (scraping a form, an email parser) | $500 |
| Bilingual message sets | $400 |
| They want to edit the wording themselves later | $600 |

Then, separately and always:

**Care plan — $150–400/month.** Number costs, message costs, monitoring,
wording changes, and the fact that someone answers when it breaks.

Take the care plan seriously even though the project fee is the headline. A
project-only client is a client you have to re-sell from zero every time, and
the care plan is the only line here that still pays you next year. If they
refuse it, quote the project higher, not lower — you are carrying the support
either way.

### Sanity check on the price

Your quote should be obviously smaller than the thing it recovers. If they
miss 30 calls a month and a job is worth $400, a 10% recovery is $1,200 a
month. A $1,600 project pays for itself in six weeks, and you can say so out
loud. If that arithmetic does not work for a given business, do not discount —
sell them a smaller scope, or walk.

## The demo that closes it

Do not show a dashboard. Run the simulator:

```bash
npm run simulate -- demo-plumbing
```

It prints the exact texts, with dates, including the 11pm call that waits
until morning. Owners do not need the concept explained — they need to read
the message that would go to their customer and decide whether it sounds like
them. Nine times out of ten they will start editing the wording on the call,
and at that point you are no longer selling.

Better still, build their config first with `dryRun: true`, put *their*
business name and *their* wording in it, and run the simulator on that.

## Proposal template

> **Automation for {{Business}}**
>
> **What we found.** You miss around {{N}} calls a week. Nobody chases quotes
> after the first send. Reviews get asked for when someone remembers.
>
> **What we will put in.**
> 1. Every missed call gets a text back within seconds, in your words, during
>    your hours. If they still do not answer, you get told.
> 2. Every quote is followed up three times over ten days, and stops the
>    moment they reply.
> 3. Every finished job asks for a Google review once, with one reminder.
>
> **What it will not do.** It will not text your customers outside
> {{hours}}. It will not keep messaging anyone who has replied or asked to
> stop. You can switch the whole thing off with one message to us.
>
> **Timeline.** Live and running in test mode within {{N}} business days. We
> go live together on a call, watching your phone.
>
> **Investment.** {{$X}} to build and launch, then {{$Y}}/month for the
> number, the messages, monitoring and changes.
>
> **What we need from you.** Your review link, your booking link, your hours,
> and 20 minutes to record the wording in your voice.

## Where the clients are

In rough order of how fast they say yes:

1. **Trades** — plumbers, electricians, HVAC, roofers, garage doors. Missed
   calls are money and they know it.
2. **Auto** — body shops, detailing, mobile mechanics.
3. **Clinics and salons** — no-shows and reminders are the wedge.
4. **Home services** — landscaping, cleaning, pest control.

Avoid, at first: restaurants (no follow-up culture, brutal margins) and
anything regulated enough to need a compliance conversation before a texting
conversation.

## The one thing to never promise

Do not promise a number of extra jobs. Promise the behaviour — every call
gets a text, every quote gets chased, nothing goes out at 2am — and let the
dashboard show what it did. Promised outcomes are how a project you already
delivered turns into a refund conversation.
