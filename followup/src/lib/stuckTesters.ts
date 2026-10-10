import { loadActivation } from "@/lib/activation-data";
import type { StuckTester } from "@/lib/activation";
import { sendAlertEmail } from "@/lib/alertEmail";
import { escapeHtml } from "@/lib/emailShell";
import { founderEmails } from "@/lib/helpAlert";
import { appUrl } from "@/lib/stripe";

/**
 * Each morning, the founder hears which testers are stuck short of their
 * first sent reply, so he can write to them (founder, 2026-10-10: "a short
 * daily email that lists testers who signed up but never connected
 * anything, so you can reach out" → "Yes, build it"). It is the stuck list
 * /admin already shows (src/lib/activation.ts, findStuck): each tester, the
 * step they stopped at in plain words, how long ago, and the address to
 * write to.
 *
 * Quiet when nobody is stuck. Only testers stuck for up to two weeks are
 * named; longer than that they are counted in one line, so one tester who
 * left for good doesn't make the email arrive every day forever.
 *
 * Sent by the daily setup-health cron, to PLATFORM_ADMIN_EMAILS (the same
 * people the Help alert reaches). Email only: names and addresses stay out
 * of Slack.
 */
export const STUCK_NAMED_DAYS = 14;

export function stuckTestersEmail(
  stuck: StuckTester[],
  base: string
): { subject: string; text: string; html: string; named: number } | null {
  const named = stuck.filter((t) => t.days <= STUCK_NAMED_DAYS);
  if (named.length === 0) return null;
  const older = stuck.length - named.length;
  const days = (n: number) => (n === 1 ? "1 day" : `${n} days`);
  const who = (t: StuckTester) => (t.business ? `${t.name} (${t.business})` : t.name);

  const subject = named.length === 1 ? "1 tester is stuck" : `${named.length} testers are stuck`;
  const intro = `${named.length === 1 ? "This tester hasn't" : "These testers haven't"} sent a first reply yet. A short note from you usually gets them going.`;
  const olderLine = older > 0 ? `${older} more ${older === 1 ? "has" : "have"} been stuck for over two weeks.` : "";
  const admin = `${base}/admin`;

  const text = [
    intro,
    "",
    ...named.map((t) => `• ${who(t)}: ${t.reason} For ${days(t.days)}. Write to: ${t.email}`),
    "",
    ...(olderLine ? [olderLine] : []),
    `Everyone is on ${admin}`,
  ].join("\n");

  const html =
    `<p>${escapeHtml(intro)}</p>` +
    `<ul style="padding-left:18px">` +
    named
      .map(
        (t) =>
          `<li style="margin:0 0 8px"><strong>${escapeHtml(who(t))}</strong>: ${escapeHtml(t.reason)} For ${days(t.days)}.<br>` +
          `Write to: <a href="mailto:${escapeHtml(t.email)}">${escapeHtml(t.email)}</a></li>`
      )
      .join("") +
    `</ul>` +
    (olderLine ? `<p>${escapeHtml(olderLine)}</p>` : "") +
    `<p>Everyone is on <a href="${escapeHtml(admin)}">${escapeHtml(admin)}</a></p>`;

  return { subject, text, html, named: named.length };
}

export async function sendStuckTesters(now = new Date()): Promise<{ named: number; emailed: number }> {
  const to = founderEmails();
  if (to.length === 0) return { named: 0, emailed: 0 };
  const { stuck } = await loadActivation(now);
  const email = stuckTestersEmail(stuck, appUrl());
  if (!email) return { named: 0, emailed: 0 };

  let emailed = 0;
  for (const address of to) {
    const r = await sendAlertEmail({
      to: address,
      subject: email.subject,
      text: email.text,
      html: email.html,
      // One a day per founder, even if the scheduled run is delivered twice.
      idempotencyKey: `stuck-testers:${now.toISOString().slice(0, 10)}:${address}`,
    });
    if (r.sent) emailed++;
  }
  return { named: email.named, emailed };
}
