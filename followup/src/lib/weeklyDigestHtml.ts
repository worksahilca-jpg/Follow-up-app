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
  };
}

const INK = "#0a0a0a";
const SOFT = "#57534e";
const DIM = "#736e68";
const LINE = "#e7e5e2";
const RULE = "#f0eeeb";
const SAND = "#faf8f6";
const WASH = "#f3efea";
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
  return `<div style="font-size:12px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${DIM};">${e(text)}</div>`;
}

function table(inner: string, style = ""): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;${style}">${inner}</table>`;
}

export function renderWeeklyEmailHtml(v: WeeklyEmailView): string {
  const l = v.links;

  const header = `
<tr><td background="${e(l.headerImage)}" bgcolor="${WASH}" style="background-color:${WASH};background-image:url('${e(l.headerImage)}');background-size:cover;background-position:center;padding:28px 28px 28px;">
  ${table(`<tr>
    <td style="vertical-align:middle;"><a href="${e(l.website)}" style="text-decoration:none;"><img src="${e(l.logo)}" width="59" height="22" alt="FollowUp" style="display:block;border:0;"></a></td>
    <td align="right" style="vertical-align:middle;font-size:13px;color:${SOFT};">${e(v.dateRange)}</td>
  </tr>`)}
  <h1 style="margin:40px 0 0;font-size:34px;line-height:1.08;letter-spacing:-0.03em;font-weight:300;color:${INK};">Your week,<br>${e(v.businessName)}</h1>
  ${table(
    `<tr><td style="padding:22px 22px 24px;">
      ${label(v.highlight.label)}
      <p style="margin:10px 0 0;font-size:26px;line-height:1.18;letter-spacing:-0.02em;font-weight:400;color:${INK};">${e(v.highlight.title)}</p>
      <p style="margin:10px 0 0;font-size:15.5px;line-height:1.5;color:${SOFT};">${e(v.highlight.body)}</p>
      ${
        v.highlight.chip
          ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin-top:16px;border-collapse:separate;"><tr><td style="background:${SAND};border-radius:999px;padding:8px 14px;font-size:14px;color:${INK};">${e(v.highlight.chip)}</td></tr></table>`
          : ""
      }
    </td></tr>`,
    `margin-top:28px;background:#ffffff;border:1px solid ${LINE};border-radius:20px;`
  )}
</td></tr>`;

  const numbers = `
<tr><td style="padding:34px 28px 0;">
  ${label("The week in customers")}
  ${table(
    `<tr>${v.numbers
      .map(
        (n) => `<td width="33%" style="vertical-align:top;padding-top:14px;">
      <div style="font-size:34px;line-height:1;letter-spacing:-0.03em;font-weight:300;color:${INK};">${n.value}</div>
      <div style="margin-top:8px;font-size:14px;color:${INK};">${e(n.label)}</div>
      <div style="margin-top:2px;font-size:13px;color:${DIM};">Last week: ${n.lastWeek}</div>
    </td>`
      )
      .join("")}</tr>`
  )}
</td></tr>`;

  const rows = v.waiting
    .map(
      (w, i) => `<tr><td style="padding:12px 0;${i === 0 ? "" : `border-top:1px solid ${RULE};`}">
    ${table(`<tr>
      <td width="34" style="vertical-align:middle;"><div style="width:34px;height:34px;line-height:34px;border-radius:999px;background:#f1eeea;border:1px solid ${LINE};text-align:center;font-size:12px;font-weight:600;color:${SOFT};">${e(w.initials)}</div></td>
      <td style="vertical-align:middle;padding-left:12px;">
        <div style="font-size:15.5px;font-weight:500;color:${INK};">${e(w.name)}</div>
        ${w.channel ? `<div style="font-size:13.5px;color:${DIM};">${e(w.channel)}</div>` : ""}
      </td>
      <td align="right" style="vertical-align:middle;font-size:13.5px;color:${SOFT};white-space:nowrap;">${w.waited ? e(w.waited) : ""}</td>
    </tr>`)}
  </td></tr>`
    )
    .join("");
  const more = v.waitingMore > 0 ? `<tr><td style="padding:10px 0 0;border-top:1px solid ${RULE};font-size:14px;color:${SOFT};">and ${v.waitingMore} more</td></tr>` : "";

  const waiting = `
<tr><td style="padding:34px 28px 0;">
  ${table(
    `<tr><td style="padding:22px 22px;">
      ${label("Waiting for your OK")}
      <p style="margin:8px 0 6px;font-size:20px;line-height:1.25;letter-spacing:-0.01em;color:${INK};">${e(v.waitingTitle)}</p>
      ${rows || more ? table(rows + more) : ""}
      ${table(
        `<tr><td align="center" bgcolor="${INK}" style="background:${INK};border-radius:999px;"><a href="${e(l.app)}" style="display:block;padding:15px 20px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none;">Open FollowUp &rarr;</a></td></tr>`,
        "margin-top:14px;"
      )}
      <p style="margin:12px 0 0;text-align:center;font-size:13.5px;color:${DIM};">Nothing goes out until you send it.</p>
    </td></tr>`,
    `background:${SAND};border-radius:20px;`
  )}
</td></tr>`;

  const top = Math.max(1, ...v.channels.map((c) => c.customers));
  const channelRows = v.channels
    .map((c) => {
      const pct = Math.max(4, Math.round((c.customers / top) * 100));
      return `<tr>
      <td width="96" style="padding-top:12px;font-size:14.5px;color:${INK};">${e(c.label)}</td>
      <td style="padding-top:12px;vertical-align:middle;">${table(
        `<tr><td width="${pct}%" bgcolor="${INK}" style="background:${INK};height:6px;line-height:6px;font-size:0;border-radius:999px;">&nbsp;</td>${pct < 100 ? `<td bgcolor="${RULE}" style="background:${RULE};height:6px;line-height:6px;font-size:0;">&nbsp;</td>` : ""}</tr>`,
        `background:${RULE};border-radius:999px;`
      )}</td>
      <td width="28" align="right" style="padding-top:12px;font-size:14px;color:${SOFT};">${c.customers}</td>
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
      ? `<p style="margin:22px 0 0;padding-top:18px;${v.channels.length > 0 ? `border-top:1px solid ${RULE};` : ""}font-size:15px;line-height:1.5;color:${SOFT};"><span style="color:${INK};font-weight:500;">Busiest time:</span> ${e(v.busiest)}</p>`
      : ""
  }
</td></tr>`
      : "";

  const link = (href: string, text: string) => `<a href="${e(href)}" style="color:${SOFT};text-decoration:none;">${text}</a>`;
  const footer = `
<tr><td style="padding-top:40px;"></td></tr>
<tr><td background="${e(l.footerImage)}" bgcolor="${WASH}" style="background-color:${WASH};background-image:url('${e(l.footerImage)}');background-size:cover;background-position:center;padding:30px 28px 28px;">
  <img src="${e(l.logo)}" width="53" height="20" alt="FollowUp" style="display:block;border:0;">
  <p style="margin:10px 0 0;font-size:15px;color:${SOFT};">So no customer gets forgotten.</p>
  <p style="margin:16px 0 0;font-size:14px;">${[link(l.website, "Website"), link(l.privacy, "Privacy"), link(l.terms, "Terms"), link(l.contact, "Contact")].join(`&nbsp;&nbsp;&nbsp;&nbsp;`)}</p>
  <p style="margin:18px 0 0;font-size:14px;line-height:1.5;color:${SOFT};">Questions or ideas? <a href="${e(l.writeToSahil)}" style="color:${INK};text-decoration:underline;">Write to Sahil</a>, who builds FollowUp.</p>
  <p style="margin:16px 0 0;font-size:12.5px;line-height:1.5;color:${DIM};">FollowUp sent this from your own Gmail to you, an admin of ${e(v.businessName)}. It comes every Monday.</p>
</td></tr>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${e(v.title)}</title>
</head>
<body style="margin:0;padding:0;background:#f1eeea;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${e(v.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f1eeea;">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;background:#ffffff;border:1px solid ${LINE};border-radius:12px;overflow:hidden;font-family:${FONT};color:${INK};">
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
