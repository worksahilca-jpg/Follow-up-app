import type { ClientConfig } from '../types.js';
import { OpenAiDrafter } from './openai.js';
import { FetchHttp } from './http.js';
import { RecordingProviders } from './recording.js';
import { ResendEmail } from './resend.js';
import { TwilioSms } from './twilio.js';
import type { Providers } from './types.js';

export * from './types.js';
export { RecordingProviders } from './recording.js';

/**
 * Builds live providers from the environment. Anything without credentials
 * falls back to the recording provider, so a half-configured box logs what it
 * would have done instead of crashing mid-sequence.
 */
export function buildProviders(env: NodeJS.ProcessEnv = process.env): Providers {
  const fallback = new RecordingProviders();

  const twilioSid = env.TWILIO_ACCOUNT_SID;
  const twilioToken = env.TWILIO_AUTH_TOKEN;
  const resendKey = env.RESEND_API_KEY;
  const openaiKey = env.OPENAI_API_KEY;

  return {
    sms: twilioSid && twilioToken ? new TwilioSms(twilioSid, twilioToken) : fallback.sms,
    email: resendKey ? new ResendEmail(resendKey) : fallback.email,
    ai: openaiKey ? new OpenAiDrafter(openaiKey) : fallback.ai,
    http: new FetchHttp(),
  };
}

/**
 * Per-client providers.
 *
 * We promise every owner that their number lives in their own Twilio
 * subaccount, so they keep it if they ever leave us. That promise only holds
 * if each client's credentials are separate, which is what `secretEnv` is
 * for: it names the environment variables to read for this client. A client
 * that names none falls back to the shared ones, which is the right default
 * for the first client and the wrong one for the tenth.
 */
export function buildProvidersForClient(
  client: ClientConfig,
  env: NodeJS.ProcessEnv = process.env,
): Providers {
  const fallback = new RecordingProviders();
  const read = (named: string | undefined, shared: string): string | undefined =>
    (named ? env[named] : undefined) ?? env[shared];

  const twilioSid = read(client.secretEnv.twilioAccountSid, 'TWILIO_ACCOUNT_SID');
  const twilioToken = read(client.secretEnv.twilioAuthToken, 'TWILIO_AUTH_TOKEN');
  const resendKey = read(client.secretEnv.resendApiKey, 'RESEND_API_KEY');
  const openaiKey = read(client.secretEnv.openaiApiKey, 'OPENAI_API_KEY');

  return {
    sms: twilioSid && twilioToken ? new TwilioSms(twilioSid, twilioToken) : fallback.sms,
    email: resendKey ? new ResendEmail(resendKey) : fallback.email,
    ai: openaiKey ? new OpenAiDrafter(openaiKey) : fallback.ai,
    http: new FetchHttp(),
  };
}

/** Which credentials this client is missing, by the env var names it expects. */
export function missingCredentials(
  client: ClientConfig,
  env: NodeJS.ProcessEnv = process.env,
): string[] {
  const missing: string[] = [];
  const absent = (named: string | undefined, shared: string): boolean =>
    !((named ? env[named] : undefined) ?? env[shared]);

  if (
    absent(client.secretEnv.twilioAccountSid, 'TWILIO_ACCOUNT_SID') ||
    absent(client.secretEnv.twilioAuthToken, 'TWILIO_AUTH_TOKEN')
  ) {
    missing.push(
      `${client.secretEnv.twilioAccountSid ?? 'TWILIO_ACCOUNT_SID'}/${client.secretEnv.twilioAuthToken ?? 'TWILIO_AUTH_TOKEN'}`,
    );
  }
  if (absent(client.secretEnv.resendApiKey, 'RESEND_API_KEY')) {
    missing.push(client.secretEnv.resendApiKey ?? 'RESEND_API_KEY');
  }
  if (absent(client.secretEnv.openaiApiKey, 'OPENAI_API_KEY')) {
    missing.push(client.secretEnv.openaiApiKey ?? 'OPENAI_API_KEY');
  }
  return missing;
}
