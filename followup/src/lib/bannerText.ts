/**
 * Error banners after an OAuth round trip read their sentence from the URL (?message=),
 * because the server that wrote it has already redirected. That also lets anyone send a
 * link that puts their own words on FollowUp's domain ("Your account is locked, call …").
 * Security review L1, 2026-10-05.
 *
 * Our own messages are short plain sentences. Anything that could carry someone somewhere
 * else (a link, a domain, an email address, a phone number) or is long is replaced by the
 * fixed fallback, so the banner can still say what failed but never whom to contact.
 */
const MAX_LENGTH = 200;
const POINTS_ELSEWHERE = /https?:|www\.|[a-z0-9-]+\.(?:com|net|org|io|ca|co|us|info|biz|app|xyz|link|me)\b|@|[<>]/i;

export function safeBannerText(raw: string | null | undefined, fallback: string): string {
  const text = (raw ?? "").trim();
  if (!text || text.length > MAX_LENGTH) return fallback;
  if (POINTS_ELSEWHERE.test(text)) return fallback;
  if ((text.match(/\d/g) ?? []).length >= 7) return fallback; // a phone number, however it's spaced
  return text;
}
