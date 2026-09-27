# Mercury — trust and control

**Date:** 2026-09-26 · **Asked by:** Sahil · **Status:** STUDIED, proposals pending approval

**Question:** Mercury holds people's money. How does it make them feel in control of it, and
what should FollowUp's website (and app) borrow for a product that sends messages on a
business's behalf?

Five areas studied: permissions, approvals, security, compliance presentation, user control.
Sources are Mercury's own help center and security pages (listed at the end). Nothing below is
copied UI. These are principles only.

---

## What Mercury does

**1. Approvals (the core idea).**
- A payment above your limit doesn't fail. It *waits* for someone to approve it.
- An admin's request needs one other admin. Anyone else's request needs two.
- **Nobody can approve their own payment** (separation of duties).
- Rules are set by amount and by who approves. The approver can Approve, Decline, or ask for
  more details.

**2. Permissions.**
- Five named roles (Admin, Custom, Bookkeeper, Employee, Limited Access). Each one is named by
  the *job*, not by a technical scope.
- Custom roles let you switch individual abilities on or off.
- Card controls: a limit per period, freeze, cancel, lock to a category.

**3. Security.**
- 2FA is required for everyone (authenticator app, passkeys, security keys).
- A push notification on **every** login attempt.
- In-app warnings about scam calls ("Mercury will never call and ask for…").

**4. Compliance presentation, the most useful lesson.**
- Mercury says plainly what it is *not*: "Mercury is a fintech company, not an FDIC-insured
  bank." Then it names the real partner banks.
- The security page lists specific, checkable facts (SOC 2 Type II, encryption at rest and in
  transit, a yearly outside pen test). It uses no vague "bank-grade security" badges.
- The honesty is what builds the trust. The limits are stated *before* anyone has to ask.

**5. User control.**
- You can see and reverse things: freeze a card instantly, see who did what, change a limit
  yourself without asking support.

### The principles underneath

- **P1 — Wait, don't block.** Risky actions pause for a named person. They don't fail and they
  aren't hidden.
- **P2 — Name roles by job.** "Bookkeeper" means something to a reader; "write:payments" doesn't.
- **P3 — Say what you are not.** Stating the limit early buys more trust than any badge.
- **P4 — Specific, checkable facts only.** Every security claim is one a customer could verify.
- **P5 — Instant, self-serve reversal.** The stop button is always visible and works at once.

---

## Where FollowUp already stands (checked in the code, 2026-09-26)

| Area | What's true today |
|---|---|
| Approvals | Every account starts with **every reply waiting** for OK (`holdAll`). Price and money replies always wait, even with auto-send on. Admins can turn on auto-send for simple replies (`autoSendAllowedAt`). Undo on send. "Don't send", and now "We talked". |
| Permissions | Two roles: **Admin** and **Sales** (`TeamRole`). Only admins can: change automation settings, connect or disconnect Gmail / Instagram / WhatsApp / Twilio, export, delete, billing, bulk actions, lead cleanup, "send safe" approvals. |
| Security | Google sign-in only (no FollowUp password). Message-channel tokens are **encrypted** on every write (`db.ts`: Gmail / Outlook tokens, Twilio, Instagram, Facebook, WhatsApp, CRM keys). Every decision goes to an audit trail (`recordAudit`). |
| Google access | Exactly four scopes: read mail (`gmail.readonly`), send as you (`gmail.send`), add calendar events (`calendar.events`), and your email address. |
| Data | Export everything, delete everything, self-serve (`/api/business/export`, `/delete`). Named sub-processors in the privacy policy (OpenAI, Supabase, Vercel…). OpenAI doesn't train on it. |
| Honest limits | Google sign-in is still in **Testing**. There is **no SOC 2** and **no outside pen test** yet. There is **no login alert** and **no 2FA of our own** (Google's 2FA covers sign-in). |

**Gaps against Mercury:**
- **G1 — No "what FollowUp can and can't do" page.** Trust facts are buried in one FAQ answer
  and the privacy policy.
- **G2 — Approval rules are invisible.** The rule "money replies always wait" exists in code,
  but no customer can *see* it as a rule.
- **G3 — Anyone with access can approve anything.** There's no "Sales drafts, Admin approves"
  option. Mercury's separation of duties has no equivalent yet.
- **G4 — No login alert.** Mercury alerts on every login. We say nothing.
- **G5 — No single "Stop everything" switch.** You can stop one customer. You can't stop all
  sending at once from one visible place.

---

## Proposals for FollowUp (ranked)

1. **A "You're in control" section on the landing page, plus a plain `/security` page.** (G1, P3, P4)
   - Three short promises:
     - "Nothing sends until you say so."
     - "It sends from your own Gmail."
     - "Delete everything, any time."
   - One honest **"What FollowUp is not"** line, e.g. "FollowUp can't read anything you
     haven't connected, and it never moves a customer to another channel on its own."
   - The `/security` page lists only true, checkable facts: the four Google permissions in
     plain words, token encryption, the audit trail, export/delete, and the named sub-processors.
   - It also says what's **not** done yet: "no SOC 2 audit yet".
   - Never a badge we didn't earn.
2. **"Rules" in Settings: approval rules you can read.** (G2, P1)
   - Show the rules that already exist as plain sentences:
     - "Replies about price always wait for you."
     - "New customers: every reply waits."
     - "Once a customer answers, check-ins stop."
   - The first version is a read-only display. Editable rules are a product-behaviour call.
3. **"Only admins approve" team option.** (G3, P2)
   - Sales people draft, an admin sends. This is a behaviour change, so it's Sahil's call.
4. **Login alert email: "New sign-in to FollowUp".** (G4)
   - Sent from our own address, with a "Wasn't you?" link to sign out every session.
   - This is behaviour too, so it's Sahil's call.
5. **"Pause all sending" switch.** (G5, P5)
   - One visible switch in Settings and the app header that holds every outbound message.
   - This is behaviour, so it's Sahil's call.

**Guardrails for all five:**
- Never claim SOC 2, "bank-grade", "military-grade", or any certification we don't hold.
- Never show fake badges or logos (A-023).
- No public sign-up form (R-012).
- The Testing status of Google sign-in stays honest.

---

## Sources

- Mercury Help Center (support.mercury.com):
  - Enabling dual admin approvals
  - Enforcing separation of duties
  - Navigating approvals
  - Understanding roles and permissions
  - Managing roles and permissions
  - Changing card limits
  - Understanding two-factor authentication
  - Using passkeys and security keys
- mercury.com/security
- mercury.com/blog/security-playbook
- mercury.com/blog/inside-mercury/multi-factor-authentication
- Mercury's footer disclosure ("Mercury is a fintech company, not an FDIC-insured bank…
  Choice Financial Group and Column N.A., Members FDIC").
