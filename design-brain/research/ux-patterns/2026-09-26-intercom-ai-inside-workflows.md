# Intercom: AI inside the workflow, not on top of it

**Date:** 2026-09-26 · **Asked by:** Sahil · **Status:** STUDIED, proposals pending approval

**Question:** How does Intercom show AI doing useful work inside the daily flow, without the whole product
"screaming AI"? Where should FollowUp do the same?

Standing rule this study must respect: **AI is an invisible capability, never a personality** (CLAUDE.md, S-13). We
take Intercom's *mechanics*, not its branding. Fin is a named, branded agent, and we don't copy that part.

---

## What Intercom does

- **The work happens where the person already is.** Copilot sits in the inbox sidebar, next to the conversation, so
  nobody switches screens.
- **Every answer shows its sources.** Copilot links the articles and past conversations it used, so the agent can check
  it "without changing tabs and losing context".
- **Small, specific actions in the composer:** rephrase, change the tone, translate, fix grammar. They're verbs on the
  reply, not a chat window.
- **A summary on handoff.** When a conversation passes to a teammate, a short summary goes with it, so nobody rereads
  the whole thread.
- **Outcomes, counted:** "resolved" conversations, and "agents close 31% more conversations". The AI is judged by work
  finished, not by how clever it sounds.
- **A clean handoff to a human.** When it can't help, it passes the whole conversation to a person.

### The principles underneath

- **P1: Show the work, not the robot.** The draft, the summary and the source are the product. No mascot.
- **P2: Every suggestion is checkable.** Say what it's based on.
- **P3: Verbs on the reply** (shorter, warmer, in their language), not a separate AI screen.
- **P4: Count finished work** (sent as written, answered, came back), not "AI actions".
- **P5: The handoff carries context** (a summary), so a person can pick up in seconds.

---

## Where FollowUp stands (checked in main, 2026-09-26)

**Already right:**
- The reply is written in place, in "Needs your OK".
- "Held because…" explains every held draft.
- Every lead has an audit trail.
- There are no sparkles (S-13; TestLeadButton and workflows had theirs removed).

**Still saying "AI" on screen:**
- the lead page heading "**AI-suggested follow-up**" (MessageComposer);
- "**Consent & AI activity**" (lead page section title);
- the Settings sync note "**AI-scored N**";
- "**Live AI voice agent**" (TwilioConfig);
- the landing pricing lede "no AI add-on" (fine: it's about price, not a label).

**What isn't there yet:**
- **No "based on".** A draft that says "$6,500" doesn't show where that number came from.
- **No quick edits.** Only "Regenerate", which throws the draft away.
- **No catch-up summary** at the top of a long conversation, which matters when a teammate takes over.
- **No "sent as written" figure for the owner.** `FollowUp.draftEdited` is stored for every account (/analytics shows
  "Drafts sent as written"), but Today and the weekly email don't show it.

---

## Proposals (ranked)

1. **Take "AI" off the working screens (P1).** Small and safe:
   - "AI-suggested follow-up" → "**Your reply, ready**", with the sub-line "Written from your conversation. Nothing
     sends until you do."
   - "Consent & AI activity" → "**What FollowUp did**".
   - "AI-scored 12" → "**12 sorted by how likely they are to book**".
   - "Live AI voice agent" → "**Answers your calls**".
2. **"Based on" under each draft (P2).** One quiet line under a waiting reply, for example "Based on Priya's message
   on Instagram, 5 days ago, and the $6,500 you quoted on Sep 20." This comes from what the draft actually used.
   - It needs the drafting step to return what it relied on. That's a small backend change.
   - It never shows a fact that isn't in the conversation. The drafting rules already forbid inventing prices.
3. **Quick edits on the reply (P3):** three plain buttons next to Edit: **Shorter · Warmer · In their language**. Each
   rewrites this draft in place, and it still waits for OK. This replaces most uses of "Regenerate".
4. **"Sent as written" as the proof (P4).** On Today's "This week" and in the Monday email: "**You sent 18 of 21
   replies without changing a word.**" It's real, measured data (`draftEdited`) and shows the work is good without
   saying "AI".
5. **Catch-up line on long conversations (P5).** At the top of a lead with more than about 6 messages: "**Catching up:**
   asked about a bathroom redo, you quoted $6,500, she asked about Thursday." It's useful when a teammate takes over
   (only-admins-send teams, round-robin). It costs one model call per lead page, so it's cached.

**Guardrails:**
- No sparkles, bot avatars, typing dots or "AI-powered" badges (S-13).
- Never a separate chat-with-the-AI screen.
- "Based on" and "catching up" only state what's in the conversation.

---

## Sources

- [Intercom homepage](https://www.intercom.com/),
  [Copilot](https://www.intercom.com/helpdesk/copilot),
  [AI inbox](https://www.intercom.com/helpdesk/inbox)
- [Intercom Help: AI features in the Inbox](https://www.intercom.com/help/en/articles/6955446-ai-features-available-in-the-inbox),
  [Copilot explained](https://www.intercom.com/help/en/articles/9121374-copilot-explained),
  [How to use Copilot](https://www.intercom.com/help/en/articles/8587194-how-to-use-copilot),
  [Fin AI Agent outcomes](https://www.intercom.com/help/en/articles/8205718-fin-ai-agent-outcomes)
- [getmacha: Intercom Fin explained](https://www.getmacha.com/blog/intercom-fin-ai-explained)
