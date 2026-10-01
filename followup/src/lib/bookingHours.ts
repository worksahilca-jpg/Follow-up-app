/**
 * When a customer can book a call — the days, the hours and the time zone
 * behind a business's booking link (A-078, founder 2026-10-01).
 *
 * No server imports on purpose: the Settings card ("use client") renders
 * the same days, time labels and summary sentence the engine
 * (src/lib/booking.ts) uses to offer slots, so the two cannot disagree
 * about what "Mon–Sat, 9:00 am–7:00 pm" means.
 *
 * Days are JS weekday numbers (0 = Sunday) so they line up with Date and
 * Intl without a lookup table of their own. Hours are minutes from
 * midnight on a 30-minute grid, the same grid the slots are on.
 */

export const SLOT_MINUTES = 30;

/** Mon–Sat 9am–7pm. Founder's default for everyone, 2026-10-01. */
export const DEFAULT_BOOKING_HOURS: BookingHours = {
  days: [1, 2, 3, 4, 5, 6],
  startMinute: 9 * 60,
  endMinute: 19 * 60,
};

export type BookingHours = {
  /** Sorted, unique JS weekday numbers, 0 = Sunday. Never empty. */
  days: number[];
  /** Minutes from midnight, on the 30-minute grid. */
  startMinute: number;
  /** Minutes from midnight, exclusive, on the 30-minute grid; always after startMinute. */
  endMinute: number;
};

/** Short labels in Monday-first order, which is how a week reads to an owner; the value is the JS weekday. */
export const WEEKDAYS: readonly { value: number; label: string }[] = [
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
  { value: 0, label: "Sun" },
];

/** The time zones offered in Settings. Canada first (where the first customers are), then the US. */
export const TIME_ZONES: readonly { value: string; label: string }[] = [
  { value: "America/St_Johns", label: "St. John's (Newfoundland)" },
  { value: "America/Halifax", label: "Halifax (Atlantic)" },
  { value: "America/Toronto", label: "Toronto (Eastern)" },
  { value: "America/Winnipeg", label: "Winnipeg (Central)" },
  { value: "America/Regina", label: "Regina (Central, no DST)" },
  { value: "America/Edmonton", label: "Edmonton / Calgary (Mountain)" },
  { value: "America/Vancouver", label: "Vancouver (Pacific)" },
  { value: "America/New_York", label: "New York (Eastern)" },
  { value: "America/Chicago", label: "Chicago (Central)" },
  { value: "America/Denver", label: "Denver (Mountain)" },
  { value: "America/Phoenix", label: "Phoenix (Mountain, no DST)" },
  { value: "America/Los_Angeles", label: "Los Angeles (Pacific)" },
  { value: "America/Anchorage", label: "Anchorage (Alaska)" },
  { value: "Pacific/Honolulu", label: "Honolulu (Hawaii)" },
];

/** True when Intl knows this IANA name — the only check that matters, since Intl is what reads it. */
export function isValidTimeZone(name: string): boolean {
  if (typeof name !== "string" || name.length === 0 || name.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: name });
    return true;
  } catch {
    return false;
  }
}

/** Every half hour from midnight to midnight as a select option: "9:00 am", "7:30 pm", ..., "12:00 am" (end of day). */
export function timeOptions(): { value: number; label: string }[] {
  const out: { value: number; label: string }[] = [];
  for (let m = 0; m <= 24 * 60; m += SLOT_MINUTES) out.push({ value: m, label: formatMinute(m) });
  return out;
}

/** "9:00 am", "12:00 pm", "7:30 pm"; 1440 reads as "12:00 am" (the end of the day). */
export function formatMinute(minute: number): string {
  const m = ((minute % (24 * 60)) + 24 * 60) % (24 * 60);
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h24 < 12 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

/**
 * The days as an owner would say them: "Mon–Fri", "Mon–Sat", "Mon, Wed, Fri",
 * "Every day". Runs of consecutive days (Monday-first) collapse to a range.
 */
export function describeDays(days: number[]): string {
  const order = WEEKDAYS.map((d) => d.value);
  const set = new Set(days);
  if (order.every((v) => set.has(v))) return "Every day";
  const labels = WEEKDAYS.map((d) => d.label);
  const parts: string[] = [];
  let i = 0;
  while (i < order.length) {
    if (!set.has(order[i])) {
      i += 1;
      continue;
    }
    let j = i;
    while (j + 1 < order.length && set.has(order[j + 1])) j += 1;
    parts.push(j - i >= 2 ? `${labels[i]}–${labels[j]}` : j === i ? labels[i] : `${labels[i]}, ${labels[j]}`);
    i = j + 1;
  }
  return parts.join(", ");
}

/** "Mon–Sat, 9:00 am–7:00 pm" — the summary line under the Settings card. */
export function describeBookingHours(hours: BookingHours): string {
  return `${describeDays(hours.days)}, ${formatMinute(hours.startMinute)}–${formatMinute(hours.endMinute)}`;
}

/** The time zone's label from the list, or the raw IANA name for one the list doesn't carry. */
export function describeTimeZone(name: string): string {
  return TIME_ZONES.find((z) => z.value === name)?.label ?? name;
}

/**
 * Why a set of hours can't be saved, in the owner's words, or null when it
 * can. Shared by the Settings card (before it saves) and the API route
 * (before it writes), so both refuse the same things.
 */
export function bookingHoursProblem(hours: { days: number[]; startMinute: number; endMinute: number }): string | null {
  if (!Array.isArray(hours.days) || hours.days.length === 0) return "Pick at least one day.";
  if (hours.days.some((d) => !Number.isInteger(d) || d < 0 || d > 6)) return "That isn't a day of the week.";
  if (new Set(hours.days).size !== hours.days.length) return "A day is listed twice.";
  for (const m of [hours.startMinute, hours.endMinute]) {
    if (!Number.isInteger(m) || m < 0 || m > 24 * 60 || m % SLOT_MINUTES !== 0) return "Times have to be on the half hour.";
  }
  if (hours.endMinute <= hours.startMinute) return "The end time has to be after the start time.";
  return null;
}

/** Sorted, de-duplicated copy — what gets stored and what the engine reads. */
export function normalizeBookingHours(hours: BookingHours): BookingHours {
  return {
    days: Array.from(new Set(hours.days)).sort((a, b) => a - b),
    startMinute: hours.startMinute,
    endMinute: hours.endMinute,
  };
}

/** A Business row's booking columns as one object, with the default for anything missing or broken. */
export function bookingHoursOf(business: { bookingDays?: number[] | null; bookingStartMinute?: number | null; bookingEndMinute?: number | null }): BookingHours {
  const candidate = {
    days: business.bookingDays ?? DEFAULT_BOOKING_HOURS.days,
    startMinute: business.bookingStartMinute ?? DEFAULT_BOOKING_HOURS.startMinute,
    endMinute: business.bookingEndMinute ?? DEFAULT_BOOKING_HOURS.endMinute,
  };
  return bookingHoursProblem(candidate) ? DEFAULT_BOOKING_HOURS : normalizeBookingHours(candidate);
}
