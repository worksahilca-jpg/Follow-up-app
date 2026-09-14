import type { Blueprint, Step } from '../types.js';
import { bool, num, str } from '../engine/settings.js';

const DEFAULT_ACK =
  'Hi {{contact.firstName}}, thanks for reaching out to {{business.name}} — got your request about ' +
  '{{data.service}}. {{business.owner}} will follow up shortly. Anything urgent, just reply here.';

const DEFAULT_SECOND =
  'Hi {{contact.firstName}}, following up on your {{data.service}} request for {{business.name}}. ' +
  'Still want us to take a look?';

/**
 * A new lead is acknowledged instantly, pushed into whatever the owner already
 * runs, and chased twice if nobody picks it up. The acknowledgement is the
 * part owners underestimate — it is what stops the lead shopping around.
 */
export const leadIntakeRouter: Blueprint = {
  id: 'lead-intake-router',
  name: 'New lead → instant reply, routed, chased',
  promise:
    'Every new lead gets an instant reply, lands in your CRM, and gets chased until someone answers.',
  trigger: 'lead.created',
  settings: [
    { key: 'ackMessage', label: 'Instant reply', ask: 'What should a new lead hear back immediately?', required: false, default: DEFAULT_ACK },
    { key: 'chaseHours', label: 'Chase delay (hours)', ask: 'How long before we chase an unanswered lead?', required: false, default: 20 },
    { key: 'pushToCrm', label: 'Push to CRM', ask: 'Do you want new leads posted into your CRM or spreadsheet?', required: false, default: true },
    { key: 'notifyOwner', label: 'Alert the owner', ask: 'Do you want a text the moment a lead comes in?', required: false, default: true },
  ],
  build({ settings }): Step[] {
    const steps: Step[] = [
      { type: 'send_sms', label: 'lead-ack', body: str(settings, 'ackMessage', DEFAULT_ACK) },
    ];

    if (bool(settings, 'pushToCrm', true)) {
      steps.push({
        type: 'http_post',
        urlRef: 'crmWebhookUrl',
        label: 'crm-push',
        bodyTemplate: {
          name: '{{contact.name}}',
          phone: '{{contact.phone}}',
          email: '{{contact.email}}',
          service: '{{data.service}}',
          source: '{{data.source}}',
        },
      });
    }

    if (bool(settings, 'notifyOwner', true)) {
      steps.push({
        type: 'notify_owner',
        body: 'New lead for {{business.name}}: {{contact.name}} — {{data.service}} ({{contact.phone}}) via {{data.source}}.',
      });
    }

    steps.push(
      { type: 'wait', minutes: Math.round(num(settings, 'chaseHours', 20) * 60) },
      { type: 'stop_if', condition: { op: 'contact_replied' }, reason: 'lead replied' },
      { type: 'send_sms', label: 'lead-chase', body: str(settings, 'chaseMessage', DEFAULT_SECOND) },
    );

    return steps;
  },
};
