# Code audit — fourth pass — 2026-09-09

Scope per this pass's brief: outbound webhook SSRF risk (`src/lib/outboundWebhook.ts`,
`src/app/api/webhooks/config`, `src/app/api/webhooks/outbound`), notifications tenant scoping
(`src/app/api/notifications/*`), the CSV import route (`src/app/api/leads/import`), the public
booking route (`src/app/book/[leadId]`, `src/app/api/book/[leadId]`, `src/lib/booking.ts`), the
rate-limiting implementation (`src/lib/rateLimit.ts`), webhook/Twilio secret regeneration
(`src/app/api/webhooks/config`, `src/app/api/twilio/config`), and NextAuth session/cookie config
(`src/lib/auth.ts`, `src/lib/session.ts`).

`research/audit/2026-09-08-newer-surface-audit.md`, `2026-09-08-second-pass-audit.md`, and
`2026-09-08-third-pass-audit.md` were read first; nothing already reported/fixed there is
re-reported here.

## Findings

### 1. Outbound webhook has no SSRF protection — a business can point it at internal services

- **Where**: `src/lib/outboundWebhook.ts:61-66` (`notifyLeadEvent`, fired on every new lead /
  stage change), `src/app/api/webhooks/outbound/route.ts:79-95` (the `PUT` "send test event"
  handler), and the validation that precedes both, `src/app/api/webhooks/outbound/route.ts:46-54`.
- **Bug**: When a business sets their outbound webhook URL, the only validation is that it parses
  as a URL and its scheme is `http:`/`https:`. Nothing checks the resolved host/IP against
  loopback, link-local, or RFC1918 ranges. Both call sites then do a plain `fetch(url, ...)` from
  the server with no allowlist, no redirect restriction, and (for the `PUT` test-fire handler)
  the response status/error is echoed straight back to the caller — a direct, low-latency SSRF
  oracle against whatever the FollowUp app server can otherwise reach (cloud metadata endpoint at
  `169.254.169.254`, an internal admin panel, other tenants' services on the same VPC, `localhost`
  ports on the app server itself).
- **Concrete failure scenario**: A business admin (or an attacker who has compromised one
  business's session/credentials — the same threat model the reauth requirement on secret
  rotation already defends against elsewhere) sets their outbound webhook URL to
  `http://169.254.169.254/latest/meta-data/iam/security-credentials/...` (or an internal
  `10.x`/`172.16.x`/`192.168.x` address). Hitting `PUT /api/webhooks/outbound` immediately fires
  a request from the server to that address and reports back whether it got a 2xx or an error —
  enough to fingerprint internal services and, depending on the hosting platform's metadata
  endpoint, potentially exfiltrate credentials via a follow-up request whose response ends up in
  a downstream Zapier/Make step once `notifyLeadEvent` starts firing on real lead events (the
  full response body isn't returned by the app itself, but `notifyLeadEvent`'s POST body is
  attacker-controlled in shape only, not the target's response — the actual leak vector is that
  *any* request at all can be aimed at an internal address, which is the SSRF regardless of what
  comes back).
- **Suggested fix**: Before saving (in the `POST` handler) and again defensively before each
  `fetch` (`notifyLeadEvent` and the `PUT` handler), resolve the hostname and reject private/
  loopback/link-local/multicast ranges and `localhost`; reject if the URL contains an IP literal
  in those ranges directly. Also reject redirects (`redirect: "manual"` and treat a 3xx as
  failure) since DNS-resolves-public-then-redirects-to-internal is an equally valid bypass of a
  one-time hostname check.

### 2. Rate limiters are classic check-then-act — a concurrent flood defeats the cap entirely

- **Where**: `src/lib/rateLimit.ts:18-28` (`tooManyRecentLeads`) and `:49-60`
  (`tooManyRecentActions`). Reachable from every public, unauthenticated lead-intake endpoint
  that relies on it for cost/abuse control, most notably `src/app/api/embed/[businessId]/lead/route.ts:88`
  (cap 20/10min) and `src/app/api/webhooks/lead/[secret]/route.ts:67` (cap 100/10min) — both
  explicitly documented as defending against "a script hammering this URL directly."
- **Bug**: Both functions are a plain `count()` read followed, several lines/awaits later (after
  JSON parsing, honeypot checks, `pickAssignee`, etc.), by the row that would make the count go up
  (`prisma.lead.create` for `tooManyRecentLeads`; `prisma.rateLimitHit.create` for
  `tooManyRecentActions`, though at least that one is closer to the check). There is no
  transaction, advisory lock, or atomic increment-and-check. Nothing prevents N concurrent
  requests from all reading the same pre-flood count and all being told "you're under the limit."
- **Concrete failure scenario**: The embed widget's `businessId` is, by design, not a secret — it
  sits in the business's own public site HTML (the file's own comment says as much). An attacker
  fires 200 concurrent `POST /api/embed/<businessId>/lead` requests (trivial with any HTTP client
  that doesn't serialize). Every one of those 200 requests calls `tooManyRecentLeads`, reads
  `count = 0` (or whatever the pre-flood baseline is) before any of the concurrent creates have
  committed, and all 200 pass the `>= 20` check and create a lead — each with a message field
  populated, so each also triggers a real `scoreAndDraftForLead` OpenAI call on the business's own
  usage. The cap this code exists specifically to enforce (per its own comments) only holds for
  sequential/slow floods, not concurrent ones — which is the more realistic attack shape for
  someone deliberately trying to run up a target's OpenAI bill.
- **Suggested fix**: Make the check-and-record atomic. Simplest fix within the existing schema:
  wrap the count + create in a single `prisma.$transaction` at `Serializable` isolation (or use a
  Postgres advisory lock keyed on `businessId:source`/`businessId:action` around the whole
  check-then-act region). A cleaner long-term fix is a single atomic
  `UPDATE ... SET count = count + 1 WHERE window... RETURNING count` against a dedicated counter
  row (the same atomic-conditional-update pattern already used elsewhere in this codebase for
  `lastRapidEngagementNotifiedAt`/`lastMissedCallTextAt`, per `prisma/schema.prisma`'s comments on
  the `Lead` model) rather than a separate count-then-insert.

### 3. CSV import silently drops rows that collide on phone number, with no report to the user

- **Where**: `src/app/api/leads/import/route.ts:106-166` (duplicate handling) together with the
  `@@unique([businessId, phone])` constraint on `Lead` in `prisma/schema.prisma`.
- **Bug**: The import route pre-checks and reports duplicate/invalid **emails** explicitly
  (`existingEmails`, `seenEmailsInBatch`, pushed into the `skipped` array with a per-row reason —
  lines 130-139). It does no equivalent check for **phone numbers**, even though `Lead` also has a
  unique constraint on `(businessId, phone)`. Every row is pushed into `toInsert` regardless of
  phone value, and the actual insert uses `createManyAndReturn({ data: toInsert, skipDuplicates:
  true, ... })`. When a row's phone collides with an existing lead (or another row earlier in the
  same file) but its email doesn't collide, Postgres silently skips that row at insert time —
  `skipDuplicates` swallows the constraint violation — and that row appears in neither `created`
  (it wasn't actually inserted) nor `skipped` (nothing in the JS-level logic ever flagged it). The
  response's `created + skipped` count will not add up to the row count, and the row's data (a
  changed name, notes, deal value on a re-exported/re-imported list) is silently discarded with no
  indication to the user that anything happened to it — the same class of bug the third-pass audit
  found and fixed for the inbound webhook's duplicate-email case, but left unaddressed here for
  phone.
- **Concrete failure scenario**: A business exports leads from a phone-centric source (e.g. a
  call-tracking tool or a CRM where many leads have a phone but no email) and imports it. A week
  later they re-import an updated version of the same CSV (updated notes/deal values, same phone
  numbers, still no emails) to bulk-refresh the pipeline. Every row's email is blank so the
  email-duplicate check never fires; every row's phone already exists from the first import, so
  `skipDuplicates` drops all of them at the DB layer. The response comes back `created: 0, skipped:
  0` — indistinguishable from "your file had 0 usable rows" — and the user has no way to tell that
  their update was silently ignored rather than, say, misparsed.
- **Suggested fix**: Mirror the existing email-dedup logic for phone: pre-load existing phone
  numbers for the business the same way `existingEmails` is loaded, check both the DB set and an
  in-batch `seenPhonesInBatch` set before pushing a row into `toInsert`, and push a `skipped`
  entry with a reason when it collides — exactly the same shape already used for email.

## Areas checked and found clean

- **Notifications tenant scoping** (`src/app/api/notifications/route.ts`,
  `[id]/route.ts`, `read-all/route.ts`): the list and read-all routes both filter by
  `userId: ctx.userId` directly in the Prisma query (never by a client-supplied id), and
  `PATCH /api/notifications/[id]` explicitly re-checks `notification.userId !== ctx.userId` and
  404s rather than trusting the id alone. No cross-user or cross-business enumeration path found.
- **CSV import resource limits**: 2MB file cap, 1000-row cap, and (per the file's own comment,
  verified by reading the route) it deliberately never calls `scoreAndDraftForLead` per row, so
  there is no OpenAI-cost-bomb vector via bulk import. Import is also itself rate-limited via
  `tooManyRecentActions(ctx.businessId, "leads.import", { max: 5, windowMinutes: 10 })` — this
  route is authenticated (not public), so the TOCTOU race in finding #2 is far less exploitable
  here (an attacker would need a valid, already-billed session to begin with).
- **Public booking route**: `leadId` is a `cuid()` (`prisma/schema.prisma:193`), not sequential or
  guessable. `getBookingContext()` (`src/lib/booking.ts:56-63`) deliberately selects only
  `leadName` + `businessName`, and the API route's own comment confirms this is intentional —
  no email, phone, notes, score, or conversation history is exposed to the unauthenticated
  visitor. `createBooking` re-validates the slot server-side rather than trusting the client's
  posted time.
- **Webhook secret regeneration**: `POST /api/webhooks/config` overwrites `Business.webhookSecret`
  in place, and the inbound route (`src/app/api/webhooks/lead/[secret]/route.ts`) looks up the
  business by the secret fresh on every request (`prisma.business.findUnique({ where: {
  webhookSecret: secret } })`) with no caching layer in between — the old secret 404s on the very
  next request after rotation, matching the route's own doc comment. Twilio's secret
  (`src/app/api/twilio/config/route.ts`) has no regeneration path at all (deliberately idempotent
  — generated once, reused), so there's no old/new window to race there either.
- **NextAuth session/cookie config** (`src/lib/auth.ts`, `src/lib/session.ts`): no custom
  `cookies` block overrides NextAuth's secure defaults (httpOnly, `secure` under HTTPS). Session
  re-validation against the DB isn't per-request, but it isn't "trust the JWT forever" either:
  `token.businessId` is re-checked against `User.businessId` every `REVALIDATE_INTERVAL_MS` (5
  minutes), and a user removed from their business (`businessId` set to `null` by
  `removeMember()`) has their token's `userId`/`businessId` claims stripped on the next
  revalidation, after which `getSessionContext()` treats them as signed out. This is a bounded,
  documented exposure window (≤5 minutes), not an unbounded trust of a stale claim — a deliberate
  tradeoff, not a bug.
