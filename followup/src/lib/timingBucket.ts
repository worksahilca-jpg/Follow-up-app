/**
 * "When" for a realtor's customer, worked out from the date they named rather than taken from the reader's guess.
 *
 * The accuracy test, 2026-10-17: on October 1, "June 2027" and "By September 2027" came back as "months" (3 to 6
 * months away) when both are eight months or more away, and "In about 2 months" came back as "months" too. The
 * prompt already lists the dates to compare against (src/lib/integrations/openai.ts); the reader still miscounts.
 * So when the words name one month, or a number of days, weeks or months from now, the bucket is counted here.
 * Anything else (a season, "next year", "as soon as possible", two different months) is left to the reader.
 *
 * The buckets are the timing criterion's (src/lib/qualification.ts): "soon" is on or before 3 months from today,
 * "months" on or before 6, "later" after that.
 */

export type TimingBucket = "soon" | "months" | "later";

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"] as const;

const NUMBER_WORDS: Readonly<Record<string, number>> = {
  a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
  "a couple of": 2, "a couple": 2,
};

// "in about 2 months", "within six weeks", "in a couple of months". A range ("in 2 to 3 months") is left alone.
const RELATIVE_RE =
  /\b(?:in|within)\s+(?:about\s+|around\s+|roughly\s+|approximately\s+|~\s*)?(\d{1,2}|a couple of|a couple|an?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(day|week|month|year)s?\b(?!\s*(?:to|or|-)\s*\d)/i;
const RANGE_RE = /\b\d{1,2}\s*(?:to|-|or)\s*\d{1,2}\s*(?:day|week|month|year)s?\b/i;

// A month by name, with an optional year after it. "May" only counts with a year, or after a word that makes it a
// date ("in May", "by May"): "we may buy" is not a month.
const MONTH_RE =
  /\b(next\s+)?(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?(?:\s+\d{1,2}(?:st|nd|rd|th)?)?,?(?:\s+(20\d\d))?/gi;
const MAY_AS_DATE_RE = /\b(in|by|before|until|till|end of|early|late|mid|this|next|of)\s+may\b|\bmay\s+(20\d\d|\d{1,2}(st|nd|rd|th)?\b)/i;

function addMonths(d: Date, n: number): Date {
  const out = new Date(d);
  out.setUTCMonth(out.getUTCMonth() + n);
  return out;
}

function bucketFor(when: Date, today: Date): TimingBucket {
  if (when <= addMonths(today, 3)) return "soon";
  if (when <= addMonths(today, 6)) return "months";
  return "later";
}

/** The date the words point to, or null when they name no single month or span. */
export function timingDateFromWords(text: string, today: Date): Date | null {
  if (!text || RANGE_RE.test(text)) return null;
  const rel = RELATIVE_RE.exec(text);
  if (rel) {
    const raw = rel[1].toLowerCase();
    const n = /^\d+$/.test(raw) ? Number(raw) : NUMBER_WORDS[raw];
    if (!n) return null;
    const unit = rel[2].toLowerCase();
    if (unit === "day") return new Date(today.getTime() + n * 86_400_000);
    if (unit === "week") return new Date(today.getTime() + n * 7 * 86_400_000);
    if (unit === "month") return addMonths(today, n);
    return addMonths(today, n * 12);
  }
  const found: { month: number; year: number | null; next: boolean }[] = [];
  for (const m of text.matchAll(MONTH_RE)) {
    const name = m[2].toLowerCase();
    if (name === "may" && !MAY_AS_DATE_RE.test(text)) continue;
    found.push({ month: MONTHS.indexOf(name.slice(0, 3) as (typeof MONTHS)[number]), year: m[3] ? Number(m[3]) : null, next: !!m[1] });
  }
  const months = new Set(found.map((f) => `${f.month}:${f.year ?? ""}`));
  if (found.length === 0 || months.size !== 1) return null;
  const { month, year, next } = found[0];
  const thisYear = today.getUTCFullYear();
  const thisMonth = today.getUTCMonth();
  let y: number;
  if (year) y = year;
  else if (next) {
    // "next June" in October is next year's June; "next November" in October could be either, so it is left alone.
    if (month > thisMonth) return null;
    y = thisYear + 1;
  } else y = month >= thisMonth ? thisYear : thisYear + 1;
  return new Date(Date.UTC(y, month, 1));
}

/** The timing bucket the customer's own words decide, or null when they don't decide it. */
export function timingBucketFromWords(text: string, today: Date): TimingBucket | null {
  const when = timingDateFromWords(text, today);
  return when ? bucketFor(when, today) : null;
}
