# FollowUp voice-agent bridge

A tiny, single-file, always-on service: it holds a live phone call's audio
stream open and relays it between Twilio and OpenAI's Realtime API, so a
call can be answered by a live, talking AI instead of a voicemail box.

It exists as its **own Vercel project**, separate from the main `followup`
Next.js app, for one reason: a phone call needs a persistent bidirectional
connection for its whole duration, and that's not something a normal
Next.js request/response route can hold open. See
`../followup/research/integrations/2026-09-06-voice-ai-and-multilingual-scoping.md`
for the full reasoning behind this architecture (and why it's a
build-it-ourselves bridge rather than a third-party voice-AI platform like
Vapi/Retell/Bland).

## How it fits together

```
caller ↔ Twilio ↔ (this service) ↔ OpenAI Realtime API
                        │
                        └─ on hangup, POSTs the transcript to
                           followup's /api/twilio/voice-agent-callback/[secret]
                           (creates the Lead/Conversation/Message rows,
                           runs scoring — see that route for the other half)
```

`followup/src/app/api/twilio/voice/[secret]/route.ts` is what points a
call here in the first place — only when `Business.voiceAgentEnabled` is
true (off by default; toggled in Settings → Phone (SMS + calls)). It
never does anything with the call itself: it just tells Twilio to
`<Connect><Stream>` here and, when the stream ends for any reason, falls
back to the ordinary voicemail flow. This service never talks to
FollowUp's database directly — it only ever calls back into the main
app's own API, so the conversation ends up owned in FollowUp's DB via the
exact same code path (`scoreAndDraftForLead`, `checkRapidEngagement`)
every other channel already uses.

## Deploying (one-time setup)

1. In Vercel, create a new project in the same team FollowUp already uses
   (`north-frame3`), linked to this same GitHub repo, with **Root
   Directory** set to `voice-agent`. Framework preset: leave as
   auto-detected (plain Node.js) — no build command needed, `npm install`
   is enough.
2. Set these environment variables on **this** project:
   - `OPENAI_API_KEY` — same OpenAI key already used elsewhere, or a
     separate one if you want to track voice-agent spend independently.
   - `FOLLOWUP_APP_URL` — the main app's URL, e.g. `https://followupbase.io`.
   - `VOICE_AGENT_CALLBACK_SECRET` — any long random string you generate
     once (`openssl rand -base64 32`, or similar).
   - `OPENAI_REALTIME_MODEL` (optional) — defaults to `gpt-realtime-mini`
     if unset.
3. On the **main followup app's** Vercel project, set:
   - `VOICE_AGENT_WS_URL` — this project's deployed URL, e.g.
     `wss://followup-voice-agent.vercel.app` (the app builds
     `wss://.../api/stream?secret=...` from this at call time — see
     `voiceAgentStreamUrl` in `followup/src/lib/twilio.ts`).
   - `VOICE_AGENT_CALLBACK_SECRET` — the exact same value as step 2, so
     the callback route can verify requests really came from this bridge.
4. Deploy. `GET /api/stream` on the deployed URL should return a plain
   "FollowUp voice-agent bridge is up." — that's the liveness check, not
   a real call test.
5. Turn "Live AI voice agent" on for one test business in Settings, then
   place a real call to that business's Twilio number. This is genuinely
   real money (Twilio + OpenAI Realtime API, per minute) — there's no way
   to simulate an actual phone call from a dev environment, so a real call
   is the only way to verify this end to end.

## What's deliberately NOT built yet (Phase 1 scope)

- **No fallback voice/provider selection** — one voice (`alloy`), one
  model tier (`gpt-realtime-mini`).
- **No per-state call-recording consent logic** — the same spoken
  disclosure plays everywhere; the research doc flags this as something
  to add before scaling into two-party-consent states specifically.
- **No handling for a call transferring to a real human mid-conversation**
  — if the agent can't help, today it just says so and the call ends;
  there's no "let me connect you to someone" path.
- **The AI-disclosure/recording-consent line Twilio speaks before
  connecting is always in English** — even though the agent itself
  responds in whatever language the caller then speaks. Detecting the
  caller's language before any audio has been heard isn't really
  solvable up front; this is a known, accepted limitation for now, not
  an oversight.
