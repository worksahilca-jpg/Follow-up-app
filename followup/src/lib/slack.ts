/**
 * Posts a message to the team's internal Slack via an Incoming Webhook.
 * Inert without SLACK_WEBHOOK_URL set — every call site fires-and-forgets
 * this, so a missing/misconfigured webhook never blocks or fails the
 * thing that triggered it (a lead becoming hot, an error being reported).
 *
 * IMPORTANT SCOPING NOTE: this is wired to ONE team-internal Slack
 * webhook, not a per-business integration. That's fine today — FollowUp
 * has no real paying customers yet, so "notify the team" and "notify the
 * business that owns this lead" are the same audience. The moment a real
 * customer's data would flow through this (their lead names, their error
 * context), this needs to become a per-business setting (like
 * webhookSecret on Business) instead of one shared env var — piping a
 * customer's lead into the founder's internal Slack is a real data
 * boundary problem, not a hypothetical one. Revisit before onboarding
 * anyone outside the team.
 */

const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 5 * 60_000;
let recentSends: number[] = [];

function withinRateLimit(): boolean {
  const now = Date.now();
  recentSends = recentSends.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recentSends.length >= RATE_LIMIT_MAX) return false;
  recentSends.push(now);
  return true;
}

/**
 * Fire-and-forget: never throws, never awaited by callers. A Slack outage
 * or a bad webhook URL should never be the reason a hot-lead notification
 * or an error report fails to do its own real job.
 */
export async function notifySlack(text: string): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return;
  // Caps a runaway error loop (or any other burst) at 5 Slack messages per
  // 5 minutes instead of drowning the channel or tripping Slack's own
  // per-webhook rate limit — good enough for a small team's single
  // channel; revisit if this ever needs per-source limits.
  if (!withinRateLimit()) return;

  try {
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    console.error("Slack notification failed to send:", err);
  }
}
