/**
 * The notice-email shell (src/lib/noticeEmailHtml.ts, A-079): what every
 * reconnect, waiting-customer and sign-in email is built from.
 */
import { describe, it, expect } from "vitest";
import { renderNoticeEmailHtml, noticeDate } from "@/lib/noticeEmailHtml";

const base = "https://www.followupbase.io";

function view(over: Partial<Parameters<typeof renderNoticeEmailHtml>[0]> = {}) {
  return renderNoticeEmailHtml({
    base,
    label: "Your inbox",
    title: "Reconnect Gmail to keep catching customers",
    preheader: "Reconnect in a few seconds.",
    date: "Wed, Oct 1",
    before: ["FollowUp can't read the inbox right now."],
    button: { text: "Reconnect Gmail", href: `${base}/api/integrations/gmail/connect` },
    why: "Google's rule, not something you did.",
    footnote: "Sent once, only when the connection stops.",
    ...over,
  });
}

describe("the shell", () => {
  it("carries the wash picture and the lockup from the app's own URL, and the four footer links", () => {
    const html = view();
    expect(html).toContain(`background-image:url('${base}/email/notice-wash.jpg')`);
    expect(html).toContain(`src="${base}/email/followup-lockup.png"`);
    for (const href of [base, `${base}/privacy`, `${base}/terms`, "mailto:contact@followupbase.io"]) expect(html).toContain(`href="${href}"`);
  });

  it("puts the label, title, paragraphs, button, why and footnote in, in that order", () => {
    const html = view().slice(view().indexOf("<body"));
    const order = [">Your inbox<", "Reconnect Gmail to keep catching customers", "can&#39;t read the inbox", "Reconnect Gmail &rarr;", "Google&#39;s rule", "Sent once"];
    const at = order.map((s) => html.indexOf(s));
    expect(at.every((i) => i >= 0)).toBe(true);
    expect([...at].sort((a, b) => a - b)).toEqual(at);
  });

  it("escapes everything it is given", () => {
    const html = view({ title: "<b>x</b>", before: ['<img src=x onerror="alert(1)">'], footnote: "<i>", label: "<u>" });
    expect(html).not.toContain("<b>x</b>");
    expect(html).not.toContain("<img src=x");
    expect(html).toContain("&lt;img src=x onerror=&quot;alert(1)&quot;&gt;");
  });

  it("renders a person row with a quote, and a rows table", () => {
    const person = view({ sub: { kind: "person", initials: "JC", name: "Jane Cooper", channel: "wrote on WhatsApp", when: null, quote: "Still available?" } });
    expect(person).toContain(">JC<");
    expect(person).toContain("Jane Cooper");
    expect(person).toContain("&ldquo;Still available?&rdquo;");
    const rows = view({ sub: { kind: "rows", rows: [["Device", "Chrome on Windows"], ["When", "Today at 9:14 am"]] } });
    expect(rows).toContain("Chrome on Windows");
    expect(rows.indexOf("Device")).toBeLessThan(rows.indexOf("When"));
  });

  it("finishes the footnote with the optional link", () => {
    const html = view({ footnoteLink: { text: "turn them off in Settings", href: `${base}/settings#alerts` } });
    expect(html).toContain(`href="${base}/settings#alerts"`);
    expect(html).toContain("turn them off in Settings</a>.");
  });

  it("marks strong runs in a paragraph in the ink colour", () => {
    const html = view({ before: [[{ text: "Someone signed in as " }, { text: "a@b.com", strong: true }]] });
    expect(html).toMatch(/font-weight:500;">a@b\.com<\/span>/);
  });
});

describe("noticeDate", () => {
  it("gives the weekday and date in the business's time zone", () => {
    expect(noticeDate(new Date("2026-10-01T03:30:00Z"), "America/Toronto")).toBe("Wed, Sep 30");
    expect(noticeDate(new Date("2026-10-01T03:30:00Z"), "Europe/London")).toBe("Thu, Oct 1");
  });
  it("falls back to New York for a time zone Intl does not know", () => {
    expect(noticeDate(new Date("2026-10-01T15:00:00Z"), "Mars/Olympus")).toBe("Thu, Oct 1");
  });
});
