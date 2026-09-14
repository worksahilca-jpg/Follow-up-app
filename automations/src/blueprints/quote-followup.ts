import type { Blueprint, Step } from '../types.js';
import { num, str } from '../engine/settings.js';

const NUDGE =
  'Hi {{contact.firstName}}, just checking you got the quote from {{business.name}} for {{data.jobDescription}}. ' +
  'Any questions on it?';

const FINAL =
  'Hi {{contact.firstName}}, last note from me — if the timing is not right for {{data.jobDescription}}, ' +
  'no problem at all. The quote stands if you want it later.';

/**
 * The highest-value automation we sell, because the money is already on the
 * table: a sent quote that nobody chased. Three touches over ten days, each
 * one cancelled the moment the customer replies.
 */
export const quoteFollowUp: Blueprint = {
  id: 'quote-followup',
  name: 'Quote sent → follow up until they answer',
  promise: 'Every quote you send gets followed up three times, and stops the second they reply.',
  trigger: 'quote.sent',
  settings: [
    { key: 'firstNudgeDays', label: 'First nudge (days)', ask: 'How many days after sending a quote should we check in?', required: false, default: 2 },
    { key: 'secondNudgeDays', label: 'Second nudge (days)', ask: 'And the second touch?', required: false, default: 4 },
    { key: 'finalNudgeDays', label: 'Final nudge (days)', ask: 'And the last one before we let it go?', required: false, default: 7 },
    { key: 'tone', label: 'Tone', ask: 'How do you talk to customers — straight to the point, or warm and chatty?', required: false, default: 'straight to the point, friendly, no sales pressure' },
  ],
  build({ settings }): Step[] {
    const day = 24 * 60;
    return [
      { type: 'wait', minutes: Math.round(num(settings, 'firstNudgeDays', 2) * day) },
      { type: 'stop_if', condition: { op: 'contact_replied' }, reason: 'customer answered the quote' },
      { type: 'send_sms', label: 'quote-nudge-1', body: str(settings, 'firstMessage', NUDGE) },

      { type: 'wait', minutes: Math.round(num(settings, 'secondNudgeDays', 4) * day) },
      { type: 'stop_if', condition: { op: 'contact_replied' }, reason: 'customer answered the quote' },
      // The middle touch is the one that has to feel personal, so it is the
      // only one we let the model write — against this specific quote.
      {
        type: 'ai_draft',
        key: 'nudge2',
        maxWords: 45,
        prompt:
          'Write a short text message from {{business.owner}} at {{business.name}} to {{contact.firstName}}, ' +
          'following up on a quote for {{data.jobDescription}} worth {{data.quoteAmount}} sent a few days ago. ' +
          'They have not replied. Offer to adjust the scope or answer questions. ' +
          'Tone: {{settings.tone}}. Do not invent details you were not given.',
      },
      { type: 'send_sms', label: 'quote-nudge-2', body: '{{drafts.nudge2}}' },

      { type: 'wait', minutes: Math.round(num(settings, 'finalNudgeDays', 7) * day) },
      { type: 'stop_if', condition: { op: 'contact_replied' }, reason: 'customer answered the quote' },
      { type: 'send_sms', label: 'quote-final', body: str(settings, 'finalMessage', FINAL) },
      {
        type: 'notify_owner',
        body: 'Quote for {{contact.name}} ({{data.quoteAmount}}) went unanswered after three follow-ups.',
      },
    ];
  },
};
