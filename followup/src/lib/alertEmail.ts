/**
 * FollowUp's own email to an owner — "a customer is waiting" — sent through
 * Resend's REST API from FollowUp's own domain.
 *
 * Deliberately NOT through the owner's connected Gmail, which is how the
 * weekly digest goes (src/app/api/cron/weekly-digest). An alert sent from
 * the owner's own mailbox to the owner's own address lands in their Sent
 * folder as well as their inbox, reads as something they wrote, and stops
 * the moment their Google connection lapses — which is exactly when they
 * most need telling that something is waiting. It must come from FollowUp.
 *
 * Plain `fetch`, no SDK: one POST is the whole integration, and a
 * dependency for it would be weight the build carries forever.
 *
 * Without RESEND_API_KEY this is a silent no-op that logs once per server
 * instance, so nothing breaks before the founder has set Resend up
 * (docs/alerts-setup.md).
 */

const RESEND_ENDPOINT = "https://api.resend.com/emails";
const DEFAULT_FROM = "FollowUp <alerts@followupbase.io>";

let loggedMissingKey = false;

export function isAlertEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export type AlertEmail = {
  to: string;
  subject: string;
  text: string;
  html: string;
  /**
   * Resend drops a second request carrying the same key within a day. The
   * caller passes the OwnerAlert row's id, so a retried cron tick cannot
   * email the same alert twice even if our own claim somehow let it through.
   */
  idempotencyKey?: string;
};

export type AlertEmailResult = { sent: true } | { sent: false; reason: string };

export async function sendAlertEmail(email: AlertEmail): Promise<AlertEmailResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (!loggedMissingKey) {
      loggedMissingKey = true;
      console.warn("Owner alert emails are off: RESEND_API_KEY is not set (see docs/alerts-setup.md).");
    }
    return { sent: false, reason: "not configured" };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(email.idempotencyKey ? { "Idempotency-Key": email.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from: process.env.ALERT_FROM_EMAIL || DEFAULT_FROM,
        to: [email.to],
        subject: email.subject,
        text: email.text,
        html: email.html,
      }),
    });
    if (!res.ok) {
      // Resend's error body names the problem ("domain not verified",
      // "invalid from") and never echoes the key, so it is safe to log.
      const detail = await res.text().catch(() => "");
      console.error(`Owner alert email failed (${res.status}): ${detail.slice(0, 300)}`);
      return { sent: false, reason: `resend ${res.status}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("Owner alert email failed:", err);
    return { sent: false, reason: "network" };
  }
}

/** Test seam: the "log once" flag is per process, and tests run many cases in one. */
export function __resetAlertEmailLogForTests(): void {
  loggedMissingKey = false;
}
