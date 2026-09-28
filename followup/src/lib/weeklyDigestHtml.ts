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
 * the header; negative margins are stripped by Gmail, so the card sits on
 * the wash inside the header instead.
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
 *  - Gmail's app: text that sits on the wash image is wrapped in the
 *    screen/difference blend pair (targeted by Gmail's "u + .body"
 *    wrapper), which cancels Gmail's text flip exactly where the image
 *    stays light. Solid cards flip as a whole and stay readable.
 */

export interface WeeklyEmailView {
  title: string;
  preheader: string;
  businessName: string;
  dateRange: string;
  highlight: { label: string; title: string; body: string; chip: string | null };
  numbers: { label: string; value: number; lastWeek: number }[];
  waitingTitle: string;
  waiting: { initials: string; name: string; channel: string | null; waited: string | null }[];
  waitingMore: number;
  channels: { label: string; customers: number }[];
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

const INK = "#0a0a0a";
const SOFT = "#57534e";
const DIM = "#736e68";
const LINE = "#e7e5e2";
const RULE = "#f0eeeb";
const SAND = "#faf8f6";
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
const FONT = "'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const e = escapeHtml;

function label(text: string): string {
  return `<div class="fu-dim" style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${DIM};">${e(text)}</div>`;
}

function table(inner: string, style = "", className = ""): string {
  return `<table${className ? ` class="${className}"` : ""} role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;${style}">${inner}</table>`;
}

/**
 * Text that sits on the wash image. In Gmail's app dark mode the image
 * stays light while Gmail lightens the text, so this pair of blend layers
 * (active only under Gmail's "u + .body" wrapper, see darkStyles) turns
 * the text back. Everywhere else the two spans are inert.
 */
function onWash(html: string): string {
  return `<span class="fu-gmail-screen"><span class="fu-gmail-diff">${html}</span></span>`;
}

/**
 * The lockup, twice: black for light, near-white for dark. The dark one is
 * hidden inline, so a client that drops <style> shows only the black one.
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
  return `<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    ${rules("")}
    .fu-wash-top { background-color:${d.wash} !important; background-image:url('${e(l.headerImageDark)}') !important; }
    .fu-wash-bottom { background-color:${d.wash} !important; background-image:url('${e(l.footerImageDark)}') !important; }
    .fu-logo-light { display:none !important; }
    .fu-logo-dark { display:block !important; max-height:none !important; overflow:visible !important; }
  }
  ${rules("[data-ogsc]")
    .split("\n")
    // Text colours only: Outlook.com paints its own dark backgrounds, and
    // the button keeps its own light-on-dark pairing there.
    .filter((line) => !/background|button/.test(line))
    .join("\n")}
  [data-ogsb] .fu-page { background:${d.page} !important; }
  [data-ogsb] .fu-sheet { background:${d.sheet} !important; }
  [data-ogsb] .fu-card { background:${d.card} !important; }
  [data-ogsb] .fu-sand { background:${d.sand} !important; }
  [data-ogsb] .fu-chip { background:${d.chip} !important; }
  u + .body .fu-gmail-screen { background:#000; mix-blend-mode:screen; }
  u + .body .fu-gmail-diff { background:#000; mix-blend-mode:difference; }
</style>`;
}

export function renderWeeklyEmailHtml(v: WeeklyEmailView): string {
  const l = v.links;

  const header = `
<tr><td class="fu-wash-top" background="${e(l.headerImage)}" bgcolor="${WASH}" style="background-color:${WASH};background-image:url('${e(l.headerImage)}');background-size:cover;background-position:center;padding:28px 28px 28px;">
  ${table(`<tr>
    <td style="vertical-align:middle;"><a href="${e(l.website)}" style="text-decoration:none;">${lockup(l, 59, 22)}</a></td>
    <td align="right" style="vertical-align:middle;font-size:13px;">${onWash(`<span class="fu-soft" style="color:${SOFT};">${e(v.dateRange)}</span>`)}</td>
  </tr>`)}
  <h1 class="fu-ink" style="margin:40px 0 0;font-size:34px;line-height:1.08;letter-spacing:-0.03em;font-weight:300;color:${INK};">${onWash(`Your week,<br>${e(v.businessName)}`)}</h1>
  ${table(
    `<tr><td style="padding:22px 22px 24px;">
      ${label(v.highlight.label)}
      <p class="fu-ink" style="margin:10px 0 0;font-size:26px;line-height:1.18;letter-spacing:-0.02em;font-weight:400;color:${INK};">${e(v.highlight.title)}</p>
      <p class="fu-soft" style="margin:10px 0 0;font-size:15.5px;line-height:1.5;color:${SOFT};">${e(v.highlight.body)}</p>
      ${
        v.highlight.chip
          ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-collapse:separate;"><tr><td class="fu-chip fu-ink" style="background:${SAND};border-radius:999px;padding:8px 14px;font-size:14px;color:${INK};">${e(v.highlight.chip)}</td></tr></table>`
          : ""
      }
    </td></tr>`,
    `margin-top:28px;background:#ffffff;border:1px solid ${LINE};border-radius:20px;`,
    "fu-card"
  )}
</td></tr>`;

  const numbers = `
<tr><td style="padding:34px 28px 0;">
  ${label("The week in customers")}
  ${table(
    `<tr>${v.numbers
      .map(
        (n) => `<td width="33%" style="vertical-align:top;padding-top:14px;">
      <div class="fu-ink" style="font-size:34px;line-height:1;letter-spacing:-0.03em;font-weight:300;color:${INK};">${n.value}</div>
      <div class="fu-ink" style="margin-top:8px;font-size:14px;color:${INK};">${e(n.label)}</div>
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
      <td width="34" style="vertical-align:middle;"><div class="fu-avatar fu-soft" style="width:34px;height:34px;line-height:34px;border-radius:999px;background:#f1eeea;border:1px solid ${LINE};text-align:center;font-size:12px;font-weight:600;color:${SOFT};">${e(w.initials)}</div></td>
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
<tr><td style="padding:34px 28px 0;">
  ${table(
    `<tr><td style="padding:22px 22px;">
      ${label("Waiting for your OK")}
      <p class="fu-ink" style="margin:8px 0 6px;font-size:20px;line-height:1.25;letter-spacing:-0.01em;color:${INK};">${e(v.waitingTitle)}</p>
      ${rows || more ? table(rows + more) : ""}
      ${table(
        `<tr><td class="fu-button" align="center" bgcolor="${INK}" style="background:${INK};border-radius:999px;"><a class="fu-button-text" href="${e(l.app)}" style="display:block;padding:15px 20px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">Open FollowUp &rarr;</a></td></tr>`,
        "margin-top:14px;"
      )}
      <p class="fu-dim" style="margin:12px 0 0;text-align:center;font-size:13.5px;color:${DIM};">Nothing goes out until you send it.</p>
    </td></tr>`,
    `background:${SAND};border-radius:20px;`,
    "fu-sand"
  )}
</td></tr>`;

  const top = Math.max(1, ...v.channels.map((c) => c.customers));
  const channelRows = v.channels
    .map((c) => {
      const pct = Math.max(4, Math.round((c.customers / top) * 100));
      return `<tr>
      <td class="fu-ink" width="96" style="padding-top:12px;font-size:14.5px;color:${INK};">${e(c.label)}</td>
      <td style="padding-top:12px;vertical-align:middle;">${table(
        `<tr><td class="fu-bar" width="${pct}%" bgcolor="${INK}" style="background:${INK};height:6px;line-height:6px;font-size:0;border-radius:999px;">&nbsp;</td>${pct < 100 ? `<td class="fu-track" bgcolor="${RULE}" style="background:${RULE};height:6px;line-height:6px;font-size:0;">&nbsp;</td>` : ""}</tr>`,
        `background:${RULE};border-radius:999px;`,
        "fu-track"
      )}</td>
      <td class="fu-soft" width="28" align="right" style="padding-top:12px;font-size:14px;color:${SOFT};">${c.customers}</td>
    </tr>`;
    })
    .join("");
  const where =
    v.channels.length > 0 || v.busiest
      ? `
<tr><td style="padding:34px 28px 0;">
  ${v.channels.length > 0 ? label("Where customers wrote from") + table(channelRows) : ""}
  ${
    v.busiest
      ? `<p class="fu-soft fu-rule" style="margin:22px 0 0;padding-top:18px;${v.channels.length > 0 ? `border-top:1px solid ${RULE};` : ""}font-size:15px;line-height:1.5;color:${SOFT};"><span class="fu-ink" style="color:${INK};font-weight:500;">Busiest time:</span> ${e(v.busiest)}</p>`
      : ""
  }
</td></tr>`
      : "";

  const link = (href: string, text: string) => `<a class="fu-soft" href="${e(href)}" style="color:${SOFT};text-decoration:none;">${text}</a>`;
  const footer = `
<tr><td style="padding-top:40px;"></td></tr>
<tr><td class="fu-wash-bottom" background="${e(l.footerImage)}" bgcolor="${WASH}" style="background-color:${WASH};background-image:url('${e(l.footerImage)}');background-size:cover;background-position:center;padding:30px 28px 28px;">
  ${lockup(l, 53, 20)}
  <p class="fu-soft" style="margin:10px 0 0;font-size:15px;color:${SOFT};">${onWash("So no customer gets forgotten.")}</p>
  <p style="margin:16px 0 0;font-size:14px;">${onWash([link(l.website, "Website"), link(l.privacy, "Privacy"), link(l.terms, "Terms"), link(l.contact, "Contact")].join(`&nbsp;&nbsp;&nbsp;&nbsp;`))}</p>
  <p class="fu-soft" style="margin:18px 0 0;font-size:14px;line-height:1.5;color:${SOFT};">${onWash(`Questions or ideas? <a class="fu-ink" href="${e(l.writeToSahil)}" style="color:${INK};text-decoration:underline;">Write to Sahil</a>, who builds FollowUp.`)}</p>
  <p class="fu-dim" style="margin:16px 0 0;font-size:12.5px;line-height:1.5;color:${DIM};">${onWash(`FollowUp sent this from your own Gmail to you, an admin of ${e(v.businessName)}. It comes every Monday.`)}</p>
</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${e(v.title)}</title>
${darkStyles(l)}
</head>
<body class="body fu-page" style="margin:0;padding:0;background:#f1eeea;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${e(v.preheader)}</div>
<table class="fu-page" role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1eeea;">
<tr><td align="center" style="padding:24px 12px;">
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
