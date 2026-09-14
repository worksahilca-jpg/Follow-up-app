import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { clientMap } from '../src/clients/index.js';
import { defaultRegistry } from '../src/blueprints/index.js';
import { MONDAY_9AM, event, harness, smsBodies, testClient } from './helpers.js';

const DAY = 24 * 60 * 60_000;

test('every catalogue blueprint has a promise and a trigger', () => {
  for (const bp of defaultRegistry().all()) {
    assert.ok(bp.name.trim(), `${bp.id} has no name`);
    assert.ok(bp.promise.trim(), `${bp.id} has no promise to sell`);
    assert.ok(bp.trigger.trim(), `${bp.id} has no trigger`);
  }
});

test('the quote sequence chases three times then tells the owner', async () => {
  const { engine, providers, clock } = harness();
  const client = testClient({
    automations: [
      { id: 'quotes', blueprintId: 'quote-followup', enabled: true, settings: {} },
    ],
  });
  const clients = clientMap();
  clients.set(client.id, client);

  await engine.handleEvent(
    client,
    event('quote.sent', MONDAY_9AM, {
      data: { jobDescription: 'basement rough-in', quoteAmount: '$2,400' },
    }),
  );
  assert.equal(smsBodies(providers).length, 0, 'nothing on the day the quote goes out');

  for (let day = 0; day < 20; day++) {
    clock.advance(DAY);
    await engine.tick(clients);
  }

  const texts = smsBodies(providers);
  assert.equal(texts.length, 4, 'three chases to the customer plus the owner alert');
  assert.match(texts[0] ?? '', /checking you got the quote/i);
  assert.match(texts[3] ?? '', /went unanswered/i);
});

test('the quote sequence stops the moment the customer answers', async () => {
  const { engine, providers, clock, store } = harness();
  const client = testClient({
    automations: [{ id: 'quotes', blueprintId: 'quote-followup', enabled: true, settings: {} }],
  });
  const clients = clientMap();
  clients.set(client.id, client);

  await engine.handleEvent(
    client,
    event('quote.sent', MONDAY_9AM, { data: { jobDescription: 'rough-in', quoteAmount: '$2,400' } }),
  );

  clock.advance(3 * DAY);
  await engine.tick(clients);
  assert.equal(smsBodies(providers).length, 1);

  await engine.handleEvent(
    client,
    event('message.inbound', clock.now(), { data: { text: 'looks good, book us in' } }),
  );

  for (let day = 0; day < 20; day++) {
    clock.advance(DAY);
    await engine.tick(clients);
  }

  assert.equal(smsBodies(providers).length, 1, 'no further chasing after they answered');
  const [run] = await store.listRuns(client.id);
  assert.equal(run?.stoppedReason, 'customer answered the quote');
});

test('the review request carries the owner review link', async () => {
  const { engine, providers, clock } = harness();
  const client = testClient({
    automations: [
      {
        id: 'reviews',
        blueprintId: 'review-request',
        enabled: true,
        settings: { reviewUrl: 'https://g.page/r/test/review', delayHours: 2 },
      },
    ],
  });
  const clients = clientMap();
  clients.set(client.id, client);

  await engine.handleEvent(client, event('job.completed', MONDAY_9AM));
  clock.advance(3 * 60 * 60_000);
  await engine.tick(clients);

  assert.match(smsBodies(providers)[0] ?? '', /g\.page\/r\/test\/review/);
});

test('the appointment reminder is timed off the appointment, not the booking', async () => {
  const { engine, providers, clock } = harness();
  const startsAt = MONDAY_9AM + 10 * DAY;
  const client = testClient({
    automations: [
      { id: 'reminders', blueprintId: 'appointment-reminder', enabled: true, settings: { hoursBefore: 24 } },
    ],
  });
  const clients = clientMap();
  clients.set(client.id, client);

  await engine.handleEvent(
    client,
    event('appointment.booked', MONDAY_9AM, {
      data: { startsAt, appointmentLabel: 'drain inspection', appointmentWhen: 'Thu 9am' },
    }),
  );

  clock.advance(8 * DAY);
  await engine.tick(clients);
  assert.equal(smsBodies(providers).length, 0, 'silent eight days out');

  // Exactly nine days in: 24 hours before the appointment, and 9am locally.
  clock.advance(DAY);
  await engine.tick(clients);
  assert.equal(smsBodies(providers).length, 1, 'fires a day before the appointment');
  assert.match(smsBodies(providers)[0] ?? '', /drain inspection/);
});

test('a lead is acknowledged, pushed to the CRM, and the owner is told', async () => {
  const { engine, providers } = harness();
  const client = testClient({
    automations: [{ id: 'leads', blueprintId: 'lead-intake-router', enabled: true, settings: {} }],
  });

  await engine.handleEvent(
    client,
    event('lead.created', MONDAY_9AM, {
      data: { service: 'water heater', source: 'website form' },
    }),
  );

  assert.equal(providers.sent.filter((s) => s.kind === 'http').length, 1, 'pushed to the CRM');
  const texts = smsBodies(providers);
  assert.match(texts[0] ?? '', /water heater/, 'the lead hears back naming what they asked about');
  assert.match(texts[1] ?? '', /New lead for Test Co/, 'the owner is told');
});
