# CRM "Do not contact", closed, and stages: what is known (2026-10-14)

**Question:** Before FollowUp reads "Do not contact" and closed from a CRM, and writes a stage back (A-252: shown as
"Soon"), which fields hold them in Follow Up Boss and HubSpot?

**Method and limits:**
- The official developer documentation could not be opened from the build sandbox: docs.followupboss.com,
  help.followupboss.com and developers.hubspot.com don't resolve there.
- Everything below comes from web search summaries of those pages, HubSpot's community and knowledge base, and
  third-party connector docs. Each item is marked with how sure it is.
- Nothing here is built. It is the starting point for when a tester names their CRM (A-252's build order).

## HubSpot

| What | Field | How sure |
|---|---|---|
| Unsubscribed from all email | `hs_email_optout` (label "Unsubscribed from all email"); `"true"` when opted out | **Likely.** HubSpot's knowledge base names the label. Community threads name the internal field. Reported read-only through the Contacts API. |
| Per-type email opt-outs | Subscription types, kept apart from the field above | Likely; same sources. |
| Lead status | `hs_lead_status`; default options New, Open, In Progress, Open Deal, Unqualified, Attempted to Contact, Connected, Bad Timing | **Likely**, from HubSpot's knowledge base. Each account can change the options, so writing a value that isn't there fails. |
| Lifecycle stage | `lifecyclestage` | Known from FollowUp's earlier HubSpot work; its values weren't re-checked here. |

## Follow Up Boss

| What | Field | How sure |
|---|---|---|
| Stages list | `GET /v1/stages`, with name, order, a protected flag and people count. `POST /v1/stages` takes `name`. | **Likely**, from a summary of the official reference. |
| Default stages | Lead, Contact, Buyer, Nurture, Closed, Past Client, Sphere, Trash. The help center also suggests Active Client, Hot Prospect and Unresponsive. | Likely. Accounts rename and add stages. |
| "Trash" | "Contacts you are no longer working with." Hidden from smart lists, and their action plans pause. Protected, like Lead (and Closed, per one secondhand source). | **Likely**, from a help-center summary. |
| A person's stage | Probably `stage` (name) on the person; `stageId` was not confirmed | **Not confirmed.** |
| A "do not contact" flag | Not found. Third-party compliance tools check the national Do Not Call list instead. Custom fields may hold it. | **Not found.** |
| Webhooks | Need a registered system (`X-System` header). Retried for up to 8 hours. A `FUB-Signature` exists, but how it is checked wasn't found. | Partly; official and third-party sources disagree on `X-System`. |
| One-click sign-in (OAuth) | Authorization code flow at `app.followupboss.com/oauth/authorize` and `/oauth/token`. The client app is tied to a registered system. The secret is shown once. | **Likely**, from summaries of the official OAuth guide. |

## What this means for the build

- **Reading:**
  - HubSpot's `hs_email_optout` is safe to read: a missing field reads as "not opted out". It is not enough on its
    own to promise "never writes to anyone marked Do not contact". That needs the per-type opt-outs too, or the
    promise has to be narrower ("anyone unsubscribed from all email").
- **Follow Up Boss:**
  - It has no known "do not contact" field to read. "Trash" is the closest signal for "stop": the owner has stopped
    working with them.
  - Reading the person's stage needs one look at a real API response first.
- **Writing a stage:**
  - In both CRMs, stages and statuses are the account's own words, so FollowUp can't write "Replied" or "Booked"
    unless they exist.
  - Options: the owner picks which of their stages means each (one more setting); FollowUp adds its own (HubSpot needs
    a broader permission; Follow Up Boss has `POST /v1/stages`); or tags.
  - This is a product choice for the founder.
- **Before any of it ships:** one real test account, to confirm the field names on a live response. Building on
  guessed names would quietly fail to protect anyone, while the screen claimed it does.

## Open questions for the founder

1. When the CRM says "Do not contact", should FollowUp stop messaging that customer entirely, or only stop writing
   notes there? The approved drawing's wording reads as the first. That is the trust-first reading, and CASL
   consent applies to commercial messages (fact, not legal advice).
2. Is "closed" (Follow Up Boss "Trash", "Closed", "Past Client"; HubSpot "Unqualified" or a customer) a reason for
   FollowUp to stop following up?
3. Stages: should the owner match their own stages, or should FollowUp add its own?

## Sources (search summaries; the pages themselves didn't load here)

- [HubSpot Knowledge Base: import an opt-out list](https://knowledge.hubspot.com/contacts/import-an-opt-out-list)
- [HubSpot Community: batch update email information via API](https://community.hubspot.com/t/batch-update-email-information-via-api/12567)
- [HubSpot Community: webhook for contact opting out of email](https://community.hubspot.com/t5/APIs-Integrations/Webhook-for-contact-opting-out-of-email/m-p/320894/highlight/true)
- [HubSpot blog: manage sales process with lead status](https://blog.hubspot.com/customers/manage-sales-process-hubspot-lead-status)
- [Follow Up Boss help: Changing a Lead Stage](https://help.followupboss.com/hc/en-us/articles/360012456793-Changing-a-Lead-Stage)
- [Follow Up Boss docs: Getting started with OAuth](https://docs.followupboss.com/docs/getting-started-with-oauth)
- [Follow Up Boss docs: webhooks guide](https://docs.followupboss.com/reference/webhooks-guide)
- [withone.ai: Follow Up Boss stages](https://www.withone.ai/knowledge/follow-up-boss/conn_mod_def%3A%3AGMP6DSiJsxI%3A%3AP2dWIoZdRF2tRlB1j-1Q2Q)
- [followupace.com: Follow Up Boss deal stages naming audit](https://followupace.com/blog/follow-up-boss-deal-stages-naming-audit)
