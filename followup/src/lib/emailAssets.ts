/**
 * The weekly email's logo, carried inside the message itself.
 *
 * The email used to point at images on followupbase.io. On the founder's
 * phone (Gmail app, 2026-09-28) none of them ever loaded, in light or dark
 * mode: three samples in a row showed no logo at all. A picture attached to
 * the message and referenced by Content-ID (cid:) is shown without Gmail
 * fetching anything from anywhere, so the logo no longer depends on it.
 *
 * Generated from public/email/followup-lockup-chip*.png, the same files the
 * site hosts; regenerate this file if they change. Kept as base64 in code
 * rather than read from public/ at send time, because the serverless
 * function that sends the email is not guaranteed to have public/ on disk.
 */

export interface InlineImage {
  /** Referenced from the HTML as `cid:<cid>`. */
  cid: string;
  filename: string;
  contentType: string;
  base64: string;
}

export const LOGO_CHIP: InlineImage = {
  cid: "fu-logo@followupbase.io",
  filename: "followup-logo.png",
  contentType: "image/png",
  base64:
    "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" +
    "AElFTkSuQmCC",
};

export const LOGO_CHIP_DARK: InlineImage = {
  cid: "fu-logo-dark@followupbase.io",
  filename: "followup-logo-dark.png",
  contentType: "image/png",
  base64:
    "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",
};
