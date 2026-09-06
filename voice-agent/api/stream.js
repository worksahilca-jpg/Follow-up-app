// Always-on audio bridge: Twilio Media Streams <-> OpenAI's Realtime API.
//
// Deployed as its OWN Vercel project (see ../README.md), separate from
// the main followup Next.js app, because holding a live phone call open
// needs a persistent bidirectional connection that a normal Next.js
// request/response route can't hold — see
// followup/research/integrations/2026-09-06-voice-ai-and-multilingual-scoping.md
// for why this architecture was chosen.
//
// Plain JS/ESM on purpose, no build step — one file is the entire
// service, and every request Vercel routes here goes to /api/stream
// (Vercel's zero-config Node.js Function convention: any file under
// api/ maps 1:1 to that path). Twilio's <Connect><Stream> opens a
// WebSocket to /api/stream?secret=<business's twilioSecret> (see
// followup/src/lib/twilio.ts's voiceAgentStreamUrl) — the query param,
// not a path segment, to avoid any ambiguity between Vercel's
// dynamic-route file-naming convention and the raw WebSocket-upgrade
// handling a plain exported http.Server needs (the "Deploy a Node.js
// HTTP Server" / WebSocket support Vercel now documents).
//
// What actually happens on a call:
//   1. Twilio connects here and streams the caller's audio as base64
//      mulaw (8kHz) "media" events.
//   2. This relays that audio straight into OpenAI's Realtime API
//      (same g711_ulaw format on both sides — no transcoding needed).
//   3. OpenAI's spoken reply comes back as audio deltas, relayed straight
//      back to Twilio as "media" events the caller actually hears.
//   4. If the caller starts talking while the agent is still speaking
//      (barge-in), OpenAI's server-side VAD fires speech_started — this
//      tells Twilio to stop playing queued audio and tells OpenAI to
//      cancel its in-flight response, so it doesn't talk over them.
//   5. When the call ends, the full transcript (both sides) is POSTed to
//      the main app's /api/twilio/voice-agent-callback/[secret], which
//      turns it into a real Lead/Conversation/Message + runs scoring —
//      the conversation ends up owned in FollowUp's own DB, not left
//      sitting only on this bridge or on OpenAI's side.

import { createServer } from "node:http";
import express from "express";
import { WebSocketServer, WebSocket } from "ws";

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const FOLLOWUP_APP_URL = process.env.FOLLOWUP_APP_URL;
const VOICE_AGENT_CALLBACK_SECRET = process.env.VOICE_AGENT_CALLBACK_SECRET;
const REALTIME_MODEL = process.env.OPENAI_REALTIME_MODEL || "gpt-realtime-mini";

// How long to wait for OpenAI's Realtime socket to actually open before
// giving up on this call. A caller must never sit on a silent line — if
// this fires, the Twilio WebSocket is closed, which ends the <Connect>
// verb and lets Twilio's own `action` URL fall the call back to the
// ordinary voicemail flow (see followup's voice/[secret]/route.ts).
const OPENAI_CONNECT_TIMEOUT_MS = 6000;

const app = express();
// A plain GET (not a WebSocket upgrade) is just a liveness check — Twilio
// only ever opens this as a WebSocket. Path-agnostic on purpose: Vercel
// mounts this file at /api/stream and strips that prefix before
// forwarding, so inside here the request path is "/" — locally it's the
// full "/api/stream". Match either rather than guess.
app.get(/.*/, (_req, res) => {
  res.status(200).type("text/plain").send("FollowUp voice-agent bridge is up.");
});

const server = createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (twilioWs, request) => {
  const url = new URL(request.url, "http://internal");
  const secret = url.searchParams.get("secret");
  if (!secret) {
    twilioWs.close(1008, "Missing secret");
    return;
  }
  handleCall(twilioWs, secret).catch((err) => {
    console.error("[voice-agent] handleCall crashed:", err);
    try {
      twilioWs.close();
    } catch {
      // already closed
    }
  });
});

/**
 * One phone call, start to finish. All state here is scoped to this one
 * call — there's no shared state across connections beyond process-level
 * env vars, since each call is its own independent WebSocket to Twilio
 * and its own independent WebSocket to OpenAI.
 */
async function handleCall(twilioWs, secret) {
  let streamSid = null;
  let callerPhone = "";
  let businessName = "the business";
  let openaiWs = null;
  let openaiReady = false;
  let agentSpeaking = false;
  let reported = false;
  const pendingAudioQueue = [];
  const turns = [];

  function reportAndClose() {
    if (reported) return;
    reported = true;
    postTranscript({ secret, from: callerPhone, turns }).catch((err) => {
      console.error("[voice-agent] postTranscript failed:", err);
    });
  }

  function closeOpenAi() {
    if (openaiWs) {
      try {
        openaiWs.close();
      } catch {
        // already closed
      }
    }
  }

  twilioWs.on("message", (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (msg.event === "connected") {
      return;
    }

    if (msg.event === "start") {
      streamSid = msg.start?.streamSid ?? null;
      const params = msg.start?.customParameters ?? {};
      callerPhone = params.from ?? "";
      businessName = params.businessName || businessName;

      openaiWs = connectToOpenAi(businessName);
      const connectTimeout = setTimeout(() => {
        if (!openaiReady) {
          console.error("[voice-agent] OpenAI Realtime connect timed out — falling back to voicemail.");
          try {
            twilioWs.close();
          } catch {
            // already closed
          }
        }
      }, OPENAI_CONNECT_TIMEOUT_MS);

      openaiWs.on("open", () => {
        clearTimeout(connectTimeout);
        openaiReady = true;
        for (const b64 of pendingAudioQueue) {
          openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }));
        }
        pendingAudioQueue.length = 0;
      });

      wireOpenAiEvents(openaiWs, {
        onAudioDelta(b64) {
          if (streamSid) {
            twilioWs.send(JSON.stringify({ event: "media", streamSid, media: { payload: b64 } }));
            agentSpeaking = true;
          }
        },
        onSpeechStarted() {
          // Barge-in: the caller started talking over the agent. Stop
          // whatever Twilio has queued to play, and tell OpenAI to
          // abandon the response it was mid-way through — otherwise the
          // agent keeps talking, unaware it's being interrupted.
          if (agentSpeaking && streamSid) {
            twilioWs.send(JSON.stringify({ event: "clear", streamSid }));
            openaiWs.send(JSON.stringify({ type: "response.cancel" }));
            agentSpeaking = false;
          }
        },
        onCallerTranscript(text) {
          if (text.trim()) turns.push({ role: "caller", text: text.trim() });
        },
        onAgentTranscript(text) {
          if (text.trim()) turns.push({ role: "agent", text: text.trim() });
        },
        onResponseDone() {
          agentSpeaking = false;
        },
        onError(err) {
          console.error("[voice-agent] OpenAI Realtime error:", err);
        },
      });

      openaiWs.on("close", () => {
        try {
          twilioWs.close();
        } catch {
          // already closed
        }
        reportAndClose();
      });

      return;
    }

    if (msg.event === "media") {
      const b64 = msg.media?.payload;
      if (!b64) return;
      if (openaiReady && openaiWs && openaiWs.readyState === WebSocket.OPEN) {
        openaiWs.send(JSON.stringify({ type: "input_audio_buffer.append", audio: b64 }));
      } else {
        // Caller audio can arrive before OpenAI's socket finishes
        // connecting — buffer it rather than drop the first half-second
        // of what they say.
        pendingAudioQueue.push(b64);
      }
      return;
    }

    if (msg.event === "stop") {
      closeOpenAi();
      reportAndClose();
    }
  });

  twilioWs.on("close", () => {
    closeOpenAi();
    reportAndClose();
  });

  twilioWs.on("error", (err) => {
    console.error("[voice-agent] Twilio WebSocket error:", err);
  });
}

/** Opens the OpenAI Realtime connection and kicks off the session — the agent speaks first, since the caller just heard Twilio's own AI-disclosure greeting and expects to be greeted next, not silence. */
function connectToOpenAi(businessName) {
  const url = `wss://api.openai.com/v1/realtime?model=${encodeURIComponent(REALTIME_MODEL)}`;
  const ws = new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "OpenAI-Beta": "realtime=v1",
    },
  });

  ws.on("open", () => {
    ws.send(
      JSON.stringify({
        type: "session.update",
        session: {
          modalities: ["audio", "text"],
          voice: "alloy",
          // Twilio's Media Streams and OpenAI's Realtime API both speak
          // g711_ulaw — matching formats on both sides means every audio
          // frame passes straight through with no resampling/transcoding
          // step to get wrong.
          input_audio_format: "g711_ulaw",
          output_audio_format: "g711_ulaw",
          input_audio_transcription: { model: "whisper-1" },
          turn_detection: { type: "server_vad" },
          instructions: buildInstructions(businessName),
        },
      })
    );
    ws.send(JSON.stringify({ type: "response.create" }));
  });

  return ws;
}

/**
 * Deliberately narrow, matching the research doc's compliance finding
 * (Part 1, "keep the conversation scoped to what the caller called
 * about") — this takes a message and reassures the caller, it doesn't
 * quote prices, promise availability, or commit to anything the business
 * hasn't actually confirmed. Multilingual behavior is an explicit
 * instruction, not left to model default, same fix already applied to
 * generateFollowUpMessage in followup/src/lib/integrations/openai.ts.
 */
function buildInstructions(businessName) {
  return [
    `You are a friendly phone assistant answering calls for ${businessName}.`,
    "Warmly greet the caller, ask what they're calling about, and find out what they need.",
    "Keep your responses short and natural, like a real phone conversation, not a script.",
    "Let them know their message has been received and the team will follow up soon.",
    "Never quote prices, promise availability, or make commitments you can't actually verify — if asked something you genuinely can't answer, say you'll pass it along to the team.",
    "Always respond in the same language the caller is speaking to you in. Mirror their language exactly and never default to English unless they are speaking English.",
  ].join(" ");
}

/** Wires the handful of OpenAI Realtime events this bridge actually needs — everything else in their fairly large event vocabulary is ignored on purpose. */
function wireOpenAiEvents(ws, handlers) {
  ws.on("message", (raw) => {
    let evt;
    try {
      evt = JSON.parse(raw.toString());
    } catch {
      return;
    }
    switch (evt.type) {
      case "input_audio_buffer.speech_started":
        handlers.onSpeechStarted();
        break;
      case "conversation.item.input_audio_transcription.completed":
        handlers.onCallerTranscript(evt.transcript ?? "");
        break;
      case "response.audio.delta":
        if (evt.delta) handlers.onAudioDelta(evt.delta);
        break;
      case "response.audio_transcript.done":
        handlers.onAgentTranscript(evt.transcript ?? "");
        break;
      case "response.done":
        handlers.onResponseDone();
        break;
      case "error":
        handlers.onError(evt.error ?? evt);
        break;
      default:
        break;
    }
  });
  ws.on("error", (err) => handlers.onError(err));
}

/** Hands the finished transcript to the main app — see followup/src/app/api/twilio/voice-agent-callback/[secret]/route.ts. Best-effort: a failure here loses the transcript but must never throw back into the call-handling path, which has already ended by the time this runs. */
async function postTranscript({ secret, from, turns }) {
  if (!FOLLOWUP_APP_URL || !VOICE_AGENT_CALLBACK_SECRET) {
    console.error("[voice-agent] Missing FOLLOWUP_APP_URL or VOICE_AGENT_CALLBACK_SECRET — transcript dropped.");
    return;
  }
  if (!from || turns.length === 0) return;

  const url = `${FOLLOWUP_APP_URL.replace(/\/$/, "")}/api/twilio/voice-agent-callback/${secret}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${VOICE_AGENT_CALLBACK_SECRET}`,
    },
    body: JSON.stringify({ from, turns }),
  });
  if (!res.ok) {
    console.error(`[voice-agent] voice-agent-callback rejected the transcript: ${res.status} ${await res.text().catch(() => "")}`);
  }
}

// Only bind a port when running locally. On Vercel the exported server
// object IS the function — Vercel drives it directly, and calling
// listen() there as well is the documented "pick one, not both" mistake:
// it never resolves inside their runtime and every request hangs.
if (!process.env.VERCEL) {
  server.listen(Number(process.env.PORT ?? 8080));
}

export default server;
