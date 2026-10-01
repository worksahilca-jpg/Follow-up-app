/**
 * What every email FollowUp sends is built from (backlog b038, 2026-10-01):
 * the colours, the type, the table helper, the escaper and the dark-mode
 * <style> block. The Monday digest (src/lib/weeklyDigestHtml.ts, A-038)
 * and the notice shell (src/lib/noticeEmailHtml.ts, A-079) each used to
 * declare these for themselves, so a change to one was missed in the
 * other. Each keeps its own layout and its own dark twins; the parts that
 * must agree live here.
 *
 * Written for mail apps, not browsers: tables for layout, every style
 * inline, no SVG (Gmail drops it), no CSS gradients (Gmail and Outlook
 * render them unevenly). A colour is a class with the light value inline,
 * so a client that drops <style> still gets light.
 */

export const INK = "#0a0a0a";
export const SOFT = "#57534e";
export const DIM = "#736e68";
export const LINE = "#e7e5e2";
export const RULE = "#f0eeeb";
// A box's edge. Darker than RULE on purpose: Gmail's app, in dark mode,
// ignores the dark styles and darkens every light colour itself, and a
// near-white edge came out the same black as the sheet, so the box vanished
// into it on the founder's phone (2026-09-28, twice). A mid-tone edge
// survives that darkening as a visible line.
export const EDGE = "#d9d3cb";
export const SAND = "#faf8f6";
export const FONT = "'Public Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";

/**
 * Every value that came from a customer or the owner goes through this: a
 * lead can name themselves anything, and this lands in the owner's inbox.
 */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

/** A full-width layout table, the only block element mail apps agree on. */
export function table(inner: string, style = "", className = ""): string {
  return `<table${className ? ` class="${className}"` : ""} role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-collapse:separate;${style}">${inner}</table>`;
}

/**
 * The dark-mode <style> block, in layers:
 *  - Mail apps that honour prefers-color-scheme (Apple Mail, Outlook for
 *    iOS/Mac) get the designed dark version: `rules("")` plus whatever
 *    `alsoDark` adds (a dark wash, a light lockup).
 *  - Outlook.com's own inversion is steered through [data-ogsc] (text
 *    colours only: it paints its own dark backgrounds, and a button keeps
 *    its own light-on-dark pairing there) and [data-ogsb] (the backgrounds
 *    listed in `outlookBackgrounds`).
 *  - Gmail's app ignores all of this and darkens light colours itself, so
 *    no words ever sit on a picture (A-071).
 *
 * `rules(scope)` returns one selector per line, each starting with the
 * scope; a line naming a background or the button is dropped from the
 * Outlook.com set.
 */
export function darkModeStyle(opts: { rules: (scope: string) => string; alsoDark?: string; outlookBackgrounds?: string }): string {
  return `<style>
  :root { color-scheme: light dark; supported-color-schemes: light dark; }
  @media (prefers-color-scheme: dark) {
    ${opts.rules("")}${opts.alsoDark ? `\n    ${opts.alsoDark}` : ""}
  }
  ${opts
    .rules("[data-ogsc]")
    .split("\n")
    .filter((line) => !/background|button/.test(line))
    .join("\n")}
  ${opts.outlookBackgrounds ?? ""}
</style>`;
}
