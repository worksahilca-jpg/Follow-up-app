import { prisma } from "@/lib/db";
import { notifySlack } from "@/lib/slack";
import { isAlertEmailConfigured, sendAlertEmail } from "@/lib/alertEmail";

/**
 * "Is FollowUp set up to do what it promises?" — checked daily, and said
 * out loud when the answer is no.
 *
 * Found live 2026-09-25: owner alert emails were silently off for hours
 * because RESEND_API_KEY had never been saved to the project. Every piece
 * behaved as designed — alertEmail.ts logs once and no-ops without a key,
 * so nothing broke — and nobody was told. A missing key must never be
 * discovered by a customer who was never alerted.
 *
 * Two kinds of check, both cheap:
 *  - presence: every variable a promised feature depends on is set.
 *  - behaviour: alerts were due but none went out in the last day, which
 *    is how a key that is present but wrong (revoked, from the wrong
 *    account) shows up.
 *
 * Never reads or prints a value — only whether a name is set.
 */

type Requirement = { names: string[]; breaks: string };

/**
 * Only features that are live. Stripe is left out on purpose until billing
 * goes live; add it here the day it does.
 */
export const REQUIREMENTS: Requirement[] = [
  { names: ["NEXTAUTH_SECRET", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"], breaks: "Sign-in" },
  { names: ["TOKEN_ENCRYPTION_KEY"], breaks: "Every connected inbox and account (stored tokens can't be read)" },
  { names: ["CRON_SECRET"], breaks: "Every scheduled job: syncing, reminders, alerts" },
  { names: ["OPENAI_API_KEY"], breaks: "Lead checks, scoring and drafted replies" },
  { names: ["GMAIL_PUSH_SECRET", "GMAIL_PUSH_TOPIC"], breaks: "Instant Gmail (falls back to the 2-minute check)" },
  { names: ["RESEND_API_KEY"], breaks: "Owner alert emails" },
  { names: ["VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"], breaks: "Phone notifications" },
  { names: ["INSTAGRAM_APP_ID", "INSTAGRAM_APP_SECRET"], breaks: "Instagram DMs" },
  { names: ["FACEBOOK_APP_ID", "FACEBOOK_APP_SECRET"], breaks: "Facebook Messenger and Lead Ads" },
  { names: ["SENTRY_DSN"], breaks: "Error reports (crashes go unseen)" },
];

export type HealthProblem = { what: string; breaks: string };

export function missingRequirements(env: Record<string, string | undefined> = process.env): HealthProblem[] {
  const problems: HealthProblem[] = [];
  for (const r of REQUIREMENTS) {
    const missing = r.names.filter((n) => !env[n]?.trim());
    if (missing.length > 0) problems.push({ what: `Not set: ${missing.join(", ")}`, breaks: r.breaks });
  }
  return problems;
}

const DAY_MS = 24 * 60 * 60_000;

/**
 * Alerts were due for owners who asked for email, and not one went out in
 * a day. With the key present, that is a key Resend is refusing, or a
 * sending domain that stopped verifying.
 */
async function alertEmailsStalled(now: Date): Promise<HealthProblem | null> {
  if (!isAlertEmailConfigured()) return null; // already reported as missing
  const since = new Date(now.getTime() - DAY_MS);
  const due = await prisma.ownerAlert.count({
    where: { createdAt: { gte: since }, user: { alertEmailEnabled: true } },
  });
  if (due === 0) return null;
  const sent = await prisma.ownerAlert.count({ where: { createdAt: { gte: since }, emailedAt: { not: null } } });
  if (sent > 0) return null;
  return {
    what: `${due} alert${due === 1 ? "" : "s"} due in the last day, 0 emails sent`,
    breaks: "Owner alert emails — the key is set but sending is failing (check Resend → Logs)",
  };
}

export async function checkSetupHealth(now = new Date()): Promise<HealthProblem[]> {
  const problems = missingRequirements();
  const stalled = await alertEmailsStalled(now);
  if (stalled) problems.push(stalled);
  return problems;
}

export function renderHealthReport(problems: HealthProblem[]): string {
  return [
    `FollowUp setup check: ${problems.length} problem${problems.length === 1 ? "" : "s"}`,
    ...problems.map((p) => `• ${p.what} — affects: ${p.breaks}`),
    "Fix in Vercel → follow-up-app → Settings → Environment Variables, then redeploy.",
  ].join("\n");
}

/**
 * Quiet when healthy. When not, tells the team on two independent routes:
 * Slack (works even when the email key is the thing that is missing) and
 * email to the platform admins.
 */
export async function runSetupHealth(now = new Date()): Promise<{ problems: number; notified: string[] }> {
  const problems = await checkSetupHealth(now);
  if (problems.length === 0) return { problems: 0, notified: [] };

  const text = renderHealthReport(problems);
  const notified: string[] = [];

  if (process.env.SLACK_WEBHOOK_URL) {
    await notifySlack(text);
    notified.push("slack");
  }

  const admins = (process.env.PLATFORM_ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  for (const to of admins) {
    const r = await sendAlertEmail({
      to,
      subject: `FollowUp setup: ${problems.length} problem${problems.length === 1 ? "" : "s"} to fix`,
      text,
      html: `<pre style="font-family:inherit;white-space:pre-wrap">${text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")}</pre>`,
      // One per admin per day, even if the scheduled run is delivered twice.
      idempotencyKey: `setup-health:${now.toISOString().slice(0, 10)}:${to}`,
    });
    if (r.sent) notified.push(`email:${to}`);
  }

  if (notified.length === 0) console.error(text);
  return { problems: problems.length, notified };
}
