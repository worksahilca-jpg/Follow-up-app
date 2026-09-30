// The bridge end to end, with every outside party faked locally: the main
// FollowUp app (its voice-agent-auth check) and OpenAI's Realtime socket
// (pointed here through OPENAI_REALTIME_URL). No real Twilio, OpenAI or
// FollowUp is ever contacted.
//
// Run with `npm test` from voice-agent/ (node's built-in test runner).
//
// What is pinned: Twilio sends its "connected" and "start" events the
// instant the Media Stream socket opens. The bridge then spends a network
// round trip (authorizeCall) deciding whether to take the call, and until
// 2026-09-30 it only started listening for Twilio's messages AFTER that
// check came back. `ws` does not buffer for a listener that isn't there
// yet, so "start" — the one event carrying the streamSid and the caller's
// number — was dropped on every call. The OpenAI leg was never opened, the
// caller sat on a silent line, and no transcript ever reached FollowUp.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { WebSocketServer, WebSocket } from "ws";

const AUTH_DELAY_MS = 150;
const CALLBACK_SECRET = "test-callback-secret";

let appServer;
let openAiServer;
let bridge;
let bridgePort;
const openAiConnections = [];
const authRequests = [];
const calls = [];

function listen(server) {
  return new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

before(async () => {
  // Fake FollowUp app: approves any secret, after a realistic delay.
  appServer = createServer((req, res) => {
    authRequests.push(req.url);
    setTimeout(() => {
      res.writeHead(req.headers.authorization === `Bearer ${CALLBACK_SECRET}` ? 200 : 401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
    }, AUTH_DELAY_MS);
  });
  const appPort = await listen(appServer);

  // Fake OpenAI Realtime: records every session the bridge opens.
  const openAiHttp = createServer();
  openAiServer = new WebSocketServer({ server: openAiHttp });
  openAiServer.on("connection", (ws) => {
    const conn = { messages: [] };
    openAiConnections.push(conn);
    ws.on("message", (raw) => conn.messages.push(JSON.parse(raw.toString())));
  });
  const openAiPort = await listen(openAiHttp);
  openAiServer.httpServer = openAiHttp;

  process.env.FOLLOWUP_APP_URL = `http://127.0.0.1:${appPort}`;
  process.env.VOICE_AGENT_CALLBACK_SECRET = CALLBACK_SECRET;
  process.env.OPENAI_API_KEY = "test-key";
  process.env.OPENAI_REALTIME_URL = `ws://127.0.0.1:${openAiPort}/v1/realtime`;
  process.env.PORT = "0";
  delete process.env.VERCEL;

  bridge = (await import("../api/stream.js")).default;
  if (!bridge.listening) await new Promise((resolve) => bridge.once("listening", resolve));
  bridgePort = bridge.address().port;
});

after(async () => {
  for (const call of calls) call.terminate();
  for (const client of openAiServer.clients) client.terminate();
  openAiServer.close();
  openAiServer.httpServer.close();
  appServer.close();
  bridge.closeAllConnections?.();
  bridge.close();
});

/** Opens a stream the way Twilio does: connected + start the moment the socket is up. */
function twilioCall({ closeImmediately = false } = {}) {
  const ws = new WebSocket(`ws://127.0.0.1:${bridgePort}/api/stream?secret=biz-secret`);
  calls.push(ws);
  ws.on("open", () => {
    ws.send(JSON.stringify({ event: "connected", protocol: "Call", version: "1.0.0" }));
    ws.send(
      JSON.stringify({
        event: "start",
        start: { streamSid: "MZ-test", callSid: "CA-test", customParameters: { from: "+15550001111", businessName: "Acme Plumbing" } },
      })
    );
    ws.send(JSON.stringify({ event: "media", media: { payload: "AAAA" } }));
    if (closeImmediately) ws.close();
  });
  return ws;
}

async function waitFor(check, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (check()) return true;
    await new Promise((r) => setTimeout(r, 20));
  }
  return check();
}

test("a call whose start event arrives while the auth check is still running is still answered", async () => {
  const before = openAiConnections.length;
  const call = twilioCall();

  const opened = await waitFor(() => openAiConnections.length > before, AUTH_DELAY_MS + 2000);
  assert.equal(opened, true, "the OpenAI Realtime leg was never opened — Twilio's start event was dropped");

  // And it was opened for the right business, with the greeting requested.
  const session = openAiConnections[openAiConnections.length - 1];
  await waitFor(() => session.messages.some((m) => m.type === "response.create"), 1000);
  const update = session.messages.find((m) => m.type === "session.update");
  assert.match(update?.session?.instructions ?? "", /Acme Plumbing/);
  // The audio Twilio sent during the check is not lost either.
  await waitFor(() => session.messages.some((m) => m.type === "input_audio_buffer.append"), 1000);
  assert.ok(session.messages.some((m) => m.type === "input_audio_buffer.append" && m.audio === "AAAA"));

  call.close();
});

test("a caller who hangs up before the auth check returns never opens a billed OpenAI session", async () => {
  const before = openAiConnections.length;
  const authBefore = authRequests.length;
  twilioCall({ closeImmediately: true });

  await waitFor(() => authRequests.length > authBefore, 1000);
  // Give the (delayed) approval time to land and anything it would start.
  await new Promise((r) => setTimeout(r, AUTH_DELAY_MS + 400));
  assert.equal(openAiConnections.length, before);
});
