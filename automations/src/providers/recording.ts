import type {
  AiProvider,
  EmailMessage,
  EmailProvider,
  HttpProvider,
  Providers,
  SmsMessage,
  SmsProvider,
} from './types.js';

export interface RecordedSend {
  kind: 'sms' | 'email' | 'http' | 'ai';
  detail: string;
}

/**
 * Providers that record instead of sending. This backs `dryRun`, which is not
 * a test affordance — it is the demo. We load a prospect's real missed calls,
 * run their automation in dry run, and show them the exact texts that would
 * have gone out last week. That conversation closes the project.
 */
export class RecordingProviders implements Providers {
  readonly sent: RecordedSend[] = [];

  sms: SmsProvider = {
    send: async (m: SmsMessage) => {
      this.sent.push({ kind: 'sms', detail: `SMS to ${m.to}: ${m.body}` });
      return { id: `dry-${this.sent.length}` };
    },
  };

  email: EmailProvider = {
    send: async (m: EmailMessage) => {
      this.sent.push({ kind: 'email', detail: `Email to ${m.to} — ${m.subject}: ${m.body}` });
      return { id: `dry-${this.sent.length}` };
    },
  };

  ai: AiProvider = {
    draft: async (prompt: string) => {
      this.sent.push({ kind: 'ai', detail: `AI draft for: ${prompt.slice(0, 80)}` });
      return '[AI draft would appear here]';
    },
  };

  http: HttpProvider = {
    post: async (url: string) => {
      this.sent.push({ kind: 'http', detail: `POST ${url}` });
      return { status: 200 };
    },
  };
}
