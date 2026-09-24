# Can FollowUp send SMS from a business's OWN number?

**Date:** 2026-09-24
**Asked by the founder:** *"I want the number that the realtor is using or any other business is
using. That number will be sending SMS with the help of FollowUp. FollowUp will be sending the
messages using the numbers that a business already has, not the one that is unknown."*

This is the same requirement that moved WhatsApp off Twilio on 2026-09-19 — *"Nobody wants to
bring or use a new number that is nowhere exposed for a business"* — applied to SMS. It is the
right requirement. A realtor's number is on their sign, their card and their Google listing; a
stranger's number gets ignored.

**Sourcing note.** `twilio.com` and `developers.google.com` are both blocked by this sandbox's
egress proxy, so nothing below was read from a vendor page directly. Every claim is from search
snippets returned *from* vendor domains (twilio.com doc and error pages, podium.my.site.com,
help.housecallpro.com) and cross-checked against at least one independent source. **Graded B.**
The one number that matters most — mobile ineligibility — is graded **A-minus**: it appears in
Twilio's own error documentation, Twilio's Hosted Numbers FAQ, and an unrelated industry
explainer, all agreeing.

---

## The answer

**Yes, and the mechanism is called Hosted SMS — but only if the number is a landline or
toll-free. Mobile numbers are not eligible, and that is most of FollowUp's ICP.**

### How Hosted SMS works

A phone number is a bundle of permissions: voice, SMS, MMS. Hosting takes **only the SMS
permission** and points it at Twilio. Voice stays exactly where it is, with the business's
existing carrier, on their existing phone. Nothing is ported, nothing moves, their phone keeps
ringing as it always did.

Podium — a direct competitor at ~$400/mo — describes its own implementation in precisely these
terms: it *"borrows the SMS and MMS permissions for that number, allowing you to send and
receive text messages using the same number you use for phone calls."* So the founder's
requirement is not exotic; it is what the category already does.

Ownership is proved by a one-time passcode to the number. Twilio's Hosted Numbers API covers
**US and Canada**.

### The constraint that decides this

| Number type | Can Twilio host its SMS? |
|---|---|
| Landline | **Yes** |
| Toll-free | **Yes** |
| **Mobile / wireless** | **No** |
| VoIP | **Unclear — see below** |

Twilio's error `22110: Phone Number Not Hostable` reads *"The number is type mobile or voip and
therefore cannot be hosted."* The Hosted Numbers FAQ states the eligibility check fails on
*"already Hosted Number, non-supported country, Mobile type."* An independent industry explainer
gives the reason: *"Mobile phone SMS is hosted by your mobile carrier, so third-party services
are typically unable to host texting through their apps with your mobile number."*

**VoIP is genuinely uncertain.** Twilio's error text lumps it in with mobile; the industry
explainer lists VoIP as hostable; Podium says VoIP *"must request permission from your phone
service provider — some allow this, some may not."* Treat VoIP as per-number and per-carrier,
answerable only by an eligibility check, never by a promise up front.

### Why this is a problem for FollowUp specifically

`research/customers/2026-09-05-icp-pain-and-trust-objections.md` puts the ICP as an owner
"up a ladder" — a contractor, a realtor, a solo operator. **Their business number is their
mobile.** They have no landline. So for the typical FollowUp customer, Hosted SMS fails
eligibility and there is no path to texting from the number their customers know.

### What the alternatives cost

1. **Port the mobile into Twilio.** The number moves wholesale. Housecall Pro says it plainly to
   its own customers: *"once you port over your cell phone number, it will no longer be active
   with your existing carrier. You will need to get a new personal line."* For someone whose
   cell **is** their business, this is worse than a new number, not better.
2. **A new Twilio number.** Rejected on 2026-09-19 for WhatsApp, and the objection holds
   identically here.
3. **Do nothing on SMS.** The status quo. Email, Instagram and WhatsApp all already reach the
   lead on a number or address they recognise, and WhatsApp in particular solved this exact
   problem through Coexistence.

---

## The one genuinely useful finding

Twilio shipped a **Hosted Numbers Eligibility API** (public beta, US and Canada) that answers
*"can this specific number be hosted for SMS?"* in minutes rather than the two business days a
manual check used to take.

That is the right shape for FollowUp whatever is decided about SMS, because it converts an
unanswerable promise into a checked fact. **Ask for the number, check it, then say what is
actually possible for that business** — rather than advertising SMS and discovering at setup
that their number cannot carry it. The same discipline the Meta window badge now applies to DMs.

---

## Recommendation

**Do not build SMS now**, and not because the mechanism is wrong — the founder's design is
correct and matches what Podium ships. Because:

- The typical FollowUp customer is on a mobile and would fail eligibility.
- There is **one SMS message in the entire production database**, against 66 emails.
- A2P registration still applies on top, at 10–15 days plus AT&T's own 2–4 week review, **per
  customer**, even with FollowUp submitting it through the ISV API.
- Running costs (per number, per message) land on FollowUp in the ISV model and have to be
  recovered in pricing — Twilio only covers the *registration* fees at Starter Brand volume.

**If and when SMS is built**, the order is: eligibility check first, honest answer second, A2P
registration third, sending fourth. Never offer the channel to a business whose number cannot
carry it.

**Worth revisiting if** FollowUp's ICP shifts toward businesses with landlines or toll-free
numbers (clinics, dealerships, offices with a front desk), where Hosted SMS works as intended
and the founder's requirement is fully satisfiable.

---

## Sources

- Twilio, Hosted Numbers FAQ — `twilio.com/docs/phone-numbers/hosted-numbers`
- Twilio, error 22110 "Phone Number Not Hostable" — `twilio.com/docs/api/errors/22110`
- Twilio, Hosted Number Orders API Quickstart — `twilio.com/docs/phone-numbers/hosted-numbers/quickstart`
- Twilio changelog, "Hosted Numbers Eligibility API Now in Public Beta for US and Canada"
- Podium, "Hosting your Business Number in Podium" — `podium.my.site.com`
- Housecall Pro, "Texting Number" and "Manage your phone numbers" — `help.housecallpro.com`
- MessageDesk, "How to Get a Business Text Number Without a New Line"
- Prior FollowUp research: `2026-09-06-twilio-sms-compliance.md`,
  `2026-09-08-twilio-a2p-self-serve-api-scoping.md`, `2026-09-19-whatsapp-coexistence.md`
