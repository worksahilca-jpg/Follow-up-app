/**
 * Reply buttons ("quick replies") on Instagram and Messenger DMs — the
 * chips under a message that a lead taps instead of typing.
 *
 * Leaf module on purpose: no imports, so a client component or a test can
 * read the limits and decode a payload without pulling in Prisma.
 *
 * Why they exist here at all: on Meta's channels a business can only
 * message a lead for 24 hours after the lead's last message, and a tap
 * counts as the lead's message (research/integrations/2026-09-16-meta-
 * human-agent-and-quick-replies-api-facts.md §A4–A5, grade B/C — verify
 * live before any copy promises it). So every automated DM ends in a
 * question a person can answer in one word, with the answers offered as
 * chips. The chips' job is a *reaction*, never a trick: see
 * research/product/2026-09-16-instagram-getting-a-reply-buttons-and-
 * questions.md §5 for the line between the two, and design-brain
 * design-decisions.md (2026-09-16, DM-only strategy).
 *
 * Meta's limits (same file, §A3): up to 13 chips, titles 20 characters
 * (Instagram truncates silently, Messenger may reject), payloads 1000
 * characters, `content_type: "text"` only. FollowUp's own ceiling is far
 * lower — three chips — because volume is the spam signal and a third
 * "yes" is never needed.
 */

export const QUICK_REPLY_MAX_COUNT = 13;
export const QUICK_REPLY_TITLE_MAX_CHARS = 20;
export const QUICK_REPLY_PAYLOAD_MAX_CHARS = 1000;

/** How many chips FollowUp itself will ever put under one message. */
export const DM_MAX_BUTTONS = 3;

/** What actually goes on the wire, one per chip. */
export interface QuickReply {
  title: string;
  payload: string;
}

/**
 * A button as the drafter produces it and as it is stored on
 * Lead.suggestedQuickReplies: the words, and whether tapping it means "no,
 * leave me" — the one answer that stops every further automatic message.
 */
export interface DmButton {
  title: string;
  exit: boolean;
}

/** The drafted button set for one message, keyed by the question it answers. */
export interface StoredQuickReplies {
  question: string;
  buttons: DmButton[];
}

/**
 * What a tap tells FollowUp when it comes back on the webhook. `touch` is
 * which automatic message carried the chip (the same vocabulary as
 * FollowUp.trigger), `question` is the situation the drafter was asked to
 * write for, `answer` is the tapped title reduced to a key, and `exit`
 * marks the honest-no chip. Encoded into the payload so a tap on a chip
 * from an *earlier* message is still recorded as an answer to that
 * question, not the latest one (chip hygiene, buttons research §4).
 */
export interface QuickReplyAnswer {
  touch: string;
  question: string;
  answer: string;
  exit: boolean;
}

const PAYLOAD_PREFIX = "fu1";
const FIELD_SEP = ";";

function safeField(value: string): string {
  // Payload fields are read back by splitting on FIELD_SEP, so the
  // separator can never appear inside one. Everything else is left as
  // typed — a title in Gujarati or Punjabi stays readable in the audit
  // trail — but capped so the whole payload sits well inside Meta's limit.
  return value.replace(/;/g, ",").slice(0, 120);
}

/** Reduces a chip title to a stable, language-neutral answer key ("Sat 10am" → "sat_10am"). */
export function answerKey(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
}

export function encodeQuickReplyPayload(answer: QuickReplyAnswer): string {
  return [PAYLOAD_PREFIX, safeField(answer.touch), safeField(answer.question), safeField(answer.answer), answer.exit ? "x" : "a"].join(FIELD_SEP);
}

/**
 * Null for anything FollowUp didn't write — a chip some other tool put
 * under a message, or a payload from a future format. Never throws: this
 * runs on webhook input.
 */
export function decodeQuickReplyPayload(payload: string | null | undefined): QuickReplyAnswer | null {
  if (typeof payload !== "string") return null;
  const parts = payload.split(FIELD_SEP);
  if (parts.length !== 5 || parts[0] !== PAYLOAD_PREFIX) return null;
  const [, touch, question, answer, flag] = parts;
  if (!touch || !question || (flag !== "x" && flag !== "a")) return null;
  return { touch, question, answer, exit: flag === "x" };
}

export function isExitPayload(payload: string | null | undefined): boolean {
  return decodeQuickReplyPayload(payload)?.exit === true;
}

/**
 * Turns a stored button set into wire-ready chips for one send. `touch` is
 * the trigger the send goes out under, so the same drafted set carries a
 * different payload on the 3-hour follow-up than it would on the last one.
 */
export function toQuickReplies(stored: StoredQuickReplies, touch: string): QuickReply[] {
  return stored.buttons.slice(0, DM_MAX_BUTTONS).map((b) => ({
    title: b.title.trim().slice(0, QUICK_REPLY_TITLE_MAX_CHARS),
    payload: encodeQuickReplyPayload({ touch, question: stored.question, answer: answerKey(b.title), exit: b.exit }),
  }));
}

/**
 * The boundary check both senders run before a request leaves. Meta's
 * limits, enforced here so a violation is a plain refusal with a reason
 * rather than a 400 whose prose has to be read back from the Graph API.
 */
export function validateQuickReplies(
  list: QuickReply[] | undefined
): { ok: true; quickReplies: QuickReply[] | undefined } | { ok: false; reason: string } {
  if (!list || list.length === 0) return { ok: true, quickReplies: undefined };
  if (list.length > QUICK_REPLY_MAX_COUNT) return { ok: false, reason: `Meta allows at most ${QUICK_REPLY_MAX_COUNT} reply buttons.` };
  const seen = new Set<string>();
  for (const qr of list) {
    const title = qr.title?.trim() ?? "";
    if (!title) return { ok: false, reason: "A reply button has no title." };
    if (title.length > QUICK_REPLY_TITLE_MAX_CHARS) return { ok: false, reason: `Reply button "${title}" is longer than ${QUICK_REPLY_TITLE_MAX_CHARS} characters.` };
    if (!qr.payload || qr.payload.length > QUICK_REPLY_PAYLOAD_MAX_CHARS) return { ok: false, reason: "A reply button's payload is missing or too long." };
    const key = title.toLowerCase();
    if (seen.has(key)) return { ok: false, reason: `Two reply buttons say "${title}".` };
    seen.add(key);
  }
  return { ok: true, quickReplies: list.map((qr) => ({ title: qr.title.trim(), payload: qr.payload })) };
}

/** The exact JSON Meta expects inside `message` — see api-facts §A2/§C. */
export function quickRepliesForGraph(list: QuickReply[]): Array<{ content_type: "text"; title: string; payload: string }> {
  return list.map((qr) => ({ content_type: "text", title: qr.title, payload: qr.payload }));
}
