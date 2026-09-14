import type { BusinessHours } from '../types.js';

interface LocalTime {
  /** 0 = Sunday. */
  weekday: number;
  minuteOfDay: number;
}

const WEEKDAYS: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Reads the wall-clock time at the business, not on our server. */
export function localTime(at: number, timezone: string): LocalTime {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(at));

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const weekday = WEEKDAYS[get('weekday')] ?? 0;
  // Intl renders midnight as "24" in some locales/versions; normalise it.
  const hour = Number(get('hour')) % 24;
  const minute = Number(get('minute'));
  return { weekday, minuteOfDay: hour * 60 + minute };
}

export function isWithinBusinessHours(at: number, hours: BusinessHours): boolean {
  const { weekday, minuteOfDay } = localTime(at, hours.timezone);
  if (!hours.days.includes(weekday)) return false;
  return minuteOfDay >= hours.startMinute && minuteOfDay < hours.endMinute;
}

/**
 * The next moment the business is open. A message that arrives at 2am is held
 * until morning rather than dropped — the lead is still worth having, and a
 * 2am text from a plumber is how an owner ends up with a complaint instead of
 * a job.
 */
export function nextOpening(at: number, hours: BusinessHours): number {
  if (isWithinBusinessHours(at, hours)) return at;

  const MINUTE = 60_000;
  let cursor = at;
  // Step in 15-minute increments for at most 8 days. Cheap, and immune to DST
  // arithmetic bugs that a "compute the offset" approach invites.
  for (let i = 0; i < (8 * 24 * 60) / 15; i++) {
    cursor += 15 * MINUTE;
    if (isWithinBusinessHours(cursor, hours)) {
      return cursor;
    }
  }
  // A config with no open days at all: don't hold the message forever.
  return at;
}
