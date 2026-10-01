/**
 * The Monday email's designed HTML (design brain A-038; canvas "Weekly
 * email · designed"). Structure after Wispr Flow's weekly stats: a
 * highlight first, big numbers with one comparison each, the one action
 * with one button, where customers wrote from, then the company. No
 * streaks, leaderboards or percentiles (the Duolingo study, and the
 * founder: "skip the streaks").
 *
 * Written for mail apps, not browsers: tables for layout, every style
 * inline, no SVG (Gmail drops it), no CSS gradients (Gmail and Outlook
 * render them unevenly). The landing wash is a hosted image instead,
 * with its base colour as the fallback. The design's win card overlapped
 * the header; negative margins are stripped by Gmail, and the header's
 * words cannot sit on the wash (below), so the card follows the greeting
 * on the sheet.
 *
 * Two sizes, as the canvas draws them (founder, 2026-09-28: "what I'm
 * receiving is not the same"): the desktop mail version (a 600px sheet in
 * a framed page, 40px margins, the larger type) is the default, and one
 * media query turns it into the phone version (edge to edge, 24px margins,
 * the smaller type). A mail app that ignores the query shows the desktop
 * sizes at full width, which still reads. Icons are carried pictures, as
 * the logo is (src/lib/emailAssets.ts).
 *
 * Every value that came from a customer or the owner is escaped: a lead
 * can name themselves anything, and this lands in the owner's inbox.
 *
 * Dark mode (founder, 2026-09-28: "my phone is on dark mode so it was
 * looking very weird"). It used to declare itself light-only, which Apple
 * Mail respects and Gmail's app ignores: Gmail flips colours on its own,
 * but not images, so the header and footer text turned light on the light
 * wash, and the black lockup sank into dark cards. Now, in layers:
 *  - Mail apps that honour prefers-color-scheme (Apple Mail, Outlook for
 *    iOS/Mac) get a designed dark version: a dark wash, a light lockup,
 *    dark cards, the button inverted. Every colour is a class with the
 *    light value inline, so a client that drops <style> still gets light.
 *  - Outlook.com's own inversion is steered through [data-ogsc]/[data-ogsb].
 *  - Gmail's app: it lightens text but never recolours a picture, so no
 *    text sits on the wash. The wash is a band holding only the logo, and
 *    everything written sits on the plain sheet and cards, which Gmail
 *    darkens together with their text. (A screen/difference blend trick
 *    meant to hold the text dark on the wash was tried first; on the
 *    founder's phone it did nothing, 2026-09-28.)
 */

export interface WeeklyEmailView {
  title: string;
  preheader: string;
  businessName: string;
  dateRange: string;
  /** chipIcon: the calendar picture's src when the chip is a booking. */
  highlight: { label: string; title: string; body: string; chip: string | null; chipIcon: string | null };
  numbers: { label: string; value: number; lastWeek: number }[];
  waitingTitle: string;
  waiting: { initials: string; name: string; channel: string | null; waited: string | null }[];
  waitingMore: number;
  /** icon: the channel picture's src, or null for a channel without one. */
  channels: { label: string; customers: number; icon: string | null }[];
  busiest: string | null;
  links: {
    app: string;
    website: string;
    privacy: string;
    terms: string;
    contact: string;
    writeToSahil: string;
    headerImage: string;
    footerImage: string;
    logo: string;
    /** The dark-mode twins of the three images above. */
    headerImageDark: string;
    footerImageDark: string;
    logoDark: string;
  };
}

import { INK, SOFT, DIM, LINE, RULE, EDGE, SAND, FONT, escapeHtml, table, darkModeStyle } from "@/lib/emailShell";

export { escapeHtml } from "@/lib/emailShell";

const WASH = "#f3efea";
// Dark twins of the tokens above, used only inside the dark-mode styles.
const DARK = {
  ink: "#f5f3f0",
  soft: "#c2bcb5",
  dim: "#9a948d",
  line: "#34302c",
  rule: "#2a2725",
  sand: "#211e1b",
  sheet: "#171514",
  card: "#201d1b",
  chip: "#2f2b27",
  page: "#0f0e0d",
  wash: "#1c1917",
};

const e = escapeHtml;

function label(text: string): string {
  return `<div class="fu-dim" style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${DIM};">${e(text)}</div>`;
}

/**
 * The lockup, twice: black for light, near-white for dark. The dark one is
 * hidden inline, so a client that drops <style> shows only the black one.
 * It only ever sits on the wash picture, which no mail app recolours, so
 * the black mark stays readable in Gmail's dark mode too.
 */
function lockup(l: WeeklyEmailView["links"], width: number, height: number): string {
  return (
    `<img class="fu-logo-light" src="${e(l.logo)}" width="${width}" height="${height}" alt="FollowUp" style="display:block;border:0;">` +
    `<!--[if !mso]><!--><div class="fu-logo-dark" style="display:none;mso-hide:all;max-height:0;overflow:hidden;"><img src="${e(l.logoDark)}" width="${width}" height="${height}" alt="FollowUp" style="display:block;border:0;"></div><!--<![endif]-->`
  );
}

/** The dark-mode styles, as one <style> block. See the header comment. */
function darkStyles(l: WeeklyEmailView["links"]): string {
  const d = DARK;
  const rules = (scope: string) => `
  ${scope} .fu-page { background:${d.page} !important; }
  ${scope} .fu-sheet { background:${d.sheet} !important; border-color:${d.line} !important; }
  ${scope} .fu-card { background:${d.card} !important; border-color:${d.line} !important; }
  ${scope} .fu-sand { background:${d.sand} !important; }
  ${scope} .fu-chip { background:${d.chip} !important; }
  ${scope} .fu-avatar { background:${d.card} !important; border-color:${d.line} !important; }
  ${scope} .fu-ink { color:${d.ink} !important; }
  ${scope} .fu-soft { color:${d.soft} !important; }
  ${scope} .fu-dim { color:${d.dim} !important; }
  ${scope} .fu-rule { border-color:${d.rule} !important; }
  ${scope} .fu-button { background:${d.ink} !important; }
  ${scope} .fu-button-text { color:#0a0a0a !important; }
  ${scope} .fu-bar { background:${d.ink} !important; }
  ${scope} .fu-track { background:${d.rule} !important; }`;
  return darkModeStyle({
    rules,
    alsoDark: `.fu-wash-top { background-color:${d.wash} !important; background-image:url('${e(l.headerImageDark)}') !important; }
    .fu-wash-bottom { background-color:${d.wash} !important; background-image:url('${e(l.footerImageDark)}') !important; }
    .fu-logo-light { display:none !important; }
    .fu-logo-dark { display:block !important; max-height:none !important; overflow:visible !important; }`,
    outlookBackgrounds: `[data-ogsb] .fu-page { background:${d.page} !important; }
  [data-ogsb] .fu-sheet { background:${d.sheet} !important; }
  [data-ogsb] .fu-card { background:${d.card} !important; }
  [data-ogsb] .fu-sand { background:${d.sand} !important; }
  [data-ogsb] .fu-chip { background:${d.chip} !important; }`,
  });
}

/**
 * The phone version, as one media query over the desktop defaults. Its own
 * <style> block, apart from the dark-mode one: Gmail throws away a whole
 * block it cannot read, and the dark block carries selectors it may not.
 * Before the dark block, so a phone in dark mode still gets dark colours.
 */
function phoneStyles(): string {
  return `<style>
  @media only screen and (max-width: 480px) {
    .fu-outer { padding:0 !important; }
    .fu-page { background:#ffffff !important; }
    .fu-sheet { border:0 !important; border-radius:0 !important; }
    .fu-px { padding-left:24px !important; padding-right:24px !important; }
    .fu-px-card { padding-left:16px !important; padding-right:16px !important; }
    .fu-wash-pad { padding:24px 24px 40px !important; }
    .fu-foot-pad { padding:24px 24px !important; }
    .fu-h1 { font-size:34px !important; }
    .fu-win-pad { padding:22px 20px 24px !important; }
    .fu-win-title { font-size:26px !important; }
    .fu-num { font-size:30px !important; }
    .fu-box-pad { padding:22px 18px !important; }
  }
</style>`;
}

export function renderWeeklyEmailHtml(v: WeeklyEmailView): string {
  const l = v.links;

  // The wash is a picture band holding only the logo. No text sits on it:
  // Gmail's app, in dark mode, lightens text but leaves pictures alone, so
  // anything written on the light wash turned light-on-light there
  // (founder's phone, 2026-09-28). The date, the greeting and the win sit
  // on the plain sheet, which every mail app darkens along with its text.
  const header = `
<tr><td class="fu-wash-top fu-wash-pad" background="${e(l.headerImage)}" bgcolor="${WASH}" style="background-color:${WASH};background-image:url('${e(l.headerImage)}');background-size:cover;background-position:center;padding:40px 40px 56px;">
  <a href="${e(l.website)}" style="text-decoration:none;">${lockup(l, 59, 22)}</a>
</td></tr>
<tr><td class="fu-px" style="padding:32px 40px 0;">
  <div class="fu-dim" style="font-size:13px;color:${DIM};">${e(v.dateRange)}</div>
  <h1 class="fu-ink fu-h1" style="margin:8px 0 0;font-size:44px;line-height:1.05;letter-spacing:-0.03em;font-weight:300;color:${INK};">Your week,<br>${e(v.businessName)}</h1>
</td></tr>
<tr><td class="fu-px-card" style="padding:26px 40px 0;">
  ${table(
    `<tr><td class="fu-win-pad" style="padding:22px 28px 24px;">
      ${label(v.highlight.label)}
      <p class="fu-ink fu-win-title" style="margin:10px 0 0;font-size:30px;line-height:1.15;letter-spacing:-0.02em;font-weight:400;color:${INK};">${e(v.highlight.title)}</p>
      <p class="fu-soft" style="margin:10px 0 0;font-size:15.5px;line-height:1.5;color:${SOFT};">${e(v.highlight.body)}</p>
      ${
        v.highlight.chip
          ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-collapse:separate;"><tr><td class="fu-chip fu-ink" style="background:${SAND};border-radius:999px;padding:8px 14px;font-size:14px;line-height:18px;color:${INK};">${
              v.highlight.chipIcon
                ? `<img src="${e(v.highlight.chipIcon)}" width="15" height="15" alt="" style="display:inline-block;vertical-align:-2px;margin-right:8px;border:0;">`
                : ""
            }${e(v.highlight.chip)}</td></tr></table>`
          : ""
      }
    </td></tr>`,
    `background:#ffffff;border:1px solid ${LINE};border-radius:20px;`,
    "fu-card"
  )}
</td></tr>`;

  const numbers = `
<tr><td class="fu-px" style="padding:36px 40px 0;">
  ${label("The week in customers")}
  ${table(
    `<tr>${v.numbers
      .map(
        (n, i) => `<td width="33%" style="vertical-align:top;padding-top:16px;${i > 0 ? "padding-left:16px;" : ""}">
      <div class="fu-ink fu-num" style="font-size:38px;line-height:1;letter-spacing:-0.03em;font-weight:300;color:${INK};">${n.value}</div>
      <div class="fu-ink" style="margin-top:8px;font-size:14px;line-height:1.3;color:${INK};">${e(n.label)}</div>
      <div class="fu-dim" style="margin-top:2px;font-size:13px;color:${DIM};">Last week: ${n.lastWeek}</div>
    </td>`
      )
      .join("")}</tr>`
  )}
</td></tr>`;

  const rows = v.waiting
    .map(
      (w, i) => `<tr><td class="${i === 0 ? "" : "fu-rule"}" style="padding:12px 0;${i === 0 ? "" : `border-top:1px solid ${RULE};`}">
    ${table(`<tr>
      <td width="34" style="vertical-align:middle;"><div class="fu-avatar fu-soft" style="width:34px;height:34px;line-height:34px;border-radius:999px;background:#f1eeea;border:1px solid ${LINE};text-align:center;font-size:14px;font-weight:600;color:${SOFT};">${e(w.initials)}</div></td>
      <td style="vertical-align:middle;padding-left:12px;">
        <div class="fu-ink" style="font-size:15.5px;font-weight:500;color:${INK};">${e(w.name)}</div>
        ${w.channel ? `<div class="fu-dim" style="font-size:13.5px;color:${DIM};">${e(w.channel)}</div>` : ""}
      </td>
      <td class="fu-soft" align="right" style="vertical-align:middle;font-size:13.5px;color:${SOFT};white-space:nowrap;">${w.waited ? e(w.waited) : ""}</td>
    </tr>`)}
  </td></tr>`
    )
    .join("");
  const more = v.waitingMore > 0 ? `<tr><td class="fu-rule fu-soft" style="padding:10px 0 0;border-top:1px solid ${RULE};font-size:14px;color:${SOFT};">and ${v.waitingMore} more</td></tr>` : "";

  const waiting = `
<tr><td class="fu-px" style="padding:36px 40px 0;">
  ${table(
    `<tr><td class="fu-box-pad" style="padding:22px 26px;">
      ${label("Waiting for your OK")}
      <p class="fu-ink" style="margin:8px 0 6px;font-size:20px;line-height:1.25;letter-spacing:-0.01em;color:${INK};">${e(v.waitingTitle)}</p>
      ${rows || more ? table(rows + more) : ""}
      ${table(
        `<tr><td class="fu-button" align="center" bgcolor="${INK}" style="background:${INK};border-radius:999px;"><a class="fu-button-text" href="${e(l.app)}" style="display:block;padding:15px 20px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">Open FollowUp &rarr;</a></td></tr>`,
        "margin-top:14px;"
      )}
      <p class="fu-dim" style="margin:12px 0 0;text-align:center;font-size:13.5px;color:${DIM};">Nothing goes out until you send it.</p>
    </td></tr>`,
    // The edge keeps the box distinct when Gmail darkens it to the sheet's colour (see EDGE).
    `background:${SAND};border:1px solid ${EDGE};border-radius:20px;`,
    "fu-sand fu-rule"
  )}
</td></tr>`;

  const top = Math.max(1, ...v.channels.map((c) => c.customers));
  const channelRows = v.channels
    .map((c) => {
      const pct = Math.max(4, Math.round((c.customers / top) * 100));
      return `<tr>
      <td width="18" style="padding-top:12px;vertical-align:middle;line-height:0;">${
        c.icon ? `<img src="${e(c.icon)}" width="18" height="18" alt="" style="display:block;border:0;">` : ""
      }</td>
      <td class="fu-ink" width="96" style="padding:12px 0 0 12px;vertical-align:middle;font-size:14.5px;color:${INK};">${e(c.label)}</td>
      <td style="padding-top:12px;vertical-align:middle;">${table(
        `<tr><td class="fu-bar" width="${pct}%" bgcolor="${INK}" style="background:${INK};height:6px;line-height:6px;font-size:0;border-radius:999px;">&nbsp;</td>${pct < 100 ? `<td class="fu-track" bgcolor="${RULE}" style="background:${RULE};height:6px;line-height:6px;font-size:0;">&nbsp;</td>` : ""}</tr>`,
        `background:${RULE};border-radius:999px;`,
        "fu-track"
      )}</td>
      <td class="fu-soft" width="30" align="right" style="padding-top:12px;vertical-align:middle;font-size:14px;color:${SOFT};">${c.customers}</td>
    </tr>`;
    })
    .join("");
  const where =
    v.channels.length > 0 || v.busiest
      ? `
<tr><td class="fu-px" style="padding:36px 40px 0;">
  ${v.channels.length > 0 ? label("Where customers wrote from") + table(channelRows) : ""}
  ${
    v.busiest
      ? `<p class="fu-soft fu-rule" style="margin:22px 0 0;padding-top:18px;${v.channels.length > 0 ? `border-top:1px solid ${RULE};` : ""}font-size:15px;line-height:1.5;color:${SOFT};"><span class="fu-ink" style="color:${INK};font-weight:500;">Busiest time:</span> ${e(v.busiest)}</p>`
      : ""
  }
</td></tr>`
      : "";

  const link = (href: string, text: string) => `<a class="fu-soft" href="${e(href)}" style="color:${SOFT};text-decoration:none;">${text}</a>`;
  // The design's order, logo first: the wash band holds only the logo (the
  // same reason as the header), and the words follow on the sheet.
  const footer = `
<tr><td style="padding-top:40px;"></td></tr>
<tr><td class="fu-wash-bottom fu-foot-pad" background="${e(l.footerImage)}" bgcolor="${WASH}" style="background-color:${WASH};background-image:url('${e(l.footerImage)}');background-size:cover;background-position:center;padding:28px 40px;">
  ${lockup(l, 54, 20)}
</td></tr>
<tr><td class="fu-px" style="padding:24px 40px 36px;">
  <p class="fu-soft" style="margin:0;font-size:15px;color:${SOFT};">So no customer gets forgotten.</p>
  <p style="margin:16px 0 0;font-size:14px;">${[link(l.website, "Website"), link(l.privacy, "Privacy"), link(l.terms, "Terms"), link(l.contact, "Contact")].join(`&nbsp;&nbsp;&nbsp;&nbsp;`)}</p>
  <p class="fu-soft" style="margin:18px 0 0;font-size:14px;line-height:1.5;color:${SOFT};">Questions or ideas? <a class="fu-ink" href="${e(l.writeToSahil)}" style="color:${INK};text-decoration:underline;">Write to Sahil</a>, who builds FollowUp.</p>
  <p class="fu-dim" style="margin:16px 0 0;font-size:12.5px;line-height:1.5;color:${DIM};">FollowUp sent this from your own Gmail to you, an admin of ${e(v.businessName)}. It comes every Monday.</p>
</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${e(v.title)}</title>
${phoneStyles()}
${darkStyles(l)}
</head>
<body class="body fu-page" style="margin:0;padding:0;background:#f1eeea;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${e(v.preheader)}</div>
<table class="fu-page" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1eeea;">
<tr><td class="fu-outer" align="center" style="padding:40px 12px;">
<table class="fu-sheet" role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:12px;overflow:hidden;font-family:${FONT};color:${INK};">
${header}
${numbers}
${waiting}
${where}
${footer}
</table>
</td></tr>
</table>
</body>
</html>
`;
}
