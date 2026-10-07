/**
 * "Teach FollowUp your business" (A-100, founder 2026-10-07: "asking questions
 * about the business, and FollowUp will learn from their replies"). A few of
 * the things customers in this trade ask most, one per screen, every one
 * skippable. Each answer is saved as a fact the owner typed (Settings → What
 * FollowUp knows), so drafts can use it word for word.
 *
 * Deliberately short: about seven, not twenty. Whatever is skipped, or never
 * asked here, is asked on Today the first time a real customer asks it
 * ("[ANSWER: parking]", src/lib/priceSlot.ts).
 *
 * `label` is the fact's name; a question whose label the business already
 * has is not asked again.
 */
import { labelKey } from "@/lib/factLines";

export type TeachQuestion = { label: string; question: string; example: string };

const REAL_ESTATE: TeachQuestion[] = [
  { label: "Commission", question: "What commission do you charge?", example: "e.g. 2.5% of the sale price, which covers photos, the listing and every showing" },
  { label: "Area you cover", question: "Which areas do you cover?", example: "e.g. Toronto and Mississauga" },
  { label: "Showings", question: "When can people see a property?", example: "e.g. Weekdays 10 am to 7 pm, weekends by appointment" },
  { label: "How to book a viewing", question: "How should someone book a viewing?", example: "e.g. Reply with two times that work for you" },
  { label: "Home evaluation", question: "Do you offer a home evaluation, and what does it cost?", example: "e.g. Free, no obligation" },
  { label: "Who you work with", question: "Do you work with buyers, sellers or both?", example: "e.g. Both, including first-time buyers" },
  { label: "Languages", question: "Which languages do you work in?", example: "e.g. English, Punjabi and Hindi" },
];

const HOME_SERVICES: TeachQuestion[] = [
  { label: "Quotes", question: "How do you give a quote, and is it free?", example: "e.g. Free quote after a 20-minute visit" },
  { label: "Area you cover", question: "Which areas do you cover?", example: "e.g. Brampton, Mississauga and Oakville" },
  { label: "Hours", question: "When do you work?", example: "e.g. Monday to Saturday, 8 am to 6 pm" },
  { label: "How soon you can start", question: "How soon can you usually start a job?", example: "e.g. Within one to two weeks" },
  { label: "Payment", question: "How do customers pay?", example: "e.g. 30% deposit, the rest when the job is done. E-transfer or card" },
  { label: "Warranty", question: "Do you guarantee your work?", example: "e.g. One-year warranty on labour" },
  { label: "Insurance", question: "Are you licensed and insured?", example: "e.g. Fully insured, WSIB covered" },
];

const MORTGAGE: TeachQuestion[] = [
  { label: "Fees", question: "Do you charge borrowers a fee?", example: "e.g. No fee for most residential mortgages" },
  { label: "Area you cover", question: "Where can you help people?", example: "e.g. Anywhere in Ontario" },
  { label: "What to bring", question: "What should someone have ready for a first call?", example: "e.g. Two recent pay stubs and your last tax return" },
  { label: "How to book a call", question: "How should someone book a call?", example: "e.g. Reply with a time that suits you" },
  { label: "Hours", question: "When are you available?", example: "e.g. Weekdays 9 am to 7 pm, Saturdays by appointment" },
  { label: "Languages", question: "Which languages do you work in?", example: "e.g. English and Punjabi" },
];

const CLINIC: TeachQuestion[] = [
  { label: "Hours", question: "What are your opening hours?", example: "e.g. Monday to Friday 9 am to 6 pm, Saturday 9 am to 2 pm" },
  { label: "New patients", question: "Are you taking new patients?", example: "e.g. Yes, usually within two weeks" },
  { label: "How to book", question: "How should someone book an appointment?", example: "e.g. Call 905-555-0100 or reply with a time" },
  { label: "Insurance", question: "Do you bill insurance directly?", example: "e.g. Yes, for most major plans" },
  { label: "Location and parking", question: "Where are you, and is there parking?", example: "e.g. 120 Main St, free parking behind the building" },
  { label: "Languages", question: "Which languages does your team speak?", example: "e.g. English, Hindi and Tamil" },
];

const GENERAL: TeachQuestion[] = [
  { label: "Prices", question: "How do you price your work?", example: "e.g. From $150, with a free quote first" },
  { label: "Area you cover", question: "Where do you work, or where are you?", example: "e.g. The Greater Toronto Area" },
  { label: "Hours", question: "When are you open or available?", example: "e.g. Weekdays 9 am to 6 pm" },
  { label: "How to book", question: "How should a new customer get started?", example: "e.g. Reply with a time for a 15-minute call" },
  { label: "Payment", question: "How do customers pay?", example: "e.g. E-transfer or card, half up front" },
  { label: "Languages", question: "Which languages do you work in?", example: "e.g. English and French" },
];

const BY_TRADE: Record<string, TeachQuestion[]> = {
  "Real estate": REAL_ESTATE,
  "Home services (contractor, cleaning, etc.)": HOME_SERVICES,
  "Mortgage brokerage": MORTGAGE,
  "Dental / medical clinic": CLINIC,
};

/** The questions for this trade, leaving out anything the business already has a fact for. */
export function teachQuestions(trade: string | null | undefined, labelsKnown: Iterable<string> = []): TeachQuestion[] {
  const known = new Set([...labelsKnown].map(labelKey));
  // "Real estate" as setup saves it; older rows may say "real_estate".
  const norm = (t: string) => t.trim().toLowerCase().replace(/_/g, " ");
  const key = trade ? Object.keys(BY_TRADE).find((k) => norm(k) === norm(trade)) : undefined;
  const set = (key && BY_TRADE[key]) || GENERAL;
  return set.filter((q) => !known.has(labelKey(q.label)));
}
