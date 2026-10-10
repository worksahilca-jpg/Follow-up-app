import { prisma } from "@/lib/db";
import { sendAlertEmail } from "@/lib/alertEmail";
import { sendPushToUser } from "@/lib/webPush";
import { notifySlack } from "@/lib/slack";
import { escapeHtml } from "@/lib/emailShell";

/**
 * A tester wrote in Help: the founder hears it now, not whenever the
 * office notes are next read (founder, 2026-10-10: "When a tester taps Help
 * and writes 'it's not working', should your phone buzz right away?" →
 * "Yes, buzz me"). Until then a Help message only sat in the database:
 * one had ever been sent, and nobody was told.
 *
 * Who hears it: PLATFORM_ADMIN_EMAILS, the same people who get the daily
 * setup-health email. Each gets an email with the message and the address
 * to reply to, and a buzz on every device they turned alerts on for. Slack
 * too, when it's set up. Nothing here can make the tester's send fail: the
 * route calls this after it has answered.
 */
export type HelpMessage = {
  id: string;
  message: string;
  /** The tester's sign-in address, so the reply can go straight to them. */
  fromEmail: string;
  fromName: string;
  businessName: string;
};

export function founderEmails(): string[] {
  return (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
}

/** The words the founder reads, kept to what a reply needs. */
export function helpAlertText(h: HelpMessage): { subject: string; text: string; html: string; push: string } {
  const who = `${h.fromName} (${h.businessName})`;
  const text = `${who} wrote in Help:\n\n${h.message}\n\nReply to: ${h.fromEmail}`;
  const html =
    `<p>${escapeHtml(who)} wrote in Help:</p>` +
    `<blockquote style="margin:12px 0;padding:8px 12px;border-left:3px solid #ccc;white-space:pre-wrap">${escapeHtml(h.message)}</blockquote>` +
    `<p>Reply to: <a href="mailto:${escapeHtml(h.fromEmail)}">${escapeHtml(h.fromEmail)}</a></p>`;
  const short = h.message.length > 110 ? `${h.message.slice(0, 107).trimEnd()}…` : h.message;
  return { subject: `Help from ${who}`, text, html, push: short };
}

export async function tellFounderAboutHelp(h: HelpMessage): Promise<void> {
  const emails = founderEmails();
  if (emails.length === 0) return;
  const words = helpAlertText(h);

  const founders = await prisma.user.findMany({
    where: { email: { in: emails, mode: "insensitive" } },
    select: { id: true },
  });

  await Promise.allSettled([
    ...emails.map((to) =>
      sendAlertEmail({ to, subject: words.subject, text: words.text, html: words.html, idempotencyKey: `help:${h.id}:${to}` })
    ),
    ...founders.map((f) =>
      sendPushToUser(f.id, { title: `Help: ${h.businessName}`, body: words.push, url: "/dashboard", tag: `help-${h.id}` })
    ),
    notifySlack(words.text),
  ]);
}
