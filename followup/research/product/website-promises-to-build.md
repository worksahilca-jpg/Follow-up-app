# What the website promises that the app doesn't fully do yet

**Why this list exists:** founder, 2026-10-09, on the home-page draft: *"whatever information I'm telling you that we
don't have that feature in our app… keep it in the list. We're going to build the product that way."* The new home page
must not go live promising something the app can't do. Each line is one promise on the page, where it appears, and
what is true today. Update this list as things ship. Remove a line only when the promise is true in the live app.

| # | The page says | Where | True today? | To build |
|---|---|---|---|---|
| 1 | "The right reply, at the right time." Replies come after a natural gap chosen per customer, never instantly. | Hero line; gap picture ("7:11 AM, at the right moment"); demo rail ("8 min") | **Partly.** A fixed 1–2 minute head start on Instagram/Messenger (`DM_ACK_GRACE_PERIOD_MS`, PRODUCT_DIRECTION 2026-09-19); no per-customer timing strategy | A timing strategy per lead: channel, time of day, how the customer writes, urgency. Never instant; within the hour while they're looking |
| 2 | "It qualifies them first. It asks the right questions and gathers what you need to know." Shows *Looking for / Moving / Budget → Qualified, ready for you* | How it works, step 1 | **Partly.** Lead scoring, facts, Instagram question buttons; no general qualification flow that gathers need, timing and budget and marks a lead "qualified" | A qualification flow per business type: which questions, asked naturally over the conversation, with a "Qualified" summary handed to the owner. Plan: `2026-10-09-lead-qualification-strategy.md` §5 |
| 3 | "Booked. Then closed, by you." *Moved: Closed · confirmed by you* | How it works, step 4; follow-up card ("Booked. Job won.") | **Check.** Deals and "won" exist in the data model; confirm the owner can mark a lead closed/won in one tap and that it shows as moved | One-tap "Closed, won" by the owner, with the lead moving to Won |
| 4 | "You don't have to teach it. It picks up your tone, your language and how formal you are." | What's new | **Partly.** Learns facts from sent replies, learns from edits, replies in the customer's language; tone and formality learning not measured | Learn tone and formality from the owner's past and sent replies; show it in "What FollowUp knows" |
| 5 | Check-ins until they're ready (day 3, day 7…) and it stops on a reply or a no | Follow-up card | **Yes** (3/7/14/30, stops on reply, no reminders after a no) | — |
| 6 | "Start free" lets anyone in | Every button | **No** (private-beta allowlist) | Open sign-up before the new page goes live (founder decision, 2026-10-09). Check Google's limits for an unverified OAuth app first |
| 7 | Social profiles, Cookies page | Footer | **No** (placeholders) | Founder sends the handles; cookie page if needed (a legal question) |
| 8 | Each qualification answer shows the customer's own words as proof ("we need 3 bedrooms, near a good school") | How it works, step 1 (v102) | **No.** No per-criterion evidence is stored today | Store each criterion with the quote it came from; "unknown" when there's no quote (`2026-10-09-lead-qualification-strategy.md` §4.1) |
| 9 | The reply ticks off each part of the question (still available ✓ · this weekend ✓ · your showing times ✓) | How it works, step 2 (v102) | **Partly.** Drafts use the owner's facts word for word; no per-question check is shown | Show which parts of the customer's question the draft answered, and which fact each part used |
| 10 | "Booked, and handed to you", with "Why she's ready" in her own words and a booked viewing | How it works, step 3 (v102) | **No.** There's a booking link, but no hand-over card or hot-lead rule | The hot-lead rule from the owner's must-haves and a hand-over card ("Hot because…") (§5 of the strategy doc) |
| 11 | "Did it close? Yes, closed" | How it works, step 4 (v102) | **Check** (same as #3) | One tap from the hand-over card |
| 12 | "We don't train AI models on it." | Your data band; Security page | **Yes today.** But the founder decided (2026-10-09) to train a qualification model on data from owners who opt in | Before any training: an opt-in, new wording on the page and the Security page ("only with your permission"), and the privacy policy checked by the right adviser |

