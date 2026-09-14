# Automations

One engine. One config file per client. Sold as a custom project each time.

This is a separate business from FollowUp, built to fund it. FollowUp is a
product you sell seats of; this is work you sell projects of. The code here is
deliberately boring and dependency-free so that delivering a new client is a
config file and an afternoon, not a build.

## The model

```
  Blueprint          what we know how to build       written once, by us
     +
  ClientConfig       one business owner              written once, per sale
     +
  Engine             runs it, safely                 never touched per client
     =
  "their own automation for their business"
```

If you find yourself editing `src/engine/` for a specific client, stop — that
is a setting you have not added yet. The moment the engine forks per client,
every sale costs what the first one cost.

## What's in the catalogue

| Blueprint | Trigger | The promise you sell |
|---|---|---|
| `missed-call-textback` | `call.missed` | Every missed call gets a text within seconds |
| `lead-intake-router` | `lead.created` | Every lead gets an instant reply, lands in the CRM, gets chased |
| `quote-followup` | `quote.sent` | Every quote is followed up three times, stops when they answer |
| `review-request` | `job.completed` | Every finished job asks for a Google review, once, then stops |
| `no-show-rebook` | `appointment.no_show` | Every no-show is asked to rebook the same day |
| `appointment-reminder` | `appointment.booked` | Every booking gets a reminder the day before |

Adding a seventh is one file in `src/blueprints/` and one line in
`src/blueprints/index.ts`.

## The guardrails (this is what you are actually selling)

Anyone can send a text on a webhook. What an owner is paying for is that it
never embarrasses them:

- **Business hours.** Customer-facing messages outside opening hours are held
  until the business opens, not dropped and not sent at 2am. Owner alerts
  still go out immediately.
- **Stop on reply.** Every sequence checks for a reply before each follow-up.
  Nobody gets chased after they have answered.
- **STOP means stop.** A hard, permanent block per contact, checked before
  every send. The opt-out notice rides the first message of a sequence only.
- **No double sends.** Webhook retries are de-duplicated by the source
  system's own id.
- **Kill switch.** `enabled: false` on the client config stops everything in
  one edit, for the phone call you do not want to be unprepared for.
- **Dry run.** `dryRun: true` records what would have been sent without
  sending it. This is how you demo, and how every client goes live.

## Running it

```bash
npm install
npm test                          # 26 tests, no network, no credentials
npm run simulate -- demo-plumbing # the sales demo — prints the whole week
cp .env.example .env              # then fill it in
npm start
```

### Endpoints

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/hooks/:clientId/:trigger` | Something happened. Needs `x-automation-key`. |
| `POST` | `/cron/tick` | Resume every follow-up whose wait has elapsed. |
| `GET` | `/dash/:clientId?key=…` | The owner's page: what their automation did. |
| `GET` | `/health` | Liveness. |

`:trigger` is one of `call.missed`, `call.completed`, `lead.created`,
`job.completed`, `quote.sent`, `quote.accepted`, `appointment.booked`,
`appointment.no_show`, `message.inbound`, `manual`.

A webhook body can be flat or nested; both of these work:

```json
{ "From": "+14165550142", "CallSid": "CA123", "name": "Maria" }
{ "contact": { "phone": "+14165550142", "name": "Maria" },
  "data": { "service": "water heater" } }
```

Always include the source system's own id (`id`, `externalId`, `eventId`,
`CallSid`, `MessageSid`). That id is what de-duplicates a retried delivery; a
webhook with no id will text the customer once per retry.

`message.inbound` is how replies and STOPs reach the engine — point the
client's Twilio number's inbound webhook at it. Without that wired up,
sequences will keep chasing people who already answered, which is the single
worst failure mode this thing has.

## Credentials, per client

`secretEnv` on a client config names the environment variables to read for
that client:

```ts
secretEnv: {
  twilioAccountSid: 'ACME_TWILIO_SID',
  twilioAuthToken: 'ACME_TWILIO_TOKEN',
}
```

A client that names none falls back to the shared `TWILIO_*` variables, which
is right for your first client and wrong by your tenth. Give each client their
own Twilio subaccount and their own variables, because you have promised them
the number stays theirs. Anything without credentials records instead of
sending, rather than crashing halfway through a sequence.

## Storage

`JsonStore` writes one file, atomically. That is genuinely enough for a
single-client project on one box. When a client outgrows it, implement
`Store` (`src/engine/store.ts`) against Postgres — nothing else changes.

## Docs

- [`docs/SELLING.md`](docs/SELLING.md) — scoping, quoting, and the proposal.
- [`docs/DELIVERY.md`](docs/DELIVERY.md) — the runbook, from signed to live.
