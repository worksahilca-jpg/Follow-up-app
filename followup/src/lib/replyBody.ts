/**
 * The part of an email someone actually wrote, without the thread quoted under it. Zero imports, so the consent check
 * (src/lib/optOutKeywords.ts) and the past-replies reader (src/lib/pastReplies.ts) can both use it.
 */

/**
 * The part of a sent message its writer actually wrote: cut at the first
 * quoted-history marker (Gmail's "On … wrote:", Outlook's "From:" block or
 * "-----Original Message-----", ">"-quoted lines), at a signature delimiter,
 * and at a phone's "Sent from my …" line.
 */
export function cleanReplyBody(raw: string): string {
  const text = raw.replace(/\r\n/g, "\n");
  const markers = [
    /^On .{0,200}wrote:\s*$/im,
    /On [^\n]{0,200}? wrote:/i, // an HTML-only body arrives as one line
    /^>/m,
    /^-{2,}\s*Original Message\s*-{2,}/im,
    /^_{8,}\s*$/m,
    /^From:\s.+\n(?:.*\n){0,3}?(?:Sent|Date):\s/im,
    /^--\s*$/m,
    /^Sent from my /im,
    /^Get Outlook for /im,
  ];
  let cut = text.length;
  for (const re of markers) {
    const m = re.exec(text);
    if (m && m.index < cut) cut = m.index;
  }
  return text
    .slice(0, cut)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
