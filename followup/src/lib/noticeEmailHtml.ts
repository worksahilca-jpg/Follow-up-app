/**
 * The shell every notice email shares (A-079, founder 2026-10-01): the
 * reconnect emails, the "a customer is waiting" alerts and the new
 * sign-in alert. The Monday digest keeps its own renderer
 * (src/lib/weeklyDigestHtml.ts); the colours, the type and the dark-mode
 * block they share come from src/lib/emailShell.ts (b038).
 *
 * The whole email is the landing page's hero wash (public/email/
 * notice-wash.jpg, rendered from `.washHero` in landing.module.css —
 * Gmail drops CSS gradients, so it has to be a picture), edge to edge,
 * with everything the owner reads on one white card on top of it. Words
 * never sit on the wash (A-071): Gmail's dark mode darkens the card and
 * lightens the text, and leaves the picture alone.
 *
 * These go out through Resend from FollowUp's own domain, not the owner's
 * Gmail, so the pictures are hosted at the app's URL rather than carried
 * inside the message; the weekly email already hosts its wash the same way.
 */

import { INK, SOFT, DIM, LINE, RULE, SAND, EDGE, FONT, escapeHtml, table, darkModeStyle } from "@/lib/emailShell";

export { escapeHtml } from "@/lib/emailShell";

const CREAM = "#f3efea";
const PAGE = "#eae6e0";
const CARD_EDGE = "rgba(10,10,10,0.06)";
// Dark twins of the shared tokens, used only inside the dark-mode styles.
const DARK = { card: "#1b1917", sand: "#232120", ink: "#f4f2ef", soft: "#b8b1aa", dim: "#8f8880", line: "#2e2b28", rule: "#2a2724", edge: "#3a3632" };

const e = escapeHtml;

/** A line of body text; `strong` runs are rendered in the ink colour. */
export type NoticeText = string | { text: string; strong?: boolean }[];

export interface NoticeEmailView {
  /** The app's public URL, for the pictures and the footer links. */
  base: string;
  /** The dim uppercase word above the title: "Gmail", "Security", "Waiting for your reply". */
  label: string;
  title: string;
  /** Shown in the inbox preview; defaults to the title. */
  preheader?: string;
  /** "Wed, Oct 1" — the day it went out, top right on the wash. */
  date: string;
  /** Paragraphs above the sub-card. */
  before: NoticeText[];
  /** The sand card inside the white one: a person and what they wrote, or a few facts. */
  sub?:
    | { kind: "person"; initials: string; name: string; channel: string | null; when: string | null; quote: string | null }
    | { kind: "rows"; rows: [string, string][] };
  /** Paragraphs between the sub-card and the button. */
  after?: NoticeText[];
  button: { text: string; href: string };
  /** The dim line under the button: why this happened, what Google's rule is. */
  why?: string;
  /** One line of small print under the card: who it went to, how often it comes. */
  footnote: string;
  /** An optional link finishing the small print ("turn them off in Settings"). */
  footnoteLink?: { text: string; href: string };
}

function paragraph(t: NoticeText, first: boolean): string {
  const inner =
    typeof t === "string"
      ? e(t)
      : t.map((r) => (r.strong ? `<span class="fu-ink" style="color:${INK};font-weight:500;">${e(r.text)}</span>` : e(r.text))).join("");
  return `<p class="fu-soft" style="margin:${first ? 14 : 12}px 0 0;font-size:15.5px;line-height:1.55;color:${SOFT};">${inner}</p>`;
}

function subCard(sub: NonNullable<NoticeEmailView["sub"]>): string {
  let inner: string;
  if (sub.kind === "person") {
    inner = table(`<tr>
      <td width="34" style="vertical-align:middle;"><div class="fu-avatar fu-soft" style="width:34px;height:34px;line-height:34px;border-radius:999px;background:#f1eeea;border:1px solid ${LINE};text-align:center;font-size:14px;font-weight:600;color:${SOFT};">${e(sub.initials)}</div></td>
      <td style="vertical-align:middle;padding-left:12px;">
        <div class="fu-ink" style="font-size:15.5px;font-weight:500;color:${INK};">${e(sub.name)}</div>
        ${sub.channel ? `<div class="fu-dim" style="font-size:13.5px;color:${DIM};">${e(sub.channel)}</div>` : ""}
      </td>
      <td class="fu-soft" align="right" style="vertical-align:middle;font-size:13.5px;color:${SOFT};white-space:nowrap;">${sub.when ? e(sub.when) : ""}</td>
    </tr>`);
    if (sub.quote) {
      inner += `<p class="fu-ink fu-quote" style="margin:14px 0 0;padding-left:14px;border-left:2px solid ${EDGE};font-size:15px;line-height:1.5;color:${INK};">&ldquo;${e(sub.quote)}&rdquo;</p>`;
    }
  } else {
    inner = `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">${sub.rows
      .map(
        ([k, v], i) =>
          `<tr><td class="fu-dim fu-rule" width="88" style="padding:8px 12px 8px 0;font-size:14.5px;color:${DIM};${i ? `border-top:1px solid ${RULE};` : ""}">${e(k)}</td>` +
          `<td class="fu-ink fu-rule" style="padding:8px 0;font-size:14.5px;color:${INK};${i ? `border-top:1px solid ${RULE};` : ""}">${e(v)}</td></tr>`
      )
      .join("")}</table>`;
  }
  return table(`<tr><td style="padding:18px 20px;">${inner}</td></tr>`, `margin-top:20px;background:${SAND};border:1px solid ${EDGE};border-radius:18px;`, "fu-sand");
}

function darkStyles(): string {
  const d = DARK;
  const rules = (scope: string) => `
  ${scope} .fu-card { background:${d.card} !important; border-color:${d.line} !important; }
  ${scope} .fu-sand { background:${d.sand} !important; border-color:${d.edge} !important; }
  ${scope} .fu-avatar { background:${d.card} !important; border-color:${d.line} !important; }
  ${scope} .fu-ink { color:${d.ink} !important; }
  ${scope} .fu-soft { color:${d.soft} !important; }
  ${scope} .fu-dim { color:${d.dim} !important; }
  ${scope} .fu-rule { border-color:${d.rule} !important; }
  ${scope} .fu-quote { border-color:${d.edge} !important; }
  ${scope} .fu-button { background:${d.ink} !important; }
  ${scope} .fu-button-text { color:#0a0a0a !important; }`;
  return darkModeStyle({
    rules,
    outlookBackgrounds: `[data-ogsb] .fu-card { background:${d.card} !important; }
  [data-ogsb] .fu-sand { background:${d.sand} !important; }`,
  });
}

function phoneStyles(): string {
  return `<style>
  @media only screen and (max-width: 480px) {
    .fu-outer { padding:0 !important; }
    .fu-sheet { border-radius:0 !important; }
    .fu-sheet-pad { padding:24px 16px 24px !important; }
    .fu-card-pad { padding:24px 20px 22px !important; }
    .fu-title { font-size:26px !important; }
    .fu-top { padding-bottom:32px !important; }
  }
</style>`;
}

export function renderNoticeEmailHtml(v: NoticeEmailView): string {
  const wash = `${v.base}/email/notice-wash.jpg`;
  const logo = `${v.base}/email/followup-lockup.png`;
  const link = (href: string, text: string) => `<a class="fu-ink" href="${e(href)}" style="color:${INK};text-decoration:none;">${text}</a>`;

  const card = table(
    `<tr><td class="fu-card-pad" style="padding:30px 30px 28px;">
      <div class="fu-dim" style="font-size:11px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${DIM};">${e(v.label)}</div>
      <h1 class="fu-ink fu-title" style="margin:8px 0 0;font-size:30px;line-height:1.12;letter-spacing:-0.02em;font-weight:300;color:${INK};">${e(v.title)}</h1>
      ${v.before.map((t, i) => paragraph(t, i === 0)).join("")}
      ${v.sub ? subCard(v.sub) : ""}
      ${(v.after ?? []).map((t, i) => paragraph(t, i === 0 && !v.sub)).join("")}
      ${table(
        `<tr><td class="fu-button" align="center" bgcolor="${INK}" style="background:${INK};border-radius:999px;"><a class="fu-button-text" href="${e(v.button.href)}" style="display:block;padding:15px 20px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">${e(v.button.text)} &rarr;</a></td></tr>`,
        "margin-top:22px;"
      )}
      ${v.why ? `<p class="fu-dim" style="margin:14px 0 0;font-size:13.5px;line-height:1.5;color:${DIM};">${e(v.why)}</p>` : ""}
    </td></tr>`,
    `background:#ffffff;border:1px solid ${CARD_EDGE};border-radius:22px;`,
    "fu-card"
  );

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${e(v.title)}</title>
${phoneStyles()}
${darkStyles()}
</head>
<body style="margin:0;padding:0;background:${PAGE};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${e(v.preheader ?? v.title)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${PAGE};">
<tr><td class="fu-outer" align="center" style="padding:32px 12px;">
<table class="fu-sheet" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" background="${e(wash)}" bgcolor="${CREAM}" style="width:100%;max-width:600px;background-color:${CREAM};background-image:url('${e(wash)}');background-size:cover;background-position:center top;border:1px solid ${CARD_EDGE};border-radius:22px;font-family:${FONT};color:${INK};">
<tr><td class="fu-sheet-pad" style="padding:36px 28px 28px;">
  ${table(`<tr>
    <td style="vertical-align:middle;"><a href="${e(v.base)}" style="text-decoration:none;"><img src="${e(logo)}" width="66" height="25" alt="FollowUp" style="display:block;border:0;"></a></td>
    <td align="right" style="vertical-align:middle;font-size:13px;color:${SOFT};">${e(v.date)}</td>
  </tr>`, "padding-bottom:44px;", "fu-top")}
  ${card}
  <p style="margin:44px 0 0;font-size:14px;">${[link(v.base, "Website"), link(`${v.base}/privacy`, "Privacy"), link(`${v.base}/terms`, "Terms"), link("mailto:contact@followupbase.io", "Contact")].join("&nbsp;&nbsp;&nbsp;&nbsp;")}</p>
  <p style="margin:10px 0 0;font-size:12.5px;line-height:1.5;color:${SOFT};">${e(v.footnote)}${
    v.footnoteLink ? ` <a href="${e(v.footnoteLink.href)}" style="color:${SOFT};text-decoration:underline;">${e(v.footnoteLink.text)}</a>.` : ""
  }</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>
`;
}

/** "Wed, Oct 1" in the business's time zone, for the top-right corner. */
export function noticeDate(at: Date, timeZone: string): string {
  try {
    return at.toLocaleDateString("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" });
  } catch {
    return at.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "short", month: "short", day: "numeric" });
  }
}
