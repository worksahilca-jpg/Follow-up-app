import type { Blueprint, Step } from '../types.js';
import { num, str } from '../engine/settings.js';

const FIRST =
  'Hi {{contact.firstName}}, we had you down for {{data.appointmentLabel}} today and missed you. ' +
  'Want to grab another time? {{settings.bookingUrl}}';

const SECOND =
  'Hi {{contact.firstName}}, still happy to get you rebooked with {{business.name}} whenever suits: {{settings.bookingUrl}}';

/** A no-show is a customer who already said yes once. Cheapest booking a
 *  business will ever make, and almost nobody chases them. */
export const noShowRebook: Blueprint = {
  id: 'no-show-rebook',
  name: 'No-show → rebook',
  promise: 'Every no-show gets asked to rebook the same day, instead of quietly disappearing.',
  trigger: 'appointment.no_show',
  settings: [
    { key: 'bookingUrl', label: 'Booking link', ask: 'What link should customers use to rebook themselves?', required: true },
    { key: 'secondTouchHours', label: 'Second touch (hours)', ask: 'If they do not rebook, how long until one more nudge?', required: false, default: 48 },
  ],
  build({ settings }): Step[] {
    return [
      { type: 'send_sms', label: 'noshow-rebook', body: str(settings, 'firstMessage', FIRST) },
      { type: 'wait', minutes: Math.round(num(settings, 'secondTouchHours', 48) * 60) },
      { type: 'stop_if', condition: { op: 'contact_replied' }, reason: 'customer got back to us' },
      { type: 'send_sms', label: 'noshow-rebook-2', body: str(settings, 'secondMessage', SECOND) },
    ];
  },
};
