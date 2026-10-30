import { prisma } from "@/lib/db";
import { sendAlertEmail } from "@/lib/alertEmail";
import { sendPushToUser } from "@/lib/webPush";
import { notifySlack } from "@/lib/slack";
import { founderEmails } from "@/lib/helpAlert";

/**
 * The OpenAI account ran out of credit: the founder hears it now, by email, a buzz and Slack.
 *
 * Founder, 2026-10-30, after it ran out twice that day and only the test page showed it: "add an email alert when
 * OpenAI credits run low" (recommended, then asked for as part of "let's improve the structure"). OpenAI tells
 * FollowUp only when a call is refused, so this fires on the first refused call, not before the balance reaches zero;
 * auto-recharge on OpenAI's billing page is what keeps it from getting there.
 *
 * Every call fails while the credit is gone (3,085 refused calls on Oct 30), so it speaks at most once every six hours:
 * per server by the clock below, and across servers by the email's idempotency key and the buzz's tag.
 */
export const CREDITS_ALERT_EVERY_MS = 6 * 60 * 60 * 1000;
export const BILLING_URL = "https://platform.openai.com/settings/organization/billing/overview";

let lastTold = -Infinity;

/** For tests: forget the last alert. */
export function resetCreditsAlert(): void {
  lastTold = -Infinity;
}

export function creditsAlertText(): { subject: string; text: string; html: string; push: string } {
  const text =
    "OpenAI refused a request: the account has no credits left.\n\n" +
    "Until credits are added, FollowUp can't write replies or follow-ups for any customer.\n\n" +
    `Add credits: ${BILLING_URL}\n\n` +
    "Turning on auto-recharge on the same page stops this happening again. While it lasts you'll get this at most " +
    "once every 6 hours.";
  const html =
    "<p>OpenAI refused a request: the account has no credits left.</p>" +
    "<p>Until credits are added, FollowUp can't write replies or follow-ups for any customer.</p>" +
    `<p><a href="${BILLING_URL}">Add credits</a></p>` +
    "<p>Turning on auto-recharge on the same page stops this happening again. While it lasts you'll get this at most " +
    "once every 6 hours.</p>";
  return {
    subject: "FollowUp's AI is out of OpenAI credits",
    text,
    html,
    push: "FollowUp can't write replies until you add OpenAI credits.",
  };
}

export async function tellFounderCreditsRanOut(now = Date.now()): Promise<void> {
  if (now - lastTold < CREDITS_ALERT_EVERY_MS) return;
  lastTold = now;
  const emails = founderEmails();
  if (emails.length === 0) return;
  const words = creditsAlertText();
  const window = Math.floor(now / CREDITS_ALERT_EVERY_MS);

  const founders = await prisma.user
    .findMany({ where: { email: { in: emails, mode: "insensitive" } }, select: { id: true } })
    .catch(() => [] as { id: string }[]);

  await Promise.allSettled([
    ...emails.map((to) =>
      sendAlertEmail({ to, subject: words.subject, text: words.text, html: words.html, idempotencyKey: `ai-credits:${window}:${to}` })
    ),
    ...founders.map((f) =>
      sendPushToUser(f.id, { title: "OpenAI credits ran out", body: words.push, url: "/admin/usage", tag: `ai-credits-${window}` })
    ),
    notifySlack(words.text),
  ]);
}
