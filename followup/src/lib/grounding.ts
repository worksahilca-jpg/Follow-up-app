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

/**
 * A number token: a run of digits, optionally continuing through internal
 * thousands-separator commas or a decimal point. Unicode-aware, so a
 * Devanagari or Arabic-Indic numeral counts as a digit too.
 *
 * Whole tokens, never substrings — "$2,000" is one token, not "2" and
 * "000". A plain `source.includes(run)` lets a fabricated "2 days" ground
 * itself against a lead-quoted "$2,000", since "2,000" contains "2".
 */
const NUMBER_RE = /\p{Nd}(?:[\p{Nd},.]*\p{Nd})?/gu;

/**
 * A currency marker with no digits attached — "a price in USD", "our
 * rates in CAD". Worth its own rule precisely because the digits rule
 * above cannot see it.
 *
 * There is deliberately no separate clock-time rule here. Every clock
 * time contains digits ("3:30", "7pm"), so the digits rule catches it
 * first and a `time` branch would be unreachable code pretending to be a
 * safeguard. checkAckShape (src/lib/acknowledge.ts) carries one for the
 * same historical reason; it is equally unreachable there.
 *
 * Currency WORDS too (audit 2026-09-28): "It's fifty dollars for the
 * visit" and "Son cien pesos" have no digit and no symbol, and passed.
 */
const CURRENCY_RE =
  /[$€£₹¥]|%|\b(USD|EUR|GBP|INR|CAD|MXN|AUD|Rs\.?|dollars?|bucks|euros?|pounds|quid|rupees?|rupaye|rupay|pesos?|dólares|dolares|reais|francs?|dirhams?|centavos)\b/gi;

/**
 * Every specific in `draft` that `source` never contained — the whole
 * invariant in one call, for any channel.
 *
 * This existed twice before today, inline and slightly differently, in
 * checkAckShape (src/lib/acknowledge.ts) and checkDmDraftShape
 * (src/lib/dmDrafts.ts). The email follow-up drafter — the longest, least
 * constrained message FollowUp writes, and the only one that goes to a
 * stranger's inbox rather than a DM thread — had no version of it at all.
 *
 * What that cost, on 2026-09-20, in the founder's own approval queue:
 *
 *     lead:      "quisiera saber si tienen disponibilidad para una
 *                 consulta la semana que viene y cuál sería el costo"
 *     FollowUp:  "Podemos confirmar que tenemos disponibilidad...
 *                 **El costo será de $100**, ¿te parece bien?"
 *
 * He asked what it costs. FollowUp made up a price and quoted it in the
 * owner's name. Three other drafts in the same queue invented a sent
 * email, a prior discussion, and a confirmation — those are assertions,
 * which belong to the risk gate and the prompt. This one is arithmetic,
 * and arithmetic is checkable.
 *
 * Returns the failing rule name, or null when every specific in the draft
 * can be traced to something someone actually wrote.
 */
export function ungroundedSpecifics(draft: string, source: string, locale?: string | null): string | null {
  const known = new Set(source.match(NUMBER_RE) ?? []);
  if ((draft.match(NUMBER_RE) ?? []).some((n) => !known.has(n))) return "digits";

  const lowerSource = source.toLowerCase();

  const currency = draft.match(CURRENCY_RE) ?? [];
  if (currency.some((token) => !lowerSource.includes(token.toLowerCase()))) return "currency";

  if (ungroundedCalendarWords(draft, source, locale).length > 0) return "calendar";

  return null;
}

/**
 * A draft that tells the customer something is (or isn't) available, when
 * the business itself never said so anywhere in the thread.
 *
 * On 2026-09-27, recording the Meta App Review video, the same thread got
 * two drafts in a row: "The 2 bedroom condo is still available. Would you
 * like to schedule a visit?" and "Yes, it is available. Do you want to
 * schedule it?". Nobody at the business had said anything about it. The
 * risk judge passed both as routine, so they sat in the one-tap "Send it"
 * group. Only the owner's hand edit stopped a false promise going out.
 *
 * Availability is the one fact every lead asks about and only the owner
 * knows. So the rule is simple: a sentence that states availability, either
 * way, needs the business to have raised availability first. A question
 * ("Is it still available?") states nothing, and neither does a sentence
 * that says it is being checked ("I'll check if it's still available").
 *
 * `businessText` is only what the business sent, never the lead's words:
 * the lead ASKING "is it available?" is exactly the case that must not
 * ground an answer.
 *
 * Like the calendar list above, this is a list, and only as multilingual as
 * the languages below. A failure costs one redraft, then the draft waits
 * for the owner instead of going out, so a false positive is cheap and a
 * false negative is the thing to avoid.
 */
export function unconfirmedAvailability(draft: string, businessText: string): boolean {
  return unconfirmedClaimOf(CLAIMS[0], draft, businessText);
}

/**
 * The same rule as unconfirmedAvailability, for every other kind of fact
 * only the business can state (audit 2026-09-28, "reply truth"). Each one
 * was a real or reproduced draft that passed every deterministic guard:
 *
 *   booking       "Perfect, you're booked for Saturday. See you then!"
 *   done          "I've sent you the details by email."
 *   policy        "Estimates are free, no obligation."
 *   hours         "Yes, we're open now until late."
 *
 * None contains a digit, and the day in the first one is the LEAD's own
 * word (they tapped "Saturday"), so the calendar rule grounds it. What is
 * invented is the assertion, and an assertion of these kinds is the
 * owner's to make. Same shape as availability: a sentence that is a
 * question, or that says it is being found out, states nothing; a
 * statement of the kind needs the business to have made one first.
 *
 * `businessText` must be what a PERSON at the business sent (businessText
 * in src/lib/dmDrafts.ts), never FollowUp's own automated sends — or one
 * invented claim that got out grounds every later one.
 *
 * Lists, like the availability words: English, Spanish, French and
 * Portuguese, and only as multilingual as that. A false positive costs one
 * redraft and then a draft that waits for the owner.
 */
export type ClaimKind = "availability" | "booking" | "done" | "policy" | "hours" | "service";

export function unconfirmedClaim(
  draft: string,
  businessText: string,
  // A real message has already gone to this customer (anything but the
  // instant acknowledgement). "The email I sent last week" is then simply
  // true, and a follow-up says it all the time; only claiming to have SENT
  // something is grounded by it, never a call, a booking or an attachment.
  opts: { sentBefore?: boolean } = {}
): ClaimKind | null {
  for (const claim of CLAIMS) {
    const text = claim.kind === "done" && opts.sentBefore ? draft.replace(MESSAGE_SENT_RE, "") : draft;
    if (unconfirmedClaimOf(claim, text, businessText)) return claim.kind;
  }
  return null;
}

// "I sent", "I emailed", "I reached out", in the four languages the claim
// lists cover. Removed from a draft before the "done" check once a real
// message has gone out, so what is left is judged on its own.
const MESSAGE_SENT_RE =
  /\b(i'?ve|i have|we'?ve|we have|i|we) (just |already )?(sent|emailed|e-mailed|texted|messaged|mailed|wrote|written|reached out)\b|\bte (envié|mandé|escribí)\b|\bhe (enviado|mandado|escrito)\b|\bj['’]ai (envoy\p{L}*|écrit)|\bje (vous |t['’])\s?ai (envoy\p{L}*|écrit)|\b(te |lhe )?(enviei|mandei|escrevi)\b/giu;

/** `polar`: yes and no are different facts ("still available" vs "no longer available"). */
type Claim = { kind: ClaimKind; statement: RegExp; hedge: RegExp; polar?: boolean };

function unconfirmedClaimOf(claim: Claim, draft: string, businessText: string): boolean {
  // Grounded only by a business sentence that STATES it, unhedged. The
  // bare word was enough before, so "Let me check if it's still
  // available" in an earlier send grounded "It's available" forever after.
  // For a polar kind the business must have said it the same way round:
  // "Sorry, it's no longer available" does not ground "It's available".
  const said = claimStatements(claim, businessText);
  return claimStatements(claim, draft).some((s) =>
    claim.polar ? !said.some((b) => NEGATED_RE.test(b) === NEGATED_RE.test(s)) : said.length === 0
  );
}

function claimStatements(claim: Claim, text: string): string[] {
  return text
    // Sentences, and also clauses joined by a dash or semicolon: "We do
    // have availability — shall I send the details?" ends in a question
    // mark but still states availability in its first half.
    .split(/(?<=[.!?¡¿？。\n;])|\s[—–]\s/u)
    .map((s) => s.trim())
    .filter(Boolean)
    // A question states nothing — except in the clauses before it: "Yes,
    // it's still available, want to book a viewing?" is one sentence that
    // ends in a question mark, and the DM shape (one sentence, one
    // question, last) invites exactly that. Only the final clause of a
    // question is the question.
    .flatMap((sentence) => (/[?？؟]\s*$/u.test(sentence) ? sentence.split(/,\s+/u).slice(0, -1) : [sentence]))
    .filter((sentence) => {
      if (!claim.statement.test(sentence)) return false;
      return !claim.hedge.test(sentence);
    });
}

const NEGATED_RE =
  /\b(no longer|not|isn'?t|aren'?t|wasn'?t|don'?t|doesn'?t|never|sold|rented|leased|taken|closed|out of stock|ya no|no (est|hay|tenemos|queda)|agotad|vendid|cerrad|plus|pas|não|fechad|esgotad)\b/iu;

// Words that turn a sentence into "I'm finding out" rather than "it is".
const AVAILABILITY_HEDGE_RE =
  /\b(check|checking|confirm|confirming|see if|see whether|find out|look into|looking into|let (me|you) know|get back|whether|if (it|the|this|that|there|we|they)|verif|revis|comprob|confirmar|averigu|ver si|si (est|sigue|hay|tenemos)|vérifi|vou verificar|se (est|ainda))/iu;

// The same idea for the other kinds, plus "details"/"info": "I'll send you
// the warranty details" promises information, it does not state a policy.
// "if" only in the finding-out sense ("if it's included"): "it's fully
// refundable if you cancel" is a policy with a condition, not a hedge.
const FIND_OUT_HEDGE_RE =
  /\b(check|checking|see if|see whether|find out|look into|looking into|let (me|you) know|get back|whether|if (it|the|this|that|there|we|they|our)|details|info|information|options)\b|confirm(ing)? (if|whether|with)|(i'?ll|i will|we'?ll|we will|to|let me|going to) confirm|verif|revis|comprob|averigu|ver si|\bsi\b|detalles|informaci[oó]n|confirmar|vérifi|détails|confirmer|informations|detalhes|informações/iu;

// Booking has its own hedge because "confirmed" IS the claim: only a
// future or conditional confirm ("I'll confirm", "once it's booked") hedges.
const BOOKING_HEDGE_RE =
  /\b(hope|hoping|looking forward|love|like|glad|happy|can'?t wait) to see(ing)? you\b|\b(i'?ll|i will|we'?ll|we will|to|let me|going to|can|could|would|once|before|as soon as)\s+(\w+\s+){0,2}?(confirm|book|schedule|reserve|check)|\bif\b|\bwhether\b|\bcheck|\bsee if\b|\bfind out\b|voy a (confirmar|reservar|agendar|revisar)|vamos a|para (confirmar|reservar|agendar)|je vais|pour (confirmer|réserver)|vou (verificar|confirmar|marcar|agendar)|\bsi\b/iu;

// A past action the business supposedly took. "Not yet"/"haven't" is the
// honest version and is allowed.
const DONE_HEDGE_RE = /\b(if|whether|not yet|haven'?t|hasn'?t|didn'?t)\b|aún no|todavía no|no (he|hemos) |pas encore|ainda não/iu;

const CLAIMS: Claim[] = [
  {
    kind: "availability",
    // "available", "availability", "disponible(s)", "disponibilidad",
    // "disponibilité", "disponível", "opening(s)" in the booking sense, and
    // the words people actually use for it on a listing or a job: in
    // stock, sold, rented, still on the market, we can fit you in, libre.
    statement:
      /availab|disponib|dispon[ií]vel|\bopenings?\b|\bin stock\b|\bout of stock\b|\bsold( out)?\b|\b(been|already|is|was|got) (rented|leased|taken|booked up)\b|\bhasn'?t been (rented|leased|taken|sold)\b|\bon the market\b|\bstill (for (sale|rent|lease)|up|listed|free|there|going|open)\b|\bfit you in\b|\b(have|got) (space|room|a spot|spots|a slot|slots|an opening|capacity)\b|\bvacan|agotad|\bvendid[oa]s?\b|alquilad|rentad|\b(sigue|está|esta|todavía|todavia|aún|aun) (libre|en venta|en renta)\b|\ben stock\b|épuis|\bvendu|\blou[ée]\b|encore libre|esgotad|alugad|\b(ainda|está) (livre|à venda)|\b(only|just) (a few|one|two|a couple|a handful) (left|remaining)\b|\blast one\b|\bquedan? (pocos|pocas|unos|unas|solo)|\bsolo queda\b|\bil en reste\b|\brestam (poucos|poucas)\b/iu,
    hedge: AVAILABILITY_HEDGE_RE,
    polar: true,
  },
  {
    kind: "booking",
    statement:
      /\b(you'?re|you are|we'?re|we are|that'?s|it'?s|all) (all )?(booked|confirmed|scheduled|reserved|set|locked in|pencil+ed in)\b|\bbooked (you|it) in\b|\b(i'?ve|we'?ve|i have|we have) (booked|scheduled|reserved|confirmed)\b|\bput you (down|in)\b|\bsee you (then|there|on|at|tomorrow|today|soon|next|this|mon|tue|wed|thu|fri|sat|sun)|\bconfirmed for\b|\b(appointment|booking|visit|viewing|call) is (confirmed|set|booked|scheduled)|te esperamos|nos vemos|\b(queda|quedó|está|esta|ya est[aá]) (agendad|reservad|confirmad|apartad)|cita (confirmada|agendada)|c['’]est (noté|réservé|confirmé)|\bà (samedi|dimanche|lundi|mardi|mercredi|jeudi|vendredi|demain)\b|rendez-vous (est )?(confirmé|réservé|noté)|\b(está|fica|ficou) (agendad|marcad|confirmad|reservad)|\baté (amanhã|sábado|domingo|segunda|terça|quarta|quinta|sexta)/iu,
    hedge: BOOKING_HEDGE_RE,
  },
  {
    kind: "done",
    statement:
      /\b(i'?ve|i have|we'?ve|we have|i|we) (just |already )?(sent|emailed|e-mailed|texted|messaged|attached|forwarded|shared|booked|scheduled|reserved|called|phoned|rang|spoke|talked|arranged|mailed|passed (this|it|your)|left you)\b|\b(i'?ve|we'?ve) (spoken|talked|been in touch)\b|\b(attached|enclosed) (is|are|you'?ll find)\b|\bplease find (attached|enclosed)\b|\bas (we )?(discussed|agreed|promised)\b|\bfollowing (our|your) (call|conversation|chat|visit)\b|\bya te (\p{L}+ )?(envi|mand|pas|compart|reserv|agend|llam)|\bte (envié|mandé|compartí|llamé|reservé|agendé|escribí)\b|\bhe (enviado|mandado|reservado|agendado|confirmado|llamado|hablado|compartido)\b|\bte adjunto\b|\bcomo (lo )?(hablamos|acordamos|conversamos|prometí)\b|\bje (vous |t['’])?\s?ai (envoy|transmis|réserv|confirm|appel|partag)|\bj['’]ai (envoy|transmis|réserv|confirm|appel|partag|parlé)|\bnous avons (envoy|réserv|confirm|appel)|\bci-joint\b|\bcomme (convenu|promis|discuté)\b|\b(te |lhe )?(enviei|mandei|reservei|agendei|confirmei|liguei|compartilhei)\b|\bem anexo\b|\bcomo (combinado|conversamos|prometido)\b/iu,
    hedge: DONE_HEDGE_RE,
  },
  {
    kind: "policy",
    statement:
      /(?<!(feel|you'?re|you are|are you|i'?m|we'?re|if you'?re) )\bfree\b|\bno (charge|cost|obligation|fee)|\bat no (extra )?cost\b|\bcomplimentary\b|\bincluded\b|\bincludes\b|\brefund|\bmoney[- ]back\b|\breturn policy\b|\bwarrant|\bguarantee|\bdeposit\b|\bcancel+ation\b|\binsured\b|\blicensed\b|\bcertified\b|\bfinancing\b|\bdiscount|\bgratis\b|\bsin (costo|cargo|compromiso)|incluid|\bincluye|reembols|devoluci|garant|\bdep[oó]sito\b|\banticipo\b|descuento|gratuit|\bsans frais\b|\binclus\b|rembours|\bacompte\b|\bremise\b|grátis|\bsem (custo|compromisso)\b|\binclu[ií]d|devolução|desconto/iu,
    hedge: FIND_OUT_HEDGE_RE,
  },
  {
    kind: "hours",
    statement:
      /\b(we'?re|we are|i'?m|i am|shop is|office is|store is|still) (open|closed)\b(?!\s+to\b)|\bopen (now|today|tonight|until|till|til|late|24|all day|every day|daily|on (week|mon|tue|wed|thu|fri|sat|sun))|\bclosed (on|today|tomorrow|for)\b|\b24\/7\b|\bround the clock\b|\b(estamos|está|esta|seguimos) (abiert|cerrad)|\babiert[oa]s? (hoy|ahora|hasta|los|todos)|\b(nous sommes|on est|c['’]est) (ouvert|fermé)|\bouverts? (aujourd|jusqu|le |tous)|\b(estamos|está) (abert|fechad)|\baberto (hoje|até|aos|todos)/iu,
    hedge: FIND_OUT_HEDGE_RE,
    polar: true,
  },
  {
    // What the business does, covers or accepts: "yes, we cover Brampton",
    // "we offer financing", "we take e-transfer". The first-reply judge
    // lists this ("that the business does or doesn't offer, cover, or
    // serve something"); the follow-up judge never did.
    kind: "service",
    statement:
      /\bwe (do |also |definitely )?(cover|serve|service|come out to|travel to|deliver|ship|work in|offer|provide|accept|take (cash|cards?|credit|debit|e-?transfers?|payments?))\b|\b(cubrimos|atendemos|llegamos a|enviamos a|ofrecemos|aceptamos|trabajamos en)\b|\bnous (couvrons|desservons|livrons|offrons|proposons|acceptons|intervenons)\b|\b(atendemos|cobrimos|entregamos|oferecemos|aceitamos)\b/iu,
    hedge: FIND_OUT_HEDGE_RE,
  },
];

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
    // "today" and "tomorrow" — the words a callback promise is made of
    // ("I'll call you tomorrow"), and Intl knows them in every locale:
    // "mañana", "demain", "amanhã", "ਭਲਕੇ", "આવતીકાલે" (audit 2026-09-28).
    // Not weeks: "this week or later?" is the ordinary how-soon question the
    // DM sets ask for. (Hindi "आज"/"कल" are two characters and fall to the
    // length filter below — a known gap.)
    const relative = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
    out.push(relative.format(0, "day"), relative.format(1, "day"));
  } catch {
    // An unknown or malformed locale tag. Nothing to add; the English
    // pass below still runs, and a check that throws would block a send.
    return [];
  }
  return out.map((w) => w.toLowerCase().replace(/\.$/, "")).filter((w) => w.length > 2);
}

/**
 * The part Intl cannot generate.
 *
 * `Intl` knows every weekday and month name in every locale, which is what
 * makes the rest of this file genuinely multilingual. It does not know the
 * WORD "weekend" — `Intl.Locale.getWeekInfo()` returns which day numbers
 * are the weekend, not what a speaker calls them — so this part is a list,
 * and a list is only as multilingual as whoever wrote it.
 *
 * It started English-only on 2026-09-20 and was recorded as a known seam
 * that same day: the draft that caused all of this said "weekday or
 * weekend", and the Spanish equivalent walked straight through. Since
 * FollowUp's whole language story is that customers write in Spanish,
 * Hindi, Punjabi and Gujarati, an English-only guard on the one rule
 * written for a real Spanish-speaking lead was the wrong shape.
 *
 * Grouped by language so the gaps are visible rather than buried. Every
 * entry is one this list's author is confident about — an invented
 * translation in a file whose entire subject is invented specifics would
 * be its own joke, and a wrong entry is worse than a missing one because
 * it holds drafts that were fine.
 *
 * **Still missing, knowingly:** Hindi, Punjabi and Gujarati. Speakers of
 * all three routinely write "weekend" in English even mid-sentence, so the
 * English entries below do cover the common case — but the native and
 * romanized forms are not here, and should be added by someone who speaks
 * them rather than guessed at.
 *
 * Multi-word entries work: the matcher below is whole-token containment on
 * the phrase, not a word split, so "fin de semana" matches as one unit.
 */
const UNDERIVABLE = [
  // English
  "weekday", "weekdays", "weekend", "weekends", "fortnight",
  // Spanish — the language of the leads this rule was first written for
  "fin de semana", "fines de semana", "finde", "entre semana",
  "día laborable", "dias laborables", "días laborables", "quincena",
  // French
  "week-end", "week-ends", "jour ouvrable", "jours ouvrables", "quinzaine",
  // Portuguese
  "fim de semana", "fins de semana", "dia útil", "dias úteis", "quinzena",
  // A time of day or a turnaround with no digits in it — "I'll call you in
  // an hour", "our tech can be there tonight" (audit 2026-09-28). "Soon"
  // and "shortly" are deliberately absent: they are the one timeframe the
  // drafters are allowed to give.
  "tonight", "this morning", "this afternoon", "this evening", "an hour", "half an hour", "within the hour",
  "end of day", "end of the day", "first thing",
  "esta noche", "esta tarde", "una hora", "media hora", "hoy mismo",
  "ce soir", "cet après-midi", "une heure", "une demi-heure", "dans la journée",
  "esta noite", "hoje à noite", "uma hora", "meia hora",
];

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
    ...UNDERIVABLE,
  ]);

  const lowerSource = source.toLowerCase();
  const found = new Set<string>();

  for (const word of vocabulary) {
    if (!hasWord(draft.toLowerCase(), word)) continue;
    // "You may want to bring photos" is not the month (audit 2026-09-28:
    // every draft with "may", "sat" or "march" in it failed as an invented
    // day). These count only written as a name, capitalised: "in May".
    if (ENGLISH_WORDS_THAT_ARE_ALSO_DATES.has(word) && !hasWord(draft, word[0].toUpperCase() + word.slice(1))) continue;
    if (hasWord(lowerSource, word)) continue;
    found.add(word);
  }
  return [...found];
}

const ENGLISH_WORDS_THAT_ARE_ALSO_DATES = new Set(["may", "sun", "sat", "march", "mar", "wed"]);

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
