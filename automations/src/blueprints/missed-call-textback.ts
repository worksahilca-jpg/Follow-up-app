import type { Blueprint, Step } from '../types.js';
import { bool, num, str } from '../engine/settings.js';

const DEFAULT_FIRST =
  "Hi {{contact.firstName}}, sorry we missed your call — this is {{business.owner}} at {{business.name}}. " +
  'What can we help you with? Reply here and I’ll get right back to you.';

const DEFAULT_SECOND =
  'Hi {{contact.firstName}}, still happy to help if you need us. ' +
  'Just reply here and {{business.name}} will take care of it.';

/**
 * The one every trades business buys first: a missed call becomes a text
 * within seconds, before the caller dials the next number on the list.
 */
export const missedCallTextBack: Blueprint = {
  id: 'missed-call-textback',
  name: 'Missed call → instant text back',
  promise:
    'Every missed call gets a text within seconds, so the caller stops dialling your competitors.',
  trigger: 'call.missed',
  settings: [
    {
      key: 'firstMessage',
      label: 'First text',
      ask: 'What should the caller get back within seconds of the missed call?',
      required: false,
      default: DEFAULT_FIRST,
    },
    {
      key: 'followUpHours',
      label: 'Second text delay (hours)',
      ask: 'If they never reply, how long until we nudge once more?',
      required: false,
      default: 4,
    },
    {
      key: 'secondMessage',
      label: 'Second text',
      ask: 'What should the nudge say?',
      required: false,
      default: DEFAULT_SECOND,
    },
    {
      key: 'notifyOwner',
      label: 'Alert the owner',
      ask: 'Do you want a text when a caller still has not been reached?',
      required: false,
      default: true,
    },
  ],
  build({ settings }): Step[] {
    const steps: Step[] = [
      { type: 'send_sms', label: 'instant-textback', body: str(settings, 'firstMessage', DEFAULT_FIRST) },
      { type: 'wait', minutes: Math.round(num(settings, 'followUpHours', 4) * 60) },
      { type: 'stop_if', condition: { op: 'contact_replied' }, reason: 'caller replied' },
      { type: 'send_sms', label: 'nudge', body: str(settings, 'secondMessage', DEFAULT_SECOND) },
    ];

    if (bool(settings, 'notifyOwner', true)) {
      steps.push(
        { type: 'wait', minutes: 60 },
        { type: 'stop_if', condition: { op: 'contact_replied' }, reason: 'caller replied' },
        {
          type: 'notify_owner',
          body:
            '{{contact.name}} ({{contact.phone}}) called {{business.name}} and has not been reached. ' +
            'Two texts sent, no reply — worth a call.',
        },
      );
    }
    return steps;
  },
};
