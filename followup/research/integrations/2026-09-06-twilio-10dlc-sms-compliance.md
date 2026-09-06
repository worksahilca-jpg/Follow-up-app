# Twilio SMS — A2P 10DLC compliance cost research

**Researched:** 2026-09-06, by integrations-research-agent
**Status of this write-up:** first pass. No prior Twilio file existed in `research/integrations/` (only `gmail.md` and `gmail-scope-justifications.md`).
**Prompted by:** customer-research-agent's 2026-09-05 pass (`research/customers/2026-09-05-icp-pain-points-trust-pricing.md`, Section 4), which flagged that Podium customers specifically complain about surprise 10DLC compliance fees and asked whether FollowUp's flat $29/mo absorbs this cost structure.

## Methodology note (read before trusting exact numbers)

`WebFetch` was unavailable for this task, same as the prior two research passes on record: I tried `www.twilio.com` directly and got `EGRESS_BLOCKED` from this sandbox's network policy, matching `gmail.md`'s and the 2026-09-05 customer-research pass's own methodology notes. Every finding below comes from `WebSearch` instead, which reaches and quotes Twilio's own docs and reputable secondary sources through a different path. Every claim is cited with the URL WebSearch attributed it to and the date checked (2026-09-06). Where sources disagreed on an exact figure, I've said so explicitly rather than picking one — **whoever actually registers FollowUp customers' Twilio numbers for A2P 10DLC should re-confirm exact current fees directly against `twilio.com/docs` and the live Twilio Console pricing page** before relying on any number here for a cost estimate shown to a customer.

## 0. What FollowUp's Twilio integration actually does today (code-grounded, not external research)

I read `src/lib/twilio.ts`, `src/app/api/twilio/config/route.ts`, `src/components/TwilioConfig.tsx`, and the `Business` model in `prisma/schema.prisma` before researching anything external, per this agent's own instructions.

- **This is a bring-your-own-Twilio model, not a FollowUp-managed pool.** Each business pastes its own Twilio Account SID, Auth Token, and phone number into Settings (`twilioAccountSid`, `twilioAuthToken`, `twilioPhoneNumber` on `Business` — all nullable, all filled in by the customer). `sendSms()` in `twilio.ts` authenticates to Twilio's REST API with that business's own credentials (HTTP Basic Auth, Account SID as username, Auth Token as password) and sends `From: business.twilioPhoneNumber`. **This means every dollar Twilio charges for SMS — base per-message cost, phone number rental, and any A2P 10DLC registration/carrier fee — is billed by Twilio directly to the customer's own Twilio account, never to FollowUp.** This is the single most important fact for the pricing question below.
- **There is no `messagingServiceSid` field anywhere** — not in the schema, not in `twilio.ts`, not in the config route. Sends go out via a raw phone number, not a Messaging Service. Whether that matters for 10DLC compliance is addressed directly in Section 5 below, since it's the crux of whether this is a code gap.
- **The cost is already partially, but incompletely, disclosed in-product.** `TwilioConfig.tsx`'s own copy (Settings → "Phone (SMS + calls)") reads: *"Needs a Twilio account and phone number (paid, ~$1/mo + per message/call — not required to use the rest of FollowUp)."* So the "flat $29, everything included" claim is **already implicitly carved out** for SMS, in the product's own words — but only in Settings copy a customer sees after signing up and going to connect a number, not on the landing page itself, and (per Sections 1-4 below) the "~$1/mo + per message/call" figure itself undersells the real total once 10DLC registration and Twilio's own recurring campaign fee are counted — neither is mentioned anywhere in this copy.
- **Landing page (`src/app/page.tsx`) makes no SMS-specific carve-out at all.** Its pricing section says only *"One plan. Everything included. Cancel any time."* next to the $29 price — a customer who reads only the landing page has no reason to expect any SMS-specific cost until they reach Settings.
- **An adjacent, unrelated stale-copy bug, noted but out of scope for this file's question:** the integrations card directly above the real Twilio section still lists *"Outlook, Instagram, WhatsApp, SMS — coming soon"* (`src/app/(app)/settings/page.tsx:332`), even though the fully-real "Phone (SMS + calls)" / `TwilioConfig` section sits right below it. Worth a heads-up to whoever owns that page; not otherwise part of this research.
- **No mention anywhere in code or product copy of A2P 10DLC, brand registration, campaign registration, or carrier surcharges.** Confirmed via `grep -i "10dlc\|a2p\|brand regist\|campaign regist\|messagingservice"` across `src/` — zero matches. This confirms the premise this task was dispatched on: genuinely unresearched territory, not something already answered elsewhere in the repo.

---

## 1. A2P 10DLC brand registration (one-time)

- **Low Volume Standard Brand**: one source puts the one-time registration fee at **~$4**; another, more detailed source puts it at **~$24.50**. These likely reflect different bundling of what counts as "brand" vs. "brand + first campaign" fees across the sources I could reach — I could not reconcile them to a single confident number.
  (Sources: [readysms.io/blog/10dlc-registration-cost](https://readysms.io/blog/10dlc-registration-cost), [ghlscaleup.com/blog/a2p-10dlc-fees-explained](https://www.ghlscaleup.com/blog/a2p-10dlc-fees-explained), via WebSearch, checked 2026-09-06.)
- **Standard Brand** (full EIN-verified brand, higher throughput): **~$71.91** one-time, from the same search pass.
  (Source: WebSearch synthesis citing Twilio Trust Hub brand-registration pricing, checked 2026-09-06.)
- These fees are set by **The Campaign Registry (TCR)**, an external body — Twilio and other messaging platforms pass them through without markup, per multiple secondary sources. This matches the general shape of Twilio's own framing that 10DLC costs are largely carrier/registry pass-throughs, not Twilio's own margin.
  (Sources: same as above, checked 2026-09-06.)

**Confidence: medium-low on the exact dollar figure** (two disagreeing numbers for the same brand type), **medium-high on the general shape** (small, roughly $4–$25 one-time cost for the brand tier that fits FollowUp's small-business customers, vs. a meaningfully higher ~$72 for the full Standard tier).

---

## 2. Campaign registration (one-time) — and which use-case classification actually fits FollowUp

Twilio (and TCR) classify A2P 10DLC brands/campaigns by tier, and the tier that fits changes both the cost and the vetting burden:

- **Standard**: requires a Tax ID (EIN or equivalent), full vetting, highest throughput ceiling, highest cost and scrutiny. Overkill for a solo/small-team follow-up-SMS customer sending well under a thousand messages a month.
- **Low Volume Standard** (campaign use-case sometimes called "Low Volume Mixed"): requires an EIN or equivalent business identity, but is explicitly designed for "mixed messaging campaigns with multiple use cases," easier to obtain than Standard with no extensive vetting, and — critically — **fixed at the lowest throughput tier with a lower monthly fee than Standard**. This is the best fit for most of FollowUp's ICP: a real small business (with an EIN) that wants to text leads and follow-ups, not run high-volume marketing blasts.
  (Source: [support.twilio.com — Comparison between Sole Proprietor, Low Volume Standard, and Standard registration](https://support.twilio.com/hc/en-us/articles/4407882914971-Comparison-between-Sole-Proprietor-Low-Volume-Standard-and-Standard-registration-for-A2P-10DLC), via WebSearch, checked 2026-09-06.)
- **Sole Proprietor**: does **not** require an EIN — fits a genuine solo operator (e.g., the solo/small-team real-estate-agent segment customer-research-agent's Section 1.3 names) who may not have one. Fixed throughput, no Trust Score, capped at **1,000 msg/day to T-Mobile numbers and 3,000 SMS segments/day across all carriers per campaign** — comfortably above the 20-100 leads/month volume this task asked about (that's roughly 1-3 messages/day on average), so the cap is not a practical constraint at FollowUp's stated volume. Cheapest and least-vetted tier, but limited to fewer numbers/campaigns than Low Volume Standard.
  (Source: [help.twilio.com — Message throughput (MPS) and Trust Scores for A2P 10DLC](https://help.twilio.com/articles/1260803225669-Message-throughput-MPS-and-Trust-Scores-for-A2P-10DLC-in-the-US), via WebSearch, checked 2026-09-06.)
- **Campaign vetting fee: $15**, one-time, charged at the time of vetting, and this figure is consistent across Standard, Low Volume Standard, and Sole Proprietor per Twilio's own support article — the one number in this section I'm most confident in.
  (Source: [support.twilio.com — A2P 10DLC Campaign Vetting FAQ](https://support.twilio.com/hc/en-us/articles/11587910480155-A2P-10DLC-Campaign-Vetting-FAQ), via WebSearch, checked 2026-09-06.)
- **Registration/approval timeline**: one source (Twilio-adjacent, current) says campaign reviews are "currently taking 10-15 days" due to submission volume; other, likely-older secondary sources describe "1-4 weeks." Treat 10-15 days as the more current figure but budget toward the upper end.
  (Sources: WebSearch synthesis of Twilio direct-registration guide pages, checked 2026-09-06.)

**Total one-time registration cost, best-fit tier for FollowUp's ICP**: roughly **$19-$40** (brand fee $4-$25, plus the $15 campaign vetting fee), for either Low Volume Standard or Sole Proprietor, whichever matches whether the customer has an EIN. **Confidence: medium** — the vetting fee is solid, the brand fee has a real range I couldn't collapse further.

---

## 3. Recurring monthly fees Twilio itself passes through

- **Twilio's own per-campaign monthly fee**: reported at **$1.50-$10/month**, varying by use-case/throughput tier — Low Volume Mixed sits at the low end (**~$1.50/mo** is the figure repeated across sources), Standard-tier campaigns with higher throughput sit toward the higher end. This fee is charged as long as the campaign stays active, separate from and in addition to the phone-number rental (~$1/mo) already disclosed in `TwilioConfig.tsx`.
  (Sources: [ghlscaleup.com/blog/a2p-10dlc-fees-explained](https://www.ghlscaleup.com/blog/a2p-10dlc-fees-explained), [sociocs.com/post/twilio-10dlc-explained](https://www.sociocs.com/post/twilio-10dlc-explained/), via WebSearch, checked 2026-09-06.) **This fee is currently undisclosed anywhere in FollowUp's product copy.**
- **T-Mobile-specific "non-use fee": $250, passed through, if a registered campaign sends zero traffic to a T-Mobile handset in a rolling 60-day period.** This is a genuinely non-obvious risk worth flagging on its own: a low-volume small-business customer (this task's own 20-100 leads/month range) could plausibly go 60 days without a single lead having a T-Mobile number, especially early on, and get hit with a real, unexpected $250 charge on their own Twilio bill that has nothing to do with how much they've actually sent. I did not find this fee mentioned in any FollowUp-adjacent source — it's specific to T-Mobile's own policy.
  (Source: [telgorithm.com/news/t-mobiles-non-use-fee-for-a2p-10dlc-campaigns](https://www.telgorithm.com/news/t-mobiles-non-use-fee-for-a2p-10dlc-campaigns), via WebSearch, checked 2026-09-06.)
- **T-Mobile raised its A2P pass-through fees again, effective January 15-19, 2026** (sources differ slightly on the exact effective date, both within days of each other) — described by one secondary source as an "80% increase" and by Twilio's own help center in an article titled "T-Mobile Messaging Carrier Fee Changes (January 2026)" (`help.twilio.com/articles/44609260499995`). **I could not read that Twilio article's actual content** — WebSearch reported it requires JavaScript to render, and WebFetch to any Twilio-owned domain is blocked in this sandbox — so **I cannot state the new exact post-hike per-message T-Mobile rate with confidence**. One older/lower figure that pre-dates this hike puts the AT&T/T-Mobile/Verizon blended carrier surcharge at roughly **$0.003/message segment**; treat that as a stale floor, not the current number, until someone with real browser/fetch access pulls the live figure from that specific Twilio help article.
  (Sources: [telgorithm.com/news/t-mobile-announces-new-2026-a2p-sms-pass-through-fees](https://www.telgorithm.com/news/t-mobile-announces-new-2026-a2p-sms-pass-through-fees), [bandwidth.com — Changes to T-Mobile rates on January 15, 2026](https://www.bandwidth.com/support/en/articles/13123714-changes-to-t-mobile-rates-on-january-15-2026), checked 2026-09-06.)

**Confidence: medium on the ~$1.50-10/mo Twilio campaign fee** (consistent across sources); **low on the exact current T-Mobile per-message surcharge post-January-2026** (the one number in this whole report I'd flag as most in need of direct primary-source re-verification before it goes anywhere customer-facing); **medium-high that the $250 T-Mobile non-use fee is real and a genuine small-volume-customer risk**, since it comes from a source specializing in carrier pass-through fees specifically and matches the general shape of how carriers police idle registrations.

---

## 4. Per-message carrier fees at 20-100 leads/month — realistic ballpark

- **Twilio's base outbound SMS price**: **~$0.0079/segment** is the more frequently cited current figure; one source says $0.0083 — treat as ~$0.008/segment, minor source disagreement.
  (Source: [twilio.com/en-us/sms/pricing/us](https://www.twilio.com/en-us/sms/pricing/us) as cited via WebSearch synthesis, checked 2026-09-06 — I could not load this page directly, see Methodology note.)
- **Plus the A2P 10DLC carrier surcharge**, reported (pre-2026-hike) at roughly **$0.003/segment**, blended across AT&T, T-Mobile, and Verizon — bringing the pre-hike effective cost to **~$0.011/segment**. Per Section 3, this floor is stale specifically for T-Mobile post-January-2026; the true current blended number is somewhat higher but I could not pin an exact figure.
  (Sources: same cluster as Section 3, checked 2026-09-06.)
- **At this task's stated volume (20-100 leads/month via SMS, assuming ~1 segment per message — i.e., under ~160 characters GSM-7):**
  - 20 messages/month: roughly **$0.20-$0.30/month** in message + carrier fees.
  - 100 messages/month: roughly **$1.10-$1.60/month**.
  - A message that spans 2 segments (a longer follow-up text) roughly doubles these numbers — still trivial at this volume either way.

**The headline finding of this section: per-message carrier cost is not where the real money is at FollowUp's realistic single-customer SMS volume.** It's genuinely small change — well under $2/month even at the high end of the stated range. The costs that actually matter are the one-time registration (Section 1-2) and Twilio's own recurring campaign fee (Section 3), neither of which scales with message volume the way a "per-message cost" framing might suggest.

**Confidence: medium** — the base Twilio rate is solid, the current blended carrier surcharge (especially T-Mobile's) is the part I'd re-verify before quoting to a customer.

---

## 5. Does the flat $29/mo plausibly absorb this — and is there a real backend code gap?

### 5a. Whether $29/mo needs to "absorb" this cost at all

**Because FollowUp's Twilio integration is bring-your-own (Section 0), FollowUp itself never pays any of these fees — the customer's own Twilio account is billed directly.** So in the strict sense of "does FollowUp's own cost-of-goods-sold at $29/mo cover this," the answer is: **there's nothing for FollowUp to absorb, because the cost was never FollowUp's to begin with.** This is structurally different from, say, a shared-Twilio-account model where FollowUp would be paying Twilio on every tenant's behalf and would need the $29/mo to cover it. It's the same externalization pattern the product already uses for Gmail sending (mail goes out via the business's own connected Gmail/Workspace account, not a FollowUp-owned mailbox).

### 5b. Whether that structurally settles the customer-facing risk customer-research-agent flagged

**No — the underlying "surprise fee" risk is real regardless of who technically pays Twilio, because the customer experiences it as one thing: what "$29/mo, everything included" actually costs them to use SMS.** The product's own Settings copy already discloses *some* of this ("~$1/mo + per message/call — not required to use the rest of FollowUp"), which is honest and a real mitigant — this isn't a total blind spot the way it would be if nothing were disclosed anywhere. But per Sections 1-3, that disclosure **omits the one-time 10DLC registration cost (~$19-$40) and Twilio's own recurring campaign fee (~$1.50-$10/mo) entirely** — a customer who reads only that line and budgets "~$1/mo" for SMS would be caught off guard by an extra $20-40 up front and a few dollars a month on their own Twilio invoice that nothing in FollowUp's product ever mentioned. That's the same shape of complaint customer-research-agent found specifically about Podium — a real cost that exists industry-wide, landing on the customer as a surprise because the tool they trusted didn't mention it — just showing up on the customer's Twilio bill instead of FollowUp's own invoice.

**Direct answer: the flat $29/mo does not need to "absorb" this cost in a COGS sense, because of the BYO-Twilio architecture — but the product's current disclosure of what SMS actually costs is incomplete, and that gap is real and currently unaddressed, not something already handled elsewhere.**

### 5c. Is there real backend implementation work here? (the critical question)

I looked specifically at whether `sendSms()` in `twilio.ts` — which sends via a raw `From: business.twilioPhoneNumber`, with no `messagingServiceSid` anywhere in the schema or code — needs to change for a 10DLC-registered number to actually send compliant traffic.

**Finding: no code change is required.** Twilio's current registration flow does tie a phone number to a Messaging Service, which is in turn linked to an approved Campaign — but that association is configured entirely in the business's own Twilio Console as part of registering (adding their number to a Messaging Service's Sender Pool), not something FollowUp's API call needs to construct or reference. Critically, **sending via a raw `From: <phone number>` parameter — exactly what `sendSms()` already does — continues to work normally for a number that has been 10DLC-registered this way.** The one difference: Twilio's own Messaging Insights/logs won't attribute that send to the Messaging Service unless the caller also passes `MessagingServiceSid` — a Twilio-side observability/analytics nicety, not a functional requirement for the message to send or for carriers to treat it as compliant traffic.
(Sources: [twilio.com/docs/messaging/services](https://www.twilio.com/docs/messaging/services), [twilio.com/docs/messaging/api/message-resource](https://www.twilio.com/docs/messaging/api/message-resource), and Twilio error-reference pages 21603/21703/30034, all via WebSearch synthesis, checked 2026-09-06.)

**So: this is purely an operational/compliance task — the business (or, in FollowUp's BYO model, the end customer) registering their own brand and campaign in their own Twilio Console — with no code-level gap for backend-agent to close.** `sendSms()` does not need a `messagingServiceSid` field added to the schema, and the existing sending path is already compatible with a 10DLC-registered number once that registration exists on Twilio's side.

**Confidence on 5c: medium-high.** Two independent WebSearch passes on the specific "does `From` still work vs. requiring `MessagingServiceSid`" question converged on the same answer, and it's corroborated by Twilio's own error-code documentation (21603, 21703) describing `From` and `MessagingServiceSid` as alternative, not mutually exclusive, ways to specify a sender. I could not verify this directly against Twilio's primary docs page in this sandbox (WebFetch blocked), so treat it as **should be spot-checked once real fetch access exists**, not as fully closed — but I would not dispatch backend-agent on the strength of this alone; the operational read is the confident one.

The one gap that **is** real, but is not the kind of code work the critical ask is asking about: `TwilioConfig.tsx`'s disclosure copy understates the true cost (Section 5b). Closing that is a copy/content change to a settings page, not a data-model or backend-logic gap — flagging it here for whoever owns product copy, not for backend-agent.

---

## Should re-verify before treating as settled

- **The exact current T-Mobile per-message pass-through rate post the January 2026 hike** (Section 3) — the single lowest-confidence number in this report. `help.twilio.com/articles/44609260499995` is the right page; it needs real browser/fetch access to read, which this sandbox doesn't have.
- **The exact one-time brand registration fee** ($4 vs. $24.50 — two disagreeing sources, Section 1) — worth pulling directly from Twilio Console's own Trust Hub pricing before quoting a number to a customer.
- **Current campaign approval timeline** (10-15 days vs. an older "1-4 weeks" figure, Section 2) — re-confirm against Twilio's live status once someone can reach `twilio.com/docs` directly.
- **The "no code change needed" finding in Section 5c** — corroborated twice via WebSearch, but not against Twilio's own primary docs page directly (WebFetch blocked). Low-cost to double check once fetch access exists, given how much rides on it.
- **This entire report is WebSearch-mediated secondary-source synthesis, not primary-source reading** — same limitation `gmail.md` and the 2026-09-05 customer-research pass both hit and flagged. Nothing here should be treated as a substitute for someone with real Twilio Console + docs access confirming current numbers before FollowUp commits to any customer-facing cost claim (e.g., in updated Settings copy).

---

## Sources (all checked 2026-09-06 via WebSearch; WebFetch was blocked for every Twilio-owned domain tried in this sandbox, consistent with the two prior research passes on record)

- [twilio.com/docs/trust-hub/registrations/a2p-10dlc-brand](https://www.twilio.com/docs/trust-hub/registrations/a2p-10dlc-brand)
- [twilio.com/docs/trust-hub/registrations/a2p-10dlc-campaign](https://www.twilio.com/docs/trust-hub/registrations/a2p-10dlc-campaign)
- [twilio.com/docs/messaging/compliance/a2p-10dlc](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc)
- [twilio.com/docs/messaging/compliance/a2p-10dlc/direct-standard-onboarding](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/direct-standard-onboarding)
- [twilio.com/docs/messaging/compliance/a2p-10dlc/direct-sole-proprietor-registration-overview](https://www.twilio.com/docs/messaging/compliance/a2p-10dlc/direct-sole-proprietor-registration-overview)
- [support.twilio.com — Comparison between Sole Proprietor, Low Volume Standard, and Standard registration](https://support.twilio.com/hc/en-us/articles/4407882914971-Comparison-between-Sole-Proprietor-Low-Volume-Standard-and-Standard-registration-for-A2P-10DLC)
- [support.twilio.com — A2P 10DLC Campaign Vetting FAQ](https://support.twilio.com/hc/en-us/articles/11587910480155-A2P-10DLC-Campaign-Vetting-FAQ)
- [help.twilio.com — Message throughput (MPS) and Trust Scores for A2P 10DLC](https://help.twilio.com/articles/1260803225669-Message-throughput-MPS-and-Trust-Scores-for-A2P-10DLC-in-the-US)
- [help.twilio.com/articles/1260801844470 — List of campaign use case types for A2P 10DLC registration](https://help.twilio.com/articles/1260801844470-List-of-campaign-use-case-types-for-A2P-10DLC-registration)
- [help.twilio.com/articles/44609260499995 — T-Mobile Messaging Carrier Fee Changes (January 2026)](https://help.twilio.com/articles/44609260499995) (content not directly readable in this sandbox — see note above)
- [twilio.com/en-us/sms/pricing/us](https://www.twilio.com/en-us/sms/pricing/us)
- [twilio.com/docs/messaging/services](https://www.twilio.com/docs/messaging/services)
- [twilio.com/docs/messaging/api/message-resource](https://www.twilio.com/docs/messaging/api/message-resource)
- [twilio.com/docs/api/errors/21603](https://www.twilio.com/docs/api/errors/21603) — 'From' or 'MessagingServiceSid' required
- [twilio.com/docs/api/errors/21703](https://www.twilio.com/docs/api/errors/21703) — Messaging Service has no phone number available
- [twilio.com/docs/api/errors/30034](https://www.twilio.com/docs/api/errors/30034) — Message from an unregistered number
- [ghlscaleup.com/blog/a2p-10dlc-fees-explained](https://www.ghlscaleup.com/blog/a2p-10dlc-fees-explained)
- [readysms.io/blog/10dlc-registration-cost](https://readysms.io/blog/10dlc-registration-cost)
- [sociocs.com/post/twilio-10dlc-explained](https://www.sociocs.com/post/twilio-10dlc-explained/)
- [telgorithm.com/news/t-mobile-announces-new-2026-a2p-sms-pass-through-fees](https://www.telgorithm.com/news/t-mobile-announces-new-2026-a2p-sms-pass-through-fees)
- [telgorithm.com/news/t-mobiles-non-use-fee-for-a2p-10dlc-campaigns](https://www.telgorithm.com/news/t-mobiles-non-use-fee-for-a2p-10dlc-campaigns)
- [bandwidth.com — Changes to T-Mobile rates on January 15, 2026](https://www.bandwidth.com/support/en/articles/13123714-changes-to-t-mobile-rates-on-january-15-2026)
- [bandwidth.com — T-Mobile 10DLC](https://www.bandwidth.com/support/en/articles/12823101-t-mobile-10dlc)

## Internal code read directly for Section 0 (not external research)

- `src/lib/twilio.ts` — `sendSms()`, `findBusinessByTwilioSecret()`, signature validation
- `src/app/api/twilio/config/route.ts` — GET/POST/DELETE for Twilio connection settings
- `src/components/TwilioConfig.tsx` — Settings UI copy, including the existing "~$1/mo + per message/call" disclosure
- `src/lib/sending.ts` — `sendFollowUpToLead()`, confirming SMS is the fallback channel when a lead has a phone but no email
- `prisma/schema.prisma` — `Business` model's `twilioSecret`/`twilioAuthToken`/`twilioAccountSid`/`twilioPhoneNumber` fields (no `messagingServiceSid` field exists)
- `src/app/page.tsx` — landing page pricing section copy ("One plan. Everything included.")
- `src/app/(app)/settings/page.tsx` — the stale "...SMS — coming soon" line adjacent to the real Twilio section
- `src/lib/billing.ts` — `BILLING_LOCKED_MESSAGE`, confirming the $29/mo flat-plan gate
