import type { Blueprint, Step } from '../types.js';
import { num, str } from '../engine/settings.js';

const REMINDER =
  'Reminder from {{business.name}}: {{data.appointmentLabel}} on {{data.appointmentWhen}}. ' +
  'Reply C to confirm or R if you need to move it.';

/**
 * Timed off the appointment itself rather than a fixed delay, which is why
 * the blueprint reads the event: a reminder that fires a fixed 24h after
 * booking is useless for something booked three weeks out.
 */
export const appointmentReminder: Blueprint = {
  id: 'appointment-reminder',
  name: 'Appointment booked → reminder before it',
  promise: 'Every booking gets a reminder the day before, so fewer chairs sit empty.',
  trigger: 'appointment.booked',
  settings: [
    { key: 'hoursBefore', label: 'Hours before', ask: 'How long before the appointment should the reminder go out?', required: false, default: 24 },
    { key: 'message', label: 'Reminder text', ask: 'What should the reminder say?', required: false, default: REMINDER },
  ],
  build({ settings, event }): Step[] {
    const startsAt = Number(event.data.startsAt);
    const hoursBefore = num(settings, 'hoursBefore', 24);
    if (!Number.isFinite(startsAt)) return [];

    const fireAt = startsAt - hoursBefore * 3_600_000;
    const minutes = Math.round((fireAt - event.occurredAt) / 60_000);
    // Booked inside the reminder window: send now rather than not at all.
    const wait = Math.max(0, minutes);

    return [
      { type: 'wait', minutes: wait },
      { type: 'send_sms', label: 'appointment-reminder', body: str(settings, 'message', REMINDER) },
    ];
  },
};
