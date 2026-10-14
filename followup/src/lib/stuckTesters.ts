import { loadActivation, loadStopped } from "@/lib/activation-data";
import type { StoppedTester, StuckTester } from "@/lib/activation";
import { sendAlertEmail } from "@/lib/alertEmail";
import { escapeHtml } from "@/lib/emailShell";
import { founderEmails } from "@/lib/helpAlert";
import { reportCronFailure } from "@/lib/monitoring";
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
 * Below them, testers who sent replies before and have stalled since
 * (founder, 2026-10-14: "Yes, add it", A-249): replies waiting for their
 * OK for two days or more, or Gmail or Outlook disconnected
 * (src/lib/activation.ts, findStopped). The same two weeks apply, counted
 * from when they last opened FollowUp.
 *
 * Sent by the daily setup-health cron, to PLATFORM_ADMIN_EMAILS (the same
 * people the Help alert reaches). Email only: names and addresses stay out
 * of Slack.
 */
export const STUCK_NAMED_DAYS = 14;

export function stuckTestersEmail(
  stuck: StuckTester[],
  base: string,
  stopped: StoppedTester[] = []
): { subject: string; text: string; html: string; named: number } | null {
  const named = stuck.filter((t) => t.days <= STUCK_NAMED_DAYS);
  const stalled = stopped.filter((t) => t.quietDays === null || t.quietDays <= STUCK_NAMED_DAYS);
  const total = named.length + stalled.length;
  if (total === 0) return null;
  const older = stuck.length - named.length;
  const stalledOlder = stopped.length - stalled.length;
  const days = (n: number) => (n === 1 ? "1 day" : `${n} days`);
  const who = (t: { name: string; business: string | null }) => (t.business ? `${t.name} (${t.business})` : t.name);

  const subject = total === 1 ? "1 tester is stuck" : `${total} testers are stuck`;
  const intro = `${named.length === 1 ? "This tester hasn't" : "These testers haven't"} sent a first reply yet. A short note from you usually gets them going.`;
  const olderLine =
    older === 0
      ? ""
      : named.length > 0
        ? `${older} more ${older === 1 ? "has" : "have"} been stuck for over two weeks.`
        : `${older} ${older === 1 ? "tester has" : "testers have"} been stuck for over two weeks.`;
  const stalledIntro = `${stalled.length === 1 ? "This tester" : "These testers"} sent replies before, but now customers are waiting or the inbox needs reconnecting.`;
  const stalledOlderLine =
    stalledOlder === 0
      ? ""
      : stalled.length > 0
        ? `${stalledOlder} more ${stalledOlder === 1 ? "hasn't" : "haven't"} opened FollowUp in over two weeks.`
        : `${stalledOlder} ${stalledOlder === 1 ? "tester who sent replies hasn't" : "testers who sent replies haven't"} opened FollowUp in over two weeks.`;
  const admin = `${base}/admin`;

  const stuckText = named.length
    ? [intro, "", ...named.map((t) => `• ${who(t)}: ${t.reason} For ${days(t.days)}. Write to: ${t.email}`), ""]
    : [];
  const stalledText = stalled.length
    ? [stalledIntro, "", ...stalled.map((t) => `• ${who(t)}: ${t.reason} Write to: ${t.email}`), ""]
    : [];
  const text = [
    ...stuckText,
    ...(olderLine ? [olderLine, ""] : []),
    ...stalledText,
    ...(stalledOlderLine ? [stalledOlderLine, ""] : []),
    `Everyone is on ${admin}`,
  ].join("\n");

  const writeTo = (email: string) => `Write to: <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`;
  const list = (items: string[]) => `<ul style="padding-left:18px">${items.join("")}</ul>`;
  const html =
    (named.length
      ? `<p>${escapeHtml(intro)}</p>` +
        list(
          named.map(
            (t) =>
              `<li style="margin:0 0 8px"><strong>${escapeHtml(who(t))}</strong>: ${escapeHtml(t.reason)} For ${days(t.days)}.<br>${writeTo(t.email)}</li>`
          )
        )
      : "") +
    (olderLine ? `<p>${escapeHtml(olderLine)}</p>` : "") +
    (stalled.length
      ? `<p>${escapeHtml(stalledIntro)}</p>` +
        list(stalled.map((t) => `<li style="margin:0 0 8px"><strong>${escapeHtml(who(t))}</strong>: ${escapeHtml(t.reason)}<br>${writeTo(t.email)}</li>`))
      : "") +
    (stalledOlderLine ? `<p>${escapeHtml(stalledOlderLine)}</p>` : "") +
    `<p>Everyone is on <a href="${escapeHtml(admin)}">${escapeHtml(admin)}</a></p>`;

  return { subject, text, html, named: total };
}

export async function sendStuckTesters(now = new Date()): Promise<{ named: number; emailed: number }> {
  const to = founderEmails();
  if (to.length === 0) return { named: 0, emailed: 0 };
  const { stuck } = await loadActivation(now);
  // A failure here costs only the stalled section, never the stuck list.
  const stopped = await loadStopped(now).catch((err) => {
    reportCronFailure("setup-health", err, "stopped testers");
    return [];
  });
  const email = stuckTestersEmail(stuck, appUrl(), stopped);
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
