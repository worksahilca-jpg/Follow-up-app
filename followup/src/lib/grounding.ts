/**
 * A specific in a draft has to come from somewhere.
 *
 * This is the fifth fix in one day for "the drafter invented something",
 * and the first that is not another sentence in a prompt. The four before
 * it — a confirmed event, an adopted premise, a denial of being
 * automated, an invented qualifying question — were all the same
 * behaviour: **the drafter fills silence with specifics.** Prompts are
 * where a rule goes when there is nothing to compute. Here there is.
 *
 * Both existing shape checks already enforce exactly this invariant for
 * ONE kind of specific. checkAckShape (src/lib/acknowledge.ts) and
 * checkDmDraftShape (src/lib/dmDrafts.ts) both extract number tokens from
 * the draft and refuse any that the conversation does not contain. That
 * rule works, and it works in every language, because digits are digits
 * everywhere.
 *
 * What neither of them covers is a specific with no digits in it. The
 * message that prompted this had none:
 *
 *     lead:      "Hey is this still available?"   (twice, nothing else)
 *     FollowUp:  "Checking on the status now. Will this be for a weekday
 *                 or weekend?"
 *     lead:      "What do you mean"
 *
 * Not one digit, so both checks passed it. "Weekday or weekend" is as
 * invented as a fabricated price, and worse in one way: a wrong number
 * reads as a mistake, while a wrong *question* reads as the business
 * knowing something about the enquiry that it does not.
 *
 * ## Why Intl rather than a word list
 *
 * A hand-written list of English day names would be an English-only rule
 * in a product whose whole language story is that customers write in
 * Hindi, Punjabi, Spanish and Gujarati — and the founder has already
 * rejected exactly that shortcut once, on the WhatsApp history filter:
 * "a keyword list can only ever be as multilingual as the person who
 * wrote it remembered to be."
 *
 * Day and month names are not a word list problem; the platform already
 * knows them in every locale. `Intl.DateTimeFormat` generates them, so
 * the check is genuinely multilingual for the part that can be, and the
 * draft is checked in the LEAD's own language because that is the
 * language it was written in.
 *
 * ## What this deliberately does not cover
 *
 * "Weekday" and "weekend" themselves are not derivable from Intl, so they
 * are a short list below that starts in English and is honestly
 * incomplete. A place name, a service type or an invented event ("your
 * outdoor corporate party") is not detectable this way at all.
 *
 * That is why the prompt rules stay. This is the deterministic net under
 * them, not a replacement for them: it catches the calendar class every
 * time, in any language Intl knows, with no model call and no cost — and
 * a net with known holes still catches what falls into it.
 */

/** Weekday and month names for a locale, lowercased. */
function calendarWords(locale: string): string[] {
  const out: string[] = [];
  try {
    const day = new Intl.DateTimeFormat(locale, { weekday: "long" });
    const dayShort = new Intl.DateTimeFormat(locale, { weekday: "short" });
    // 2024-01-01 was a Monday; seven consecutive days covers the week.
    for (let i = 0; i < 7; i++) {
      const d = new Date(Date.UTC(2024, 0, 1 + i));
      out.push(day.format(d), dayShort.format(d));
    }
    const month = new Intl.DateTimeFormat(locale, { month: "long" });
    const monthShort = new Intl.DateTimeFormat(locale, { month: "short" });
    for (let m = 0; m < 12; m++) {
      const d = new Date(Date.UTC(2024, m, 15));
      out.push(month.format(d), monthShort.format(d));
    }
  } catch {
    // An unknown or malformed locale tag. Nothing to add; the English
    // pass below still runs, and a check that throws would block a send.
    return [];
  }
  return out.map((w) => w.toLowerCase().replace(/\.$/, "")).filter((w) => w.length > 2);
}

/**
 * The part Intl cannot generate. English only, and knowingly so — see the
 * header. Listed separately from the Intl words so the honest coverage
 * gap is visible in the code rather than buried in a regex.
 */
const UNDERIVABLE_EN = ["weekday", "weekdays", "weekend", "weekends", "fortnight"];

/**
 * Calendar words the draft uses that the conversation never did.
 *
 * `source` is the whole thread — every message, both directions — because
 * a day the LEAD named is grounded, and so is a day the business already
 * named earlier in the same thread.
 *
 * Matching is whole-word and case-insensitive. Substring matching would
 * ground "mar" against "market" and quietly pass an invented "March".
 */
export function ungroundedCalendarWords(draft: string, source: string, locale?: string | null): string[] {
  const vocabulary = new Set<string>([
    ...calendarWords("en"),
    ...(locale ? calendarWords(locale) : []),
    ...UNDERIVABLE_EN,
  ]);

  const lowerSource = source.toLowerCase();
  const found = new Set<string>();

  for (const word of vocabulary) {
    if (!hasWord(draft.toLowerCase(), word)) continue;
    if (hasWord(lowerSource, word)) continue;
    found.add(word);
  }
  return [...found];
}

/**
 * Whole-word containment that does not assume spaces.
 *
 * `\b` is defined on ASCII word characters, so it misfires on the scripts
 * this product actually has to handle. Checking that the characters on
 * either side are not letters or digits behaves the same way for Latin
 * text and does not silently stop working for anything else.
 */
function hasWord(haystack: string, word: string): boolean {
  let from = 0;
  for (;;) {
    const at = haystack.indexOf(word, from);
    if (at === -1) return false;
    const before = at === 0 ? "" : haystack[at - 1];
    const after = haystack[at + word.length] ?? "";
    if (!isWordChar(before) && !isWordChar(after)) return true;
    from = at + 1;
  }
}

function isWordChar(ch: string): boolean {
  return ch !== "" && /[\p{L}\p{N}]/u.test(ch);
}
