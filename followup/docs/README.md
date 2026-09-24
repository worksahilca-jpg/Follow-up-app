# Docs

How to *do* things. `../research/` is what was *learned* — if you want to know why an
approach was chosen or rejected, that's the folder; this one assumes the decision is made and
tells you the steps.

Grouped by when you'd reach for it.

## Understanding the system

Start here if you're new to the codebase and want the shape of it before reading code.

| | |
|---|---|
| `PRD.md` | The product as actually shipped. **`../PRODUCT_DIRECTION.md` wins if they disagree** — update the PRD, not the reverse. |
| `TRD.md` | The system as actually deployed — architecture, the request paths, how the pieces fit. |
| `BACKEND_SCHEMA.md` | A navigational map of the data model. The real source of truth is `../prisma/schema.prisma`, where every model carries a doc comment explaining *why* a field exists. |

All three are living documents dated 2026-09-08. Treat them as a map, and the code as the
territory.

## Turning a capability on

Each of these is a one-time console setup. They share a shape: what breaks without it, what
still works without it, and the exact steps. **The app runs without every one of them** — a
feature that's off for want of a key is not a feature that's broken.

| | Turns on |
|---|---|
| `gmail-push-setup.md` | New mail seen in seconds instead of on the ten-minute poll |
| `meta-oauth-setup.md` | One-click Instagram / Facebook / WhatsApp connect, instead of pasting a token by hand |
| `outlook-setup.md` | The Outlook "Connect" button — without it, only Gmail works |
| `error-monitoring-setup.md` | Sentry. Without it, an error spike or a run of forged webhook signatures is invisible until a customer complains |
| `least-privilege-db-role.md` | A database role for the running app that can't alter or drop tables |

## Getting a channel unblocked

Verification and app review — the slow, one-time, account-owner-only work. Do them in the
order each pack gives.

| | |
|---|---|
| `verification-business-info-checklist.md` | **Read first.** The documents and facts to gather *before* opening either form, so filling it in is copy-and-paste |
| `google-verification-pack.md` | Google OAuth verification, start to finish |
| `meta-and-twilio-verification-pack.md` | Meta App Review and Twilio's ISV registration, same shape |
| `channel-verification-submissions.md` | Draft submission text for Google and Meta — starting points to edit, not to send as-is |

The research behind all four is
`../research/integrations/2026-09-10-meta-google-verification-playbook.md`, and the current
Meta App Review pack (justifications, shot lists, pre-flight) is
`../research/integrations/2026-09-23-meta-app-review-submission.md`.

## Security

| | |
|---|---|
| `security.md` | What the code enforces today, and what only the owner can do. **Re-run its checklist after any change to auth, webhooks or credentials** |
| `security-roadmap.md` | The levels programme — security here is standing work, not a one-time pass |

Concrete findings from audit passes are in `../research/audit/`.

## Operations

| | |
|---|---|
| `tester-onboarding-checklist.md` | Bringing a beta tester in. Three separate lists gate access and none of them lives in FollowUp's code — miss one and the tester hits a refusal and blames the product |
