import type { SmsMessage, SmsProvider } from './types.js';

/**
 * Twilio over plain fetch. No SDK on purpose: a client hand-off should be a
 * folder they can run with `node`, not a dependency tree they have to keep
 * patched.
 */
export class TwilioSms implements SmsProvider {
  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
  ) {}

  async send(message: SmsMessage): Promise<{ id: string }> {
    const url = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.accountSid)}/Messages.json`;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: message.to, From: message.from, Body: message.body }),
    });
    if (!res.ok) {
      throw new Error(`Twilio ${res.status}: ${await safeText(res)}`);
    }
    const json = (await res.json()) as { sid?: string };
    return { id: json.sid ?? 'unknown' };
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '<no body>';
  }
}
