import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { clientMap } from '../src/clients/index.js';
import { MONDAY_2AM, MONDAY_9AM, event, harness, smsBodies, testClient } from './helpers.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

test('a missed call is texted back immediately', async () => {
  const { engine, providers } = harness();
  const client = testClient();

  const runs = await engine.handleEvent(client, event('call.missed', MONDAY_9AM));

  assert.equal(runs.length, 1);
  assert.equal(runs[0]?.status, 'waiting', 'the run parks on the follow-up wait');
  const texts = smsBodies(providers);
  assert.equal(texts.length, 1);
  assert.match(texts[0] ?? '', /sorry we missed your call/i);
  assert.match(texts[0] ?? '', /Casey/, 'uses the caller first name');
  assert.match(texts[0] ?? '', /Reply STOP to opt out/, 'first message carries the opt-out notice');
});

test('the nudge fires only after the configured delay', async () => {
  const { engine, providers, clock } = harness();
  const client = testClient();
  const clients = clientMap();
  clients.set(client.id, client);

  await engine.handleEvent(client, event('call.missed', MONDAY_9AM));
  assert.equal(smsBodies(providers).length, 1);

  clock.advance(2 * HOUR);
  await engine.tick(clients);
  assert.equal(smsBodies(providers).length, 1, 'nothing at two hours — the default is four');

  clock.advance(3 * HOUR);
  await engine.tick(clients);
  assert.equal(smsBodies(providers).length, 2, 'nudge lands after four hours');
  assert.doesNotMatch(smsBodies(providers)[1] ?? '', /Reply STOP/, 'the notice rides the first message only');
});

test('a reply stops the sequence dead', async () => {
  const { engine, providers, clock, store } = harness();
  const client = testClient();
  const clients = clientMap();
  clients.set(client.id, client);

  await engine.handleEvent(client, event('call.missed', MONDAY_9AM));

  clock.advance(HOUR);
  await engine.handleEvent(
    client,
    event('message.inbound', clock.now(), { data: { text: 'yes please come by' } }),
  );

  clock.advance(6 * HOUR);
  await engine.tick(clients);

  assert.equal(smsBodies(providers).length, 1, 'no nudge after a reply');
  const runs = await store.listRuns(client.id);
  assert.equal(runs[0]?.status, 'stopped');
  assert.equal(runs[0]?.stoppedReason, 'caller replied');
});

test('STOP blocks every future message for that contact', async () => {
  const { engine, providers, clock } = harness();
  const client = testClient();

  await engine.handleEvent(client, event('message.inbound', MONDAY_9AM, { data: { text: 'STOP' } }));
  clock.advance(MINUTE);
  await engine.handleEvent(client, event('call.missed', clock.now(), { externalId: 'c2' }));

  assert.equal(smsBodies(providers).length, 0, 'an opted-out contact is never texted');
});

test('"stopped by earlier" is a reply, not an opt-out', async () => {
  const { engine, providers, clock } = harness();
  const client = testClient();

  await engine.handleEvent(client, event('call.missed', MONDAY_9AM));
  clock.advance(MINUTE);
  await engine.handleEvent(
    client,
    event('message.inbound', clock.now(), { data: { text: 'stopped by the shop already' } }),
  );

  assert.equal(smsBodies(providers).length, 1);
});

test('a 2am missed call is held until the business opens', async () => {
  const { engine, providers, clock, store } = harness(MONDAY_2AM);
  const client = testClient();
  const clients = clientMap();
  clients.set(client.id, client);

  await engine.handleEvent(client, event('call.missed', MONDAY_2AM));
  assert.equal(smsBodies(providers).length, 0, 'nothing goes out at 2am');

  const [held] = await store.listRuns(client.id);
  assert.equal(held?.status, 'waiting');
  assert.ok(held?.actions.some((a) => a.outcome === 'held'), 'the hold is visible to the owner');

  clock.advance(7 * HOUR); // 9am
  await engine.tick(clients);
  assert.equal(smsBodies(providers).length, 1, 'sent once the shop opens');
});

test('a duplicate webhook delivery does not text the customer twice', async () => {
  const { engine, providers } = harness();
  const client = testClient();

  await engine.handleEvent(client, event('call.missed', MONDAY_9AM, { externalId: 'call-1' }));
  await engine.handleEvent(client, event('call.missed', MONDAY_9AM, { externalId: 'call-1' }));

  assert.equal(smsBodies(providers).length, 1);
});

test('the global kill switch stops everything in one edit', async () => {
  const { engine, providers } = harness();
  const client = testClient({ enabled: false });

  const runs = await engine.handleEvent(client, event('call.missed', MONDAY_9AM));

  assert.equal(runs.length, 0);
  assert.equal(smsBodies(providers).length, 0);
});

test('a contact with no phone is skipped, not crashed on', async () => {
  const { engine, providers, store } = harness();
  const client = testClient();

  await engine.handleEvent(
    client,
    event('call.missed', MONDAY_9AM, { contact: { name: 'No Phone', email: 'a@b.example' } }),
  );

  assert.equal(smsBodies(providers).length, 0);
  const [run] = await store.listRuns(client.id);
  assert.ok(run?.actions.some((a) => a.outcome === 'skipped'));
});

test('a failing send marks the run for attention instead of dying silently', async () => {
  const { engine, store, providers } = harness();
  const client = testClient();
  providers.sms.send = async () => {
    throw new Error('Twilio 21610: unsubscribed recipient');
  };

  await engine.handleEvent(client, event('call.missed', MONDAY_9AM));

  const [run] = await store.listRuns(client.id);
  assert.equal(run?.status, 'failed');
  assert.match(run?.actions.at(-1)?.error ?? '', /21610/);
});

test('each held step is reported separately, not just the first', async () => {
  // Friday 5pm: the first text goes out, the four-hour nudge lands after
  // closing and is held, and both holds must be visible to the owner.
  const fridayLate = Date.parse('2026-09-18T20:30:00.000Z'); // 4:30pm Toronto
  const { engine, clock, store } = harness(fridayLate);
  const client = testClient();
  const clients = clientMap();
  clients.set(client.id, client);

  await engine.handleEvent(client, event('call.missed', fridayLate));
  clock.advance(5 * HOUR);
  await engine.tick(clients);

  const [run] = await store.listRuns(client.id);
  const held = run?.actions.filter((a) => a.outcome === 'held') ?? [];
  assert.equal(held.length, 1, 'the nudge is held once');
  assert.equal(held[0]?.stepIndex, 3, 'and names which step was held');
});
