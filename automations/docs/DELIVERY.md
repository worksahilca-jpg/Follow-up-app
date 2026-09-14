# Delivery runbook — from signed to live

Target: **live in test mode inside two working days**, go-live on a call.

Every step below exists because skipping it has a specific failure attached.

## 1. Collect (same day as signing)

Send one message, get everything at once:

> To get started I need six things: (1) your Google review link, (2) your
> booking link if you have one, (3) your opening hours, (4) the mobile you
> want alerts on, (5) who should be named in the messages, (6) how you would
> normally say "sorry we missed your call" to a customer.

Number 6 is the important one. Messages written in your voice, not theirs, is
the most common reason an owner cools on this in week two.

## 2. Build the config

```bash
cp src/clients/_template.ts src/clients/acme-plumbing.ts
```

Then register it in `src/clients/index.ts`:

```ts
import { acmePlumbing } from './acme-plumbing.js';
export const CLIENTS: ClientConfig[] = [demoPlumbing, acmePlumbing];
```

Leave `dryRun: true`. It stays true until the go-live call.

Set `businessHours` from *their* answer, not a default, and get the timezone
right — the engine reads wall-clock time at the business, so a wrong zone
means messages at the wrong hour with no other symptom.

## 3. Check it before you show it

```bash
npm test
npm run simulate -- acme-plumbing
```

The simulator prints the config check first. Fix every ERROR; read every
warning and decide. Then read the transcript as if you were their customer.
Anything that sounds like a vendor rather than the owner, rewrite.

Send the transcript to the owner. Ask one question: *"does this sound like
you?"* Iterate on wording until yes. This is cheap now and expensive later.

## 4. Wire the sources

Buy the number **in the client's own Twilio subaccount**. It is their number;
they keep it if they ever leave. That promise is worth more in the sales
conversation than it costs you in setup.

Put that subaccount's credentials in their own environment variables and name
them in the config, so no two clients share an account:

```ts
secretEnv: {
  twilioAccountSid: 'ACME_TWILIO_SID',
  twilioAuthToken: 'ACME_TWILIO_TOKEN',
}
```

The server prints, per client, which of their credentials are missing at
boot.

Point each source at a webhook, with the `x-automation-key` header:

| Source | Where | Send to |
|---|---|---|
| Missed calls | Twilio number → call handling | `POST /hooks/<client>/call.missed` |
| Inbound texts | Twilio number → messaging webhook | `POST /hooks/<client>/message.inbound` |
| Website form | Zapier / form webhook | `POST /hooks/<client>/lead.created` |
| Quote sent | Their quoting tool, or a manual Zap | `POST /hooks/<client>/quote.sent` |
| Job finished | Their job software, or manual | `POST /hooks/<client>/job.completed` |

**Wire `message.inbound` first and test it.** Without it the engine never
learns that a customer replied, and every sequence will keep chasing people
who already answered. Of everything on this page, that is the one that turns
into an angry phone call.

Verify each one end to end before go-live:

```bash
curl -X POST https://your-host/hooks/acme-plumbing/call.missed \
  -H 'x-automation-key: <AUTOMATION_WEBHOOK_SECRET>' \
  -H 'content-type: application/json' \
  -d '{"From":"+1415...","CallSid":"test-1","name":"Test Caller"}'
```

Then open `/dash/acme-plumbing?key=<AUTOMATION_DASHBOARD_SECRET>` and confirm
the run is there. Still `dryRun`, so nothing left the building.

## 5. Go live — on a call, together

Do not flip this by email.

1. Get the owner on the phone with their mobile in hand.
2. Set `dryRun: false`, deploy.
3. Have them call their own business number and hang up.
4. They receive the text, on their own phone, while you are on the line.
5. Have them reply, and show them the follow-up being cancelled.
6. Send them their dashboard link and tell them to bookmark it.

Step 4 is the moment the project is actually delivered. Everything before it
is you saying it works; that is them seeing it.

## 6. The first week

- Day 1: check the dashboard for `failed` runs.
- Day 3: call. Ask what their customers said. Adjust wording that day.
- Day 7: send the numbers — calls caught, messages sent, replies. This is the
  conversation where the care plan justifies itself, and where referrals come
  from.

## When an owner calls upset

In order:

1. `enabled: false` on their config, deploy. Everything stops. Do this first
   and ask questions after — an owner who sees you stop it instantly forgives
   almost anything.
2. Open their dashboard. Every message the engine sent is listed with a
   timestamp, so you can say exactly what happened rather than guess.
3. Fix, run `npm run simulate` against the fixed config, show them, turn it
   back on.

## Adding a new blueprint

Only when two clients have asked for the same thing. One client asking is a
setting on an existing blueprint, or a no.

1. New file in `src/blueprints/`, following an existing one.
2. Export it from `src/blueprints/index.ts`.
3. A test in `test/blueprints.test.ts` — at minimum: it sends what it should,
   and it stops when the customer replies.
4. Add a row to the catalogue table in `README.md`.
