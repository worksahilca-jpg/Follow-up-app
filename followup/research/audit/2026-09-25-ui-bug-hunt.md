# UI bug hunt: the four screens in tonight's Meta App Review screencasts (2026-09-25)

**Scope:**
- Settings → Channels → the Instagram card
- Today and the approval queue
- An Instagram lead's page
- The sidebar and mobile navigation

**Branch read:** `claude/followup-demo-to-production-4k39hr`, clean tree.
**Report only.** No app source, design-brain file or git state was changed. Rendering used a throwaway preview route with stubbed `fetch`, which has since been deleted. `next-env.d.ts`, which `next dev` had rewritten, was restored and `.next/dev` was removed.
**Grades:**
- **CONFIRMED (rendered)**: I drove the real component in Chromium over CDP and saw the result.
- **CONFIRMED (traced)**: I followed it in code but could not render it in the harness.
- **PLAUSIBLE**: it depends on live data or a device I couldn't emulate.

**Ranking:** how bad it looks on camera, or to a first-time owner. Tier 1 means it is in a scripted shot.
**Copy ownership:** every replacement sentence below is a *proposal*. The words belong to `product-ux-agent`, and where one existed I reused wording already proposed in `research/product/2026-09-24-simplify-the-app.md`. Rejected-list check: see §6.

---

## Summary

1. **Video A's closing shot can fail.** If Meta's webhook subscription doesn't confirm, the connected card never prints the handle, only "Your account is linked and working" (B2). Fixing it takes one prop.
2. **Video B's closing screen contradicts itself.** After Approve & send, the header still says "1 draft needs your OK" directly above "Nothing needs your OK right now. Anything FollowUp isn't sure about will show up here before it sends." Nothing confirms that the message went (B4, B5).
3. **Three lines on camera say FollowUp sends by itself, which is the opposite of the Video B narration:**
   - the Instagram card: "gets the instant reply, automatically" (B1)
   - the empty queue: "before it sends" (B5)
   - "About to be lost": "Automation is already working these" (B10)
4. **Video C's two steps contradict each other.** The lead page badge tells the owner "FollowUp can't send this one for you. Open Instagram and reply there". The composer directly under it is the Human Agent send the video exists to show. It is also headed "AI-suggested follow-up" (B7).
5. **A failed OAuth prints its error twice, and the red error stays on screen after a later successful connect.** It then sits directly above the green "Connected as @…" (B3). The Instagram and Facebook cards also render touching, with no gap (B13).

**Nothing here stops tonight's recording**, provided the workarounds in §1 are followed. B1–B5 and B7 are each a string edit or a one-line code change. If there is time for four fixes before recording, do **B2, B3, B4 and B1**.

---

## 1. Recording-night checklist (no code needed)

| # | Do this | Because |
|---|---|---|
| 1 | Start every Settings take from a clean `/settings`, with no `?instagram=error…` left in the address bar from an earlier attempt. | B3: the old error renders twice and stays on screen through a successful connect. |
| 2 | Video A, shot 6: if the card says **"Instagram messages arrive every few minutes, not instantly"**, the handle is not on screen anywhere. Retake after "Try for instant delivery" succeeds, or ship B2 first. | B2 |
| 3 | Video B: after Approve & send, **let the 10 s run out, then cut to the phone** (the pack already says this). If you return to Today, reload it first. | B4: the header goes stale and nothing confirms the send. |
| 4 | Video B/C: after a send, **don't open the lead page again without reloading**, and never press Send there a second time. | B8: the draft you just sent comes back as a fresh suggestion, and pressing Send after 60 s sends it again. |
| 5 | Video C: **clear the draft and type the reply yourself** before pressing Send. | B7: the screen says "AI-suggested follow-up" / "FollowUp drafted this" on the one message you are justifying as a human agent's reply. |
| 6 | Dark mode: **don't expand "Automation & follow-up plan"** on the lead page. | B20: the selected option is white text on white. |
| 7 | If you reach the lead through the bell, **close the bell dropdown by hand** afterwards. | B22: it stays open over the lead page. |
| 8 | **Don't open "Meta console reference"** on camera. | It prints the app-wide webhook verify token. |
| 9 | If the reviewer business has only Instagram connected and no leads yet, Today says **"No inbox is connected yet, so FollowUp isn't watching for leads"**. Either have a lead in place first, or know it will be on screen. | B6 |

---

## 2. Tier 1: in a scripted shot

### B1 — The Instagram card promises an automatic reply; every account holds it
**CONFIRMED (rendered, shots 01–05, 17)** · Videos A and B

- **Where:**
  - `src/components/InstagramConfig.tsx:162-165`: *"Anyone who messages your Instagram Business account becomes a lead and gets the instant reply, automatically."*
  - Its twin, `src/components/FacebookConfig.tsx:162-165`: *"…becomes a lead and gets the instant reply."* It renders directly below the Instagram card.
- **Why it's false:** `holdAllForApproval @default(true)`, and the instant reply has been held since 2026-09-20 (`acknowledge.ts:529-540`). This sentence is on screen at the start and at the end of Video A, and it contradicts the Video B narration ("nothing sends on its own").
- **Proposed.** This wording is true whether or not the account holds, so it needs no prop:
  - Instagram: *"Anyone who messages your Instagram Business account becomes a lead, and FollowUp writes them a reply."*
  - Facebook: *"Anyone who messages your Facebook Page, or fills in one of your lead-ad forms, becomes a lead, and FollowUp writes them a reply."*

### B2 — Connected but not receiving: the handle disappears, and Video A shot 6 needs it
**CONFIRMED (rendered, shot 03)** · Video A

- **Where:** `InstagramConfig.tsx:206-208` passes `subject="Your account"` to `ChannelNotReceiving`. When `receiving` is false, the "Connected as @handle" line (`:175-200`) is replaced entirely.
- **Result:** the only thing on screen is *"Your account is linked and working…"*, with no username anywhere. The pack's Video A shot 6 is "the connected account's username now shown on screen". Whether the subscription confirms on the reviewer account is unknown; see the 2026-09-24 audit, F1/F5.
- **Fix (one line):** `subject={instagramUsername ? `@${instagramUsername}` : "Your account"}`. It then reads *"@followupbase.review is linked and working — …"*.

### B3 — A failed OAuth prints the error twice, and it stays through a successful connect
**CONFIRMED (rendered, shots 01 and 05)** · Video A (F4 says OAuth may still fail)

- **Where:** two readers of the same query string.
  - `src/app/(app)/settings/page.tsx:694-695` plus `:1075-1079` print it under the "Instagram & Facebook" heading.
  - `InstagramConfig.tsx:53-54` prints it again inside the card.
- **On a phone:** the first copy is half-hidden under the sticky tab row (see B12).
- **After a successful paste-token connect:** both red copies stay, directly above the green *"Connected as @followupbase.review."* (shot 05). `statusMessage` is derived from the URL and never cleared.
- **Fix:**
  1. Delete the section-level copy: remove `instagramError` at `:694-695` and the block at `:1075-1079`. The card already owns this message.
  2. In `InstagramConfig`, show the `error` branch only while `!connected`.
  3. Optionally, after a successful `saveToken`, call `router.replace("/settings#social")` to drop the stale query.

### B4 — After Approve & send, Today contradicts itself and never says the message went
**CONFIRMED (rendered, shot 09)** · Video B, steps 6–7

- **Where:**
  - The page subtitle is computed on the server (`dashboard/page.tsx:140-177`, `:187`).
  - The card is removed on the client only (`ApprovalQueue.tsx:94` → `setResolved`). Nothing calls `router.refresh()`; `SafePileAction.tsx:79` does.
- **Seen:** *"1 draft needs your OK · 1 lead going quiet"* directly above *"Nothing needs your OK right now."*. "About to be lost" still lists the same person.
- **No confirmation:** the card simply vanishes. On camera, "the message was sent" rests entirely on the cut to the phone.
- **Fix:**
  - (a) In `ApprovalQueue`, `const router = useRouter()`, and call `router.refresh()` inside the card's `onResolved`, the same as the routine pile.
  - (b) Keep a `lastSent` state in `ApprovalQueue` and render one quiet line in `--sage` above the queue: *"Sent to @sahildoes on Instagram."* It stays for the rest of the visit, not as a toast. This is a small addition, not a new pattern: the composer already does it (`MessageComposer.tsx:99-101`).

### B5 — The empty queue says FollowUp sends what it's sure about
**CONFIRMED (rendered, shots 09 and 16)** · Video B, and the reviewer's first Today

- **Where:** `ApprovalQueue.tsx:260`: *"Anything FollowUp isn't sure about will show up here before it sends."* On a holding account nothing is sent, and this is the line on screen straight after the approve.
- **Fix:** pass `holdAll` from `dashboard/page.tsx:189` (already computed at `:102`) and branch:
  - When holding: *"Every reply FollowUp writes shows up here first. Nothing goes out until you send it."* (simplify doc, 1(c))
  - When not holding: keep the current line.
- **Also:** on an account with no leads, the heading *"Nothing needs your OK right now."* (`:256`) sits under the subtitle *"No leads yet."*. `headline()`'s own comment (`dashboard/page.tsx:155-173`) says that exact sentence is misleading on a brand-new account. When `items` is empty and the dashboard knows there are no leads, use *"Nothing to approve yet."*

### B6 — The reviewer business with Instagram only is told "FollowUp isn't watching for leads"
**CONFIRMED (rendered, shot 16; traced)** · Video B, if the account starts empty

- **Where:** `dashboard/page.tsx:123-127` builds `inbox` from Gmail/Outlook only. With `leads.length === 0`, `:269-288` then renders:
  - *"No inbox is connected yet, so FollowUp isn't watching for leads. Connect one and it starts answering the people who write in, within minutes."*
  - The first clause is false (the Instagram poller runs every 3 minutes). The second is false on a holding account.
- **On a populated Today:** `SetupStrip` shows **"Connect your inbox"**, which cannot be dismissed (`setupStatus.ts:141-151`), plus "Send a test lead to myself" (`dashboard/page.tsx:387-391`), on every screen of Video B.
- **Fix:**
  - Read `instagramUserId`/`instagramUsername` in the dashboard's existing `business` query (`:96`) and add a branch before the no-inbox one: *"FollowUp is watching @handle on Instagram. When someone messages, it writes the reply and puts it under Needs your OK — nothing goes out until you send it."*
  - For the strip, counting a connected Meta channel toward "Connect your inbox" is a setup-logic call for `product-ux-agent`. Flagged, not decided here.

### B7 — Video C: the lead page tells the owner to leave FollowUp, then the video sends from FollowUp
**CONFIRMED (rendered, shot 11; traced)** · Video C, steps 2–3

Four surfaces give two different instructions for the same state (Instagram, 24 h – 7 d):

| Surface | Says |
|---|---|
| Lead page badge, `AutomationStatusBadge.tsx:100` | *"…only in person — FollowUp can't send this one for you. **Open Instagram and reply there.**"* |
| Composer under it | **Send now** (this is the Human Agent path, `leads/[id]/send/route.ts:44`) |
| Today card for the same lead, `automation.ts:1351` | *"…Meta now only lets a person send the next one — you have 5 days. **This draft is yours to send**, or leave."* |
| Send refusal, `sending.ts:394` | *"Only you can send one, **from their page**…"* |
| Send refusal, `metaGraph.ts:59-61` | *"…You can still reply **from Instagram directly**."* |

- **The conflict:** the badge is right for the world where Human Agent is *not* approved. That is the fallback the submission promises (pack §3, lines 103-104). Video C demonstrates the world where it *is* approved.
- **Proposed badge detail, true in both worlds:** *"Instagram's 24-hour window has closed. For the next 5 days only a person can reply — write it below and press Send yourself, or reply in the Instagram app. FollowUp won't send anything here on its own."*
  - No email fallback anywhere (R-003).
  - Whether the badge should instead switch on a "Human Agent approved" flag is a decision for Sahil.

Also in this frame:
- **(a) The human-agent message is headed "AI-suggested follow-up"** (`MessageComposer.tsx:114`). The subline is *"FollowUp drafted this…"* and there is a **Regenerate** button.
  - Meta's documented intent for the tag is a reply from a human agent. *Inference: I couldn't re-check the policy text tonight; developers.facebook.com is egress-blocked, per the 2026-09-24 audit.*
  - The heading also breaks S-13, and D-007 already excluded it.
  - **Proposed:** heading *"Reply to {First}"*, subline *"FollowUp wrote this from your conversation. Nothing sends until you press Send."* (simplify doc §4).
- **(b) The handoff reason is false on a holding account.** *"{First} didn't reply to the **automatic follow-ups** on Instagram"* (`automation.ts:1351`): on a holding account the last outbound message was one the owner approved. **Proposed:** *"…didn't reply to your last message on Instagram, and Meta now only lets a person send the next one — you have 5 days. This draft is yours to send, or leave."*
- **(c) Two errors in `metaGraph.ts:58-62`.**
  - It says *"Sending now needs Meta's approval **for your app**"*. The owner has no app.
  - It hard-codes *"reply from **Instagram** directly"* even for Messenger leads. `facebook.ts:84` uses the same function.
  - **Proposed:** *"This conversation is past {Platform}'s 24-hour reply window. Replying now needs a permission FollowUp is still waiting on from Meta, so this didn't send. You can still reply in the {Platform} app."*, with the platform passed in.

---

## 3. Tier 2: on a camera screen, but not in the scripted path

### B8 — The draft you just sent comes back as a fresh suggestion; a second Send after 60 s duplicates it
**CONFIRMED (rendered for the thread, traced for the reload)** · lead page

- **Sending never clears `Lead.suggestedMessage`.**
  - `sending.ts:797-849` reads it and never writes it; `leads-data.ts:110` passes it straight to the composer (`leads/[id]/page.tsx:125`).
  - So after an Approve & send on Today, the lead page shows the same text under "AI-suggested follow-up" with **Send now**.
  - The duplicate guard lasts only `SEND_CLAIM_WINDOW_MS = 60_000` (`sendClaim.ts:66`).
- **After a send from the composer:** the thread doesn't update (`MessageComposer` never refreshes, shot 12).
- **The sent line reads *"Sent to @maria…, for real."*** (`MessageComposer.tsx:100`). "for real" reads as a joke on camera.
- **Fix:**
  - UI: `router.refresh()` after a successful send in `MessageComposer.send`.
  - Text: *"Sent to {leadName} on {Channel}."*
  - Server (backend lane): clear `suggestedMessage` on a successful manual send when the sent body squashes equal to it. The comparison `draftEdited` is already computed at `sending.ts:798`.
- **Related:** `2026-09-25-daily-path-bug-hunt.md`, committed while this was being written.
  - Its **F1** is the queue-side face of the same root: nothing marks a draft as used, so bulk-sent leads stay queued.
  - Its **F7** covers the composer's missing undo and its stale draft.
  - Fix these together, not one at a time.

### B9 — "Start with @sahildoes — Instagram, scored 0."
**CONFIRMED (rendered)** for the bare number; **PLAUSIBLE** for the value 0 (it depends on scoring having run).

- **Where:** `ApprovalQueue.tsx:302`. It shows a bare score, and "scored 0" on a brand-new DM reads as a verdict of worthless.
- **Proposed:** *"Start with @sahildoes — Instagram."* (simplify doc 1(c) suggests the hold reason instead).

### B10 — "About to be lost" repeats the person in the queue and claims automation is working them
**CONFIRMED (rendered with fixture; duplication traced in the simplify doc, `rescue.ts:116-121`)**

- **Where:** `dashboard/page.tsx:343`: *"Automation is already working these — the ones at the top need you."*
- **Proposed:** *"FollowUp will write a reply for each of these. It'll appear above for your OK."* (simplify doc 1(c))

### B11 — The connect-state beta note names the founder
**CONFIRMED (rendered)** · Video A, before the consent screen

- **Where:** `InstagramConfig.tsx:242-243`, and the same sentence in `FacebookConfig`: *"…Meta only lets accounts **Sahil added** as testers connect. If Meta refuses, ask **him** to add you."*
- **Proposed:** *"While FollowUp is in beta, Instagram only lets invited accounts connect. If it says no, email contact@followupbase.io and we'll add you."* This is consistent with R-012, which keeps contact@ as the only door.

### B12 — On phones, a return to `#social` hides the section heading under the sticky tabs
**CONFIRMED (rendered, shot 01)**

- **Where:** every Settings section uses `scroll-mt-16` (64 px; 15 sections in `settings/page.tsx`). Below `lg` the sticky offset is the 57 px top bar (`--app-header-h`) plus the ~49 px tab row, about 106 px.
- **Result:** after OAuth the "Instagram & Facebook" heading, and the first line of B3's error, sit behind the tabs.
- **Fix:** `scroll-mt-28 lg:scroll-mt-16` on the sections.

### B13 — Instagram and Facebook cards touch with no gap
**CONFIRMED (rendered, every Settings shot, 390 and 1280)**

- **Where:** `settings/page.tsx:1080` `<div className="mt-4">` wraps two `.box`es. Their hairline shadows fuse into one double-height slab.
- **Fix:** `className="mt-4 space-y-3"`.

### B14 — After OAuth success, the same promise prints twice
**CONFIRMED (rendered, shots 02 and 17)**

- **Where:** the success line at `InstagramConfig.tsx:51-52`, *"Instagram connected — real DMs will become leads automatically."*, sits directly above the connected line at `:190-199`, *"Connected as @… Real DMs will become leads automatically."*
- **Fix:** drop the success branch of `statusMessage`; the tick line already says it.
- **Minor:** "Real DMs" implies there are unreal ones. *"New DMs become leads automatically."*

### B15 — Disconnect: one tap, no confirmation, silent on failure, 63×16 px target
**CONFIRMED (rendered: a failing DELETE left the card unchanged with an uncaught exception)**

- **Where:** `InstagramConfig.tsx:126-140` and `:223-225`.
  - Gmail's disconnect confirms (`settings/page.tsx:705`); Instagram's does not.
  - `res.json()` is unguarded.
  - The button has no busy label.
- **Fix:**
  - `if (!window.confirm(`Disconnect @${instagramUsername ?? "this account"}? FollowUp will stop picking up its DMs. You can reconnect any time.`)) return;`
  - `res.json().catch(() => null)` and `setSaveError(...)`, rendered in the connected branch.
  - Label *"Disconnecting…"*, and `px-3 py-2`.

### B16 — If loading the connection fails, a connected account is shown as unconnected, with a false reason
**CONFIRMED (rendered, shot 06)**

- **Where:** `InstagramConfig.tsx:57-83`. A non-JSON response throws uncaught, and `finally` renders the not-connected state with `oauthAvailable=false`. The card then says *"One-click connect isn't switched on yet — it's waiting on FollowUp's setup with Meta"*.
- **Also:** `if (loading) return null` (`:152`) makes the card pop in and shift the layout.
- **Fix:**
  - A `loadError` state with *"Couldn't load your Instagram connection. Refresh to try again."*
  - A same-height placeholder `box` while loading.

### B17 — A refused send's error stays on screen through the retry countdown
**CONFIRMED (rendered)**

- **Where:** `ApprovalQueue.tsx:186`, `onClick={send.start}`, never clears `error`.
- **Fix:** `onClick={() => { setError(null); send.start(); }}`, as in `SafePileAction.startCountdown`.

### B18 — The composer shows the raw parser error on a timeout, and every "Send failed" may be untrue
**CONFIRMED (rendered)**

- **Where:** `MessageComposer.tsx:64` (and `:44`, regenerate) call `res.json()` bare. A 504 renders:
  > *Failed to execute 'json' on 'Response': Unexpected token '<', "<!DOCTYPE "... is not valid JSON*
- **The trust half:** a gateway timeout can arrive *after* Meta accepted the message. `ApprovalQueue.tsx:89-91` catches the parse, but then says *"Send failed."*, which may be false.
- **Fix:** `res.json().catch(() => ({}))` at both sites. When there is no JSON: *"FollowUp didn't hear back in time. It may have sent — check the conversation before trying again."* Apply the same guard to `dontSend` (`ApprovalQueue.tsx:104`).

### B19 — A long Instagram handle makes the lead page scroll sideways
**CONFIRMED (rendered: a 29-character handle pushed the page to 472 px wide at 390)**

- **Where:** `PageHeader.tsx:57`, the `<h1>`, has no wrap rule. Instagram allows 30-character handles.
- **Fix:** add `[overflow-wrap:anywhere]` to the `h1` class.

### B20 — Dark mode: the selected automation option is invisible
**CONFIRMED (rendered, shot 11)**

- **Where:** `LeadAutomationToggle.tsx:138-139` uses fill `var(--rust)` (white in dark mode) with a hard-coded `color: "white"`. The contrast is 1:1.
- **Fix:** `color: tier === t.value ? "var(--on-accent)" : "var(--ink-soft)"`. The same bug is at `workflows/page.tsx:603, 613`.

### B21 — The lead page's "What FollowUp did here" leaks machine text and wrong channel facts
**CONFIRMED (rendered, shot 11)** · `LeadTrustPanel.tsx`

- **Raw action names.** Only 3 of 16 lead audit actions are mapped (`:18-28`), so the rest print as-is: **`ai.hold_dismissed`**, `lead.dm_exit`, `ai.send_failed`, and so on.
  - Proposed: map `ai.hold_dismissed` → *"You chose not to send FollowUp's draft"*.
  - Unknown actions should be skipped, not printed.
- **Hold reason as a fragment.** It renders as a lowercase clause: *"your account holds every message…"* (`:26`). Use `renderHeldBecause()` from `holdReasons.ts:109`.
- **Wrong channel.** An Instagram lead reads *"No opt-out on file — **SMS and WhatsApp** sends are allowed."* (`:135`). Show it only for leads that are not social leads (`isSocialLeadId`).
- **Heading twice.** *"Consent & AI activity"* appears as the collapse title (`leads/[id]/page.tsx:194`) and again inside (`:102`). S-13 also argues against the word "AI" here. Simplify doc proposal: *"What FollowUp did here"*.
- **Hard-coded old palette.** `rgba(217,95,79,.08)` and `rgba(122,157,127,.08)` at `:125, :133`; use `--coral-soft` / `--sage-soft`.

### B22 — The bell dropdown stays open after you tap a notification
**CONFIRMED (traced)**

- **Where:** `NotificationBell.tsx:138, 142`. The `Sidebar` lives in `(app)/layout.tsx`, so it survives the navigation, and the link's `onClick` never calls `setOpen(false)`. The dropdown stays over the lead page.
- **Fix:** `onClick={() => { setOpen(false); if (!n.read) markRead(n.id); }}`, and close on Escape.
- **Related (PLAUSIBLE, by design):** the "a reply is written and waiting for your approval" notification stays unread after the draft is approved, so the badge still reads 1 after Video B's approve.

### B23 — The Settings tab row flashes "Connect" before jumping to "Channels" on an OAuth return
**PLAUSIBLE** (it follows from the effect order; I didn't catch the frame)

- **Where:** `settings/page.tsx:103-127` starts on "connect" and switches after mount, correctly, to avoid the 2026-09-23 hydration bug. Together with B16's null-while-loading, Video A shot 6 opens on the Gmail panel for a frame or two.
- **Fix:** a `tabResolved` flag, false on both server and first client render, so no mismatch. Keep the panels `visibility:hidden` until the effect has run.

---

## 4. Copy that is false for the current product

### 4a. "Approvals": a page that doesn't exist

| # | File:line | Now | Proposed |
|---|---|---|---|
| 1 | `src/app/(app)/dashboard/page.tsx:224` | "…it writes the reply and puts it in Approvals for you — nothing goes out until you send it." | "…it writes the reply and puts it under Needs your OK on this page — nothing goes out until you send it." |
| 2 | `src/app/(app)/settings/page.tsx:497` | "…every one of those is written for you and waits in Approvals until you press send." | "…every one of those is written for you and waits for your OK on Today until you press send." |
| 3 | `src/app/(app)/settings/page.tsx:1113` | "Every follow-up it writes waits in Approvals until you send it." | "Every follow-up it writes waits for your OK on Today until you send it." |
| 4 | `src/app/(app)/workflows/page.tsx:238` | "…puts it in Approvals, and stops there…" | "…puts it under Needs your OK on Today, and stops there…" |
| 5 | `src/components/AutomationStatusBadge.tsx:167` (rendered, shot 14) | "It waits in your approvals until you send it." | "It waits for your OK on Today until you send it." |
| 6 | `src/components/LeadAutomationToggle.tsx:36-37` and `:39-40` | "…puts it in your approval queue…" / "…puts each one in your approval queue…" | "…puts it under Needs your OK on Today…" / "…puts each one under Needs your OK on Today…" |
| 7 | `src/lib/holdNotices.ts:126` (bell text, new since the simplify doc) | "…Open Approvals to read them." | "…They're under Needs your OK on Today." |
| 8 | `src/app/api/automation/send-preview/route.ts:34` (error) | "Couldn't read your approvals queue." | "Couldn't read what's waiting for your OK." |
| 9 | `src/app/page.tsx:565` (landing FAQ, out of scope) | "…each reply waiting in your approvals list…" | "…each reply waiting for your OK on your Today screen…" |

**Constraint:** `HOLD_SUMMARY_MARKER` (`holdNotices.ts:67`) is matched by text for dedup. Edit #7 only after the part *after* the marker.

### 4b. Implies FollowUp sends by itself on a holding account

| File:line | Now | Proposed |
|---|---|---|
| `InstagramConfig.tsx:163-164` | "…becomes a lead and gets the instant reply, automatically." | B1 |
| `FacebookConfig.tsx:163-164` | "…becomes a lead and gets the instant reply." | B1 |
| `ApprovalQueue.tsx:260` | "Anything FollowUp isn't sure about will show up here before it sends." | B5 (branch on holdAll) |
| `dashboard/page.tsx:275-276` | "Connect one and it starts answering the people who write in, within minutes." | B6 |
| `dashboard/page.tsx:343` | "Automation is already working these…" | B10 |
| `AutomationStatusBadge.tsx:110` | "…Connect one in Settings and follow-ups start on their own." | "…Connect one in Settings so FollowUp has a way to reply." |
| `AutomationStatusBadge.tsx:53` | "This lead is opted out of automated follow-up" (reads as the *lead* opting out) | "You've set FollowUp to leave this lead to you." |
| `automation.ts:1351` | "…didn't reply to the automatic follow-ups on {platform}…" | B7(b) |
| `metaGraph.ts:59-61` | "…Meta's approval for your app… reply from Instagram directly." | B7(c) |
| `AutomationStatusBadge.tsx:100` | "…FollowUp can't send this one for you. Open Instagram and reply there." | B7 |

### 4c. Smaller wording on the camera screens
- **Composer:**
  - "AI-suggested follow-up" (`MessageComposer.tsx:85, :114`): see B7(a).
  - "for real." (`:100`): see B8.
- **The Instagram "not receiving" error prefix.** `ChannelNotReceiving.tsx:115` puts *"Instagram said: …"* in front of FollowUp's own messages. A 429 reads *"Instagram said: Give it a minute before trying again."*
  - Fix: prefix only when the error came from Meta.
  - The same file's `retry()` (`:73`) has the B16 bare-`json()` crash.
- **The OAuth callback's failure text.** It starts *"Instagram connected, but we couldn't read the account details — …"* (`oauth/callback/route.ts:55`) while nothing was saved, and it renders under a card that says not connected.
  - Proposed: *"Instagram didn't give FollowUp the account details, so nothing was connected — {reason}"*.

---

## 5. Phone width (390 px) and accessibility

**Overflow.** Only B19 overflows (the long handle). At 390 px, Settings, Today and the lead page all measured `scrollWidth === 390` with ordinary names. The Settings tab row scrolls sideways by design ("Adv…" clipped). There is no fade to hint at the scroll; low priority.

**Tap targets under 44 px, all measured:**

| Screen | Control | Size |
|---|---|---|
| Header | Bell, menu | 32×32 |
| Drawer | Nav items | 36 px tall |
| Settings | Tabs | ~32 px |
| Instagram card | Connect with Instagram | ~28 px |
| Instagram card | "Have an access token instead?" | 16 px |
| Instagram card | "Meta console reference" | 16 px |
| Instagram card | Disconnect | 63×16 |
| Instagram card | Paste Connect | 30 px |
| Approval card | Approve & send | 131×32 |
| Approval card | Edit | 56×34 |
| Approval card | Don't send | 97×32 |
| Approval card | Undo | ~34 px |
| Lead page | "Leads" back link | 20 px |
| Lead page | Stage select | 28 px |
| Lead page | Tier buttons | 28 px |
| Lead page | "build one" | 51×14 |

- **Priority:** the three trust-bearing buttons (Approve & send, Undo, Disconnect) → `min-h-11`.
- **If the header icons go to 44 px,** `--app-header-h` (`globals.css:104`, 57 px) must move with them. The Settings sticky offset and the shell padding both read it.

**Keyboard and screen reader:**
- **The closed mobile drawer is still in the tab order.** Measured: after the menu button, Tab walks eight off-screen nav links. There is no `inert`/`visibility:hidden`, Escape doesn't close it, and focus doesn't move in on open (`Sidebar.tsx:74-79`).
  - Fix: add `invisible lg:visible` when closed (with `transition-[transform,visibility]`), and handle Escape.
- **Unlabelled fields (placeholder only):**
  - The paste-token input (`InstagramConfig.tsx:274-280`) → `aria-label="Instagram access token"`.
  - The composer textarea (`MessageComposer.tsx:145-150`) → `aria-label={`Reply to ${leadName}`}`.
- **Settings tabs** show the active state only by fill: add `aria-current`/`aria-selected` (`settings/page.tsx:838-849`).
- **The countdown and card errors aren't announced.**
  - Add a static `role="status"` sentence when the countdown starts (not a live ticking number).
  - Add `role="alert"` on the card error.
- **Double-tapping Approve & send selects a word** ("to") in the countdown text that replaces the button (shot 08). Only one request fired, verified with real mouse events, so there is **no double send**. Fix: `select-none` on `ApprovalQueue.tsx:169` and `SafePileAction.tsx:129`.
- **The badge's `animate-pulse` ignores reduced motion** (`AutomationStatusBadge.tsx:222, 231`). Use `motion-safe:animate-pulse`.
- **Text below the floor (S-11):**
  - The whole Instagram card body is 12 px. The floor is 14 px for real content.
  - The Beta chip and the bell badge are 10 px (`Sidebar.tsx:89`, `NotificationBell.tsx`).
- **Contrast:** apart from B20 (1:1), I did not re-measure. `globals.css` records measured pairs for both themes.
- **iOS Safari (PLAUSIBLE).** The drawer is `h-screen`, and Sign out sits at y≈828 of 844, so it is likely under Safari's bottom toolbar. Use `h-dvh`.

---

## 6. Checked and clean

- **A double-tap on Approve & send** fires exactly one request (real CDP mouse events, 60 ms apart). The press → countdown → send → card removal sequence works as `design-decisions` 2026-09-23 describes.
- **A double-click on the paste-token Connect** is safe with real input. Two *programmatic* `.click()`s in one task did send two POSTs, but a human double-click can't do that.
- **The layout at 390 px** doesn't overflow on Settings, Today or the lead page with ordinary names.
- **Undo** stops the send, and "Stopped — nothing was sent." is shown.

**Rejected-list check:** every fix here is a string edit or a defect repair, not a redesign (R-001). None of it involves:
- keyboard shortcuts (R-002)
- email or any channel fallback for a closed DM window (R-003); B7's text points only to the Instagram app
- AI labels (S-13); B7(a) removes one
- self-serve access (R-012); B11 keeps contact@ as the only door

The navigation cut and the bottom tab bar are the simplify doc's proposals and are not repeated here.

**Design-brain note:**
- Nothing was decided or approved, so nothing was recorded in `decisions/`.
- The frontend agent's own instructions still describe `--rust` as amber `#e8a23a` and the typeface as Plus Jakarta Sans. `globals.css` ships the charcoal monochrome system on Public Sans. The design brain wins, and those instructions need updating.

---

## 7. How this was checked

- **Code:** read at the files cited.
- **Harness:** a temporary route (`src/app/preview-bughunt/`, now deleted) rendered the real `SettingsPage`, `Sidebar`, `ApprovalQueue` and lead-page components inside a copy of `(app)/layout.tsx`, without the auth gate. Two parts were JSX copies with fixture data: the dashboard's server-computed parts (the headline, the empty-state box) and the lead page's server shell.
- **Fetch stub:** `fetch` and `sendBeacon` were replaced before first paint via `Page.addScriptToEvaluateOnNewDocument`.
- **Browser:** Chromium at `/opt/pw-browsers/chromium-1194`, driven over CDP with Node 22's `WebSocket`, at 390×844 (mobile, touch) and 1280×800, in both the dark and light themes.
- **Screenshots:** in the session scratchpad only (not in the repo), `shots/01`–`17`.
- **Limits:**
  - No production data or database was touched. Score values, the "About to be lost" duplication and the Meta-side states are fixtures chosen to match the traced code.
  - The bell-stays-open bug (B22) could not be rendered, because in the harness the sidebar is not in a persistent layout.
  - B23's flash was not caught on a frame.
