/**
 * Shared content: a Reel, a post, a story mention, a sticker or a like,
 * sent with no words.
 *
 * Founder, 2026-10-11, after a Reel with no words landed on his Today as
 * "Instagram DM": "if someone sends a reel, a post, or a sticker with no
 * question, and neither does it say it's interesting nor does it sound like
 * a lead, why should we pick it up? ... We'll be picking up only those who
 * are actually customers or leads, or who are planning to buy, or who have
 * a query about the business."
 *
 * So someone new who sends only this is not picked up at all
 * (src/lib/inbound/meta.ts). From an existing customer it stays in their
 * conversation, where it is context, but it is not a message that needs an
 * answer, so it never puts them on Today (src/lib/automation.ts).
 *
 * A photo, video, voice note or file the person sent themselves is not on
 * this list: that can be the question itself (a photo of the listing, the
 * leak, the damage).
 */
const SHARED_TYPES = new Set(["share", "ig_reel", "reel", "ig_post", "story_mention", "animated_image", "sticker", "like_heart"]);

/** Meta's attachment `type`, as sent on an Instagram or Messenger DM. */
export function isSharedContentType(type: string): boolean {
  return SHARED_TYPES.has(type);
}

/**
 * For a stored message body: true for "[Sent ig_reel with no message text]"
 * and "[Sent 2 share/ig_reel attachments with no message text]", the bodies
 * messageContent() in src/lib/inbound/meta.ts writes for these.
 */
export function isSharedContentOnly(body: string | null | undefined): boolean {
  const m = /^\[Sent (?:\d+ )?(.+?)(?: attachments)? with no message text\]$/.exec((body ?? "").trim());
  if (!m) return false;
  return m[1].split("/").every((t) => SHARED_TYPES.has(t.trim()));
}
