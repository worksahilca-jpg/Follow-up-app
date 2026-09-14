import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { defaultRegistry } from '../src/blueprints/index.js';
import { contactKey, normalizePhone } from '../src/engine/contactKey.js';
import { isWithinBusinessHours, nextOpening } from '../src/engine/hours.js';
import { render, tokensIn } from '../src/engine/template.js';
import { clampWords } from '../src/providers/openai.js';
import { buildProvidersForClient, missingCredentials } from '../src/providers/index.js';
import { secretEquals, toEvent } from '../src/server/http.js';
import { hasErrors, validateClient } from '../src/clients/validate.js';
import { MONDAY_2AM, MONDAY_9AM, event, testClient } from './helpers.js';

const hours = testClient().businessHours;

test('business hours are read in the business timezone', () => {
  assert.equal(isWithinBusinessHours(MONDAY_9AM, hours), true);
  assert.equal(isWithinBusinessHours(MONDAY_2AM, hours), false);
});

test('nextOpening lands inside the next open window', () => {
  const opening = nextOpening(MONDAY_2AM, hours);
  assert.ok(opening > MONDAY_2AM);
  assert.equal(isWithinBusinessHours(opening, hours), true);
});

test('a Saturday evening call waits for Monday, not Sunday', () => {
  const saturdayEvening = Date.parse('2026-09-19T23:00:00.000Z');
  const opening = nextOpening(saturdayEvening, hours);
  const weekday = new Date(opening).getUTCDay();
  assert.equal(weekday, 1, 'Monday');
});

test('a config with no open days does not hold messages forever', () => {
  const closed = { ...hours, days: [] as number[] };
  assert.equal(nextOpening(MONDAY_2AM, closed), MONDAY_2AM);
});

test('unresolved tokens render empty rather than leaking braces to a customer', () => {
  const scope = {
    client: testClient(),
    event: event('call.missed', MONDAY_9AM),
    contact: { name: 'Casey Doe' },
    data: {},
    drafts: {},
    settings: {},
  };
  assert.equal(render('Hi {{contact.firstName}} {{data.nope}}', scope), 'Hi Casey');
  assert.deepEqual(tokensIn('{{a.b}} and {{c}}'), ['a.b', 'c']);
});

test('one contact is one key regardless of phone formatting', () => {
  assert.equal(normalizePhone('(416) 555-0100'), '14165550100');
  assert.equal(contactKey({ phone: '+1 416 555 0100' }), contactKey({ phone: '4165550100' }));
  assert.equal(contactKey({ email: 'A@B.example' }), 'mail:a@b.example');
  assert.equal(contactKey({ name: 'nobody' }), undefined);
});

test('a long AI draft is clamped before it becomes four SMS segments', () => {
  const long = Array.from({ length: 80 }, (_, i) => `word${i}`).join(' ');
  const clamped = clampWords(long, 20);
  assert.equal(clamped.split(/\s+/).length, 20);
  assert.ok(clamped.endsWith('...'), 'the cut is visible rather than a sentence stopping dead');
  assert.equal(clampWords('short one', 20), 'short one');
});

test('webhook payloads are accepted in the spellings sources actually send', () => {
  const flat = toEvent('c', 'call.missed', { From: '+14165550100', CallSid: 'CA1', name: 'Dana' });
  assert.equal(flat?.contact.phone, '+14165550100');
  assert.equal(flat?.externalId, 'CA1');

  const nested = toEvent('c', 'lead.created', {
    contact: { phone: '+14165550100', name: 'Dana' },
    data: { service: 'drain' },
  });
  assert.equal(nested?.data.service, 'drain');

  assert.equal(toEvent('c', 'call.missed', { name: 'no contact details' }), undefined);
});

test('webhook keys are compared without leaking length or content', () => {
  assert.equal(secretEquals('abc', 'abc'), true);
  assert.equal(secretEquals('abc', 'abd'), false);
  assert.equal(secretEquals('ab', 'abc'), false);
  assert.equal(secretEquals('', ''), false, 'an unset secret never matches');
});

test('validation catches the mistakes we actually make on a hand-off', () => {
  const registry = defaultRegistry();

  assert.equal(hasErrors(validateClient(testClient(), registry)), false);

  const typo = testClient({
    automations: [{ id: 'x', blueprintId: 'missed-call-txtback', enabled: true, settings: {} }],
  });
  assert.ok(hasErrors(validateClient(typo, registry)), 'a blueprint typo is an error');

  const noLink = testClient({
    automations: [{ id: 'reviews', blueprintId: 'review-request', enabled: true, settings: {} }],
  });
  const issues = validateClient(noLink, registry);
  assert.ok(hasErrors(issues));
  assert.match(issues.map((i) => i.message).join(' '), /review link/i);

  const noNumber = testClient({ fromPhone: undefined });
  assert.ok(hasErrors(validateClient(noNumber, registry)), 'texting with no number to text from');
});

test('each client runs on its own credentials when it names them', () => {
  const shared = testClient();
  const own = testClient({
    id: 'own-account',
    secretEnv: {
      twilioAccountSid: 'ACME_TWILIO_SID',
      twilioAuthToken: 'ACME_TWILIO_TOKEN',
    },
  });
  const env = {
    TWILIO_ACCOUNT_SID: 'shared-sid',
    TWILIO_AUTH_TOKEN: 'shared-token',
    ACME_TWILIO_SID: 'acme-sid',
    ACME_TWILIO_TOKEN: 'acme-token',
  } as NodeJS.ProcessEnv;

  // A client with no named vars falls back to the shared account.
  assert.deepEqual(missingCredentials(shared, env), ['RESEND_API_KEY', 'OPENAI_API_KEY']);

  // A client with its own subaccount is satisfied by its own vars.
  assert.deepEqual(missingCredentials(own, env), ['RESEND_API_KEY', 'OPENAI_API_KEY']);

  // ...and reports its own names when those are the ones missing.
  assert.deepEqual(missingCredentials(own, {} as NodeJS.ProcessEnv), [
    'ACME_TWILIO_SID/ACME_TWILIO_TOKEN',
    'RESEND_API_KEY',
    'OPENAI_API_KEY',
  ]);

  assert.ok(buildProvidersForClient(own, env).sms, 'live provider is constructed');
});
