# WhatsApp through Meta's Cloud API, on the owner's own number (Coexistence)

Checked: 2026-09-19. Decision from the founder the same day, in his words: "Nobody wants to
bring or use a new number that is nowhere exposed for a business … Let's build WhatsApp, and
then we'll go with all the features that we have right now. We'll leave Twilio for phone and
SMS."

This supersedes the recommendation in
`2026-09-06-whatsapp-business-production-readiness.md` (Twilio's WhatsApp API). That path
still works and its code stays live (`sendWhatsApp` in `src/lib/twilio.ts`, the
`/api/twilio/whatsapp/[secret]` webhook), but it is no longer what Settings offers. What it
asked of an owner — a second WhatsApp number that lives in Twilio, not in their phone — is
the thing the founder rejected.

## The problem, plainly

A small business's WhatsApp number is on their van, their storefront, their Instagram bio and
their Google listing. It lives in the WhatsApp Business app on the owner's phone. Any
integration that asks them to abandon that number, or to keep two, is dead on arrival.

Until 2025, connecting a number to the WhatsApp Business Platform (the Cloud API) meant
removing it from the WhatsApp Business app. Meta's **Coexistence** feature changed that: the
same number can be used in the WhatsApp Business app AND through the Cloud API at the same
time. The owner keeps replying from their phone; FollowUp sees every message and can reply
too.

## What Coexistence gives us (Meta's documented behaviour, as of 2025)

Sources: Meta's developer documentation for "WhatsApp Business App and Cloud API Coexistence"
and the Embedded Signup "onboard WhatsApp Business app users" guide, read via web search
snippets on 2026-09-19. Confidence: B — consistent across several sources, not yet verified
against a live account. **The first live connect pins each of these.**

| Fact | What it means for FollowUp |
|---|---|
| Same number in the app and the API at once. Live globally since 2025. | The owner keeps their number and their phone. |
| Requires WhatsApp Business app version 2.24.17 or newer, and the app must be opened at least once every 13 days. | Settings says so. If the owner stops opening the app, the API side pauses. |
| Onboarding is through Embedded Signup with `featureType: "whatsapp_business_app_onboarding"`. The owner scans a QR code with their phone. | One button in Settings, no console work by the owner. |
| Webhook fields: `messages` (customer messages and delivery statuses), `smb_message_echoes` (messages the owner sent from the phone), `history` (a one-time sync of past chats, up to 6 months), `smb_app_state_sync` (contacts and labels). | Owner replies from the phone show up in FollowUp as real outbound messages, so FollowUp never replies on top of one. History gives the owner a populated app on day one. |
| Rate limit: 20 messages per second per number through the API. | Irrelevant at our volume. |
| Group chats do not sync. Media in history is only available within 14 days. | Documented as known limits; group chats were never leads. |
| Messages sent from the WhatsApp Business app are free. API messages inside the 24-hour customer-service window are free. Business-initiated template messages are billed by Meta per message (utility templates in-window become billable from October 2026). | FollowUp's automatic follow-ups are free while the lead is inside 24 hours. The "gone quiet" follow-up past 24 hours needs an approved utility template and costs a few cents. |
| Twilio does **not** support Coexistence. | The Cloud API has to be called directly, with FollowUp's own Meta app. |

## What FollowUp built (this PR)

1. **Connection** — `Business.whatsappPhoneNumberId` (unique, the webhook routing key),
   `whatsappWabaId`, `whatsappAccessToken` (encrypted at rest, `ENCRYPTED_FIELDS` in
   `src/lib/db.ts`), `whatsappDisplayNumber`, `whatsappConnectMode` ("coexistence" or
   "cloud"), and the utility template name/language/body for the post-24-hour follow-up.
2. **Settings → WhatsApp** (`src/components/WhatsAppConfig.tsx`, rewritten) — one "Connect
   WhatsApp" button that opens Meta's Embedded Signup with the Coexistence feature type.
   The signup returns a code plus the phone number id and WABA id; `POST /api/whatsapp/connect`
   exchanges the code for a business token, subscribes FollowUp's app to the WABA, reads the
   display number, and saves. A paste-a-token fallback exists for the founder's own testing
   (a System User token from Business Manager) before App Review.
3. **Inbound** — `POST /api/whatsapp/webhook` (`src/app/api/whatsapp/webhook/route.ts`):
   same verify token and signature check as the Instagram/Messenger webhook, persist-first
   into `InboundWebhookEvent` (channel `whatsapp_cloud`), then
   `processWhatsAppCloudEnvelope` (`src/lib/inbound/whatsappCloud.ts`):
   - `messages` → lead by phone (`+<wa_id>`, the same identity an SMS from that number
     would have), inbound Message keyed on the wamid, STOP/START on `Lead.optedOutAt`, the
     instant acknowledgement (with the DM grace period), scoring and drafting.
   - `statuses` → `Message.deliveryStatus` on the outbound row (sent/delivered/read/failed),
     which the rescue score already reads: a failed delivery makes the lead "Can't reach".
   - `smb_message_echoes` → the owner's own reply from the phone, captured as an outbound
     Message with `source: "whatsapp_direct"`. This is what stops FollowUp replying on top
     of a reply the owner already sent, and what lets the human-neglect rule see the thread
     as answered.
   - `history` → past chats, capture only: no acknowledgement, no drafts, no source routing,
     no sequences. Only threads whose newest message is within
     `HISTORY_IMPORT_MAX_AGE_DAYS` (30) are imported; older ones are not leads anymore.
4. **Outbound** — `sendWhatsAppCloud` (`src/lib/whatsappCloud.ts`), used by
   `sendFollowUpToLead` whenever the business has a Cloud connection (the Twilio path
   remains the fallback for a business that only configured Twilio). Inside 24 hours of the
   lead's last message: plain text. Past 24 hours: the approved utility template with the
   lead's first name, or a plain refusal in words the owner can act on if no template is
   set. Never a fallback to email (R-003).

## What this needs from Meta, and from the founder

- **Meta app**: the same "FollowUp" app that already carries Instagram and Messenger. Add
  the WhatsApp product. Create an Embedded Signup configuration (Facebook Login for
  Business → Configurations) with the WhatsApp Business app onboarding option, and put its
  id in `WHATSAPP_EMBEDDED_SIGNUP_CONFIG_ID`. Register the webhook callback
  `https://followupbase.io/api/whatsapp/webhook` with the same verify token, subscribed to
  `messages`, `smb_message_echoes`, `history`, `smb_app_state_sync`.
- **Permissions**: `whatsapp_business_management` and `whatsapp_business_messaging`. In
  development mode only people with a role on the app can connect; for other businesses
  these need App Review, which needs Business Verification. Both are already on the
  founder's list (`docs/meta-and-twilio-verification-pack.md`).
- **The utility template**: created in WhatsApp Manager (not Twilio) under the business's
  WABA, category Utility, body "Hi {{1}}, just following up on your inquiry — still
  interested? Reply here anytime and I'll get right back to you." Its name and language go
  into Settings → WhatsApp. Each business creates its own; FollowUp cannot do it for them
  until it is a Tech Provider with template-management rights.
- **Billing**: a business-initiated template message is billed by Meta to the WABA's
  payment method. The owner adds a card in WhatsApp Manager. Inside-window replies are
  free.

## What is NOT verified yet

- The exact shape of `smb_message_echoes` and `history` payloads. The processor is written
  to Meta's documented field names and tolerates missing fields; the first live delivery
  is stored raw in `InboundWebhookEvent`, so anything wrong is visible and replayable.
- Whether a number connected through the plain (non-Coexistence) Embedded Signup path
  needs `/register` with a two-step PIN before it can send. The Coexistence path does not
  (the app already registered it). The plain path is saved but not registered by this
  code; Settings tells the owner to connect the number that is in their WhatsApp Business
  app.
- Token lifetime. Embedded Signup returns a business integration system user token, which
  Meta documents as not expiring on its own. If it does expire in practice, the owner
  reconnects from Settings.
