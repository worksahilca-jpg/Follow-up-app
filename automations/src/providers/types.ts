export interface SmsMessage {
  to: string;
  from: string;
  body: string;
}

export interface EmailMessage {
  to: string;
  from: string;
  subject: string;
  body: string;
}

export interface SmsProvider {
  send(message: SmsMessage): Promise<{ id: string }>;
}

export interface EmailProvider {
  send(message: EmailMessage): Promise<{ id: string }>;
}

export interface AiProvider {
  draft(prompt: string, maxWords: number): Promise<string>;
}

export interface HttpProvider {
  post(url: string, body: unknown): Promise<{ status: number }>;
}

export interface Providers {
  sms: SmsProvider;
  email: EmailProvider;
  ai: AiProvider;
  http: HttpProvider;
}
