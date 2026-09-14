import type { Blueprint, Step } from '../types.js';
import { num, str } from '../engine/settings.js';

const DEFAULT_ASK =
  'Hi {{contact.firstName}}, thanks for choosing {{business.name}}. ' +
  'If we did right by you, a quick Google review helps us a lot: {{settings.reviewUrl}}';

const DEFAULT_REMINDER =
  'Hi {{contact.firstName}}, no pressure at all — if you have 30 seconds, ' +
  'here is that review link again: {{settings.reviewUrl}}';

/**
 * Asks once, reminds once, then stops. Owners who ask manually either forget
 * or over-ask; the whole value is that this does neither.
 */
export const reviewRequest: Blueprint = {
  id: 'review-request',
  name: 'Job finished → review request',
  promise: 'Every completed job asks for a Google review at the right moment, then stops.',
  trigger: 'job.completed',
  settings: [
    {
      key: 'reviewUrl',
      label: 'Review link',
      ask: 'What is your Google review link? (Google Business Profile → Ask for reviews)',
      required: true,
    },
    {
      key: 'delayHours',
      label: 'Delay after the job (hours)',
      ask: 'How long after the job finishes should we ask?',
      required: false,
      default: 3,
    },
    {
      key: 'reminderDays',
      label: 'Reminder delay (days)',
      ask: 'If they do not reply, how many days until one reminder?',
      required: false,
      default: 3,
    },
    { key: 'askMessage', label: 'Ask text', ask: 'How should the ask read?', required: false, default: DEFAULT_ASK },
  ],
  build({ settings }): Step[] {
    return [
      { type: 'wait', minutes: Math.round(num(settings, 'delayHours', 3) * 60) },
      { type: 'send_sms', label: 'review-ask', body: str(settings, 'askMessage', DEFAULT_ASK) },
      { type: 'wait', minutes: Math.round(num(settings, 'reminderDays', 3) * 24 * 60) },
      { type: 'stop_if', condition: { op: 'contact_replied' }, reason: 'customer responded' },
      { type: 'send_sms', label: 'review-reminder', body: str(settings, 'reminderMessage', DEFAULT_REMINDER) },
    ];
  },
};
