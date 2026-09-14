import type { ClientConfig } from '../types.js';

/**
 * COPY THIS FILE PER SALE.
 *
 * Everything a custom project needs lives in one file: their name, their
 * hours, their wording, their automations. Nothing about the engine changes
 * between clients — if you find yourself editing `src/engine`, ask whether
 * it should have been a setting instead.
 *
 * Fill it in from the answers in docs/DELIVERY.md, then run:
 *   npm run simulate -- <clientId>
 */
export const templateClient: ClientConfig = {
  id: 'client-slug',
  businessName: 'Business Name',
  ownerName: 'Owner First Name',
  ownerPhone: '+1...',
  ownerEmail: 'owner@example.com',

  // The number/address messages come FROM. Buy the number in the client's
  // own Twilio subaccount so they keep it if they ever leave.
  fromPhone: '+1...',
  fromEmail: 'hello@example.com',

  businessHours: {
    timezone: 'America/Toronto',
    startMinute: 8 * 60,
    endMinute: 19 * 60,
    days: [1, 2, 3, 4, 5],
  },

  enabled: true,
  // Ship with dryRun: true. Flip it to false on the go-live call, with the
  // owner watching their own phone.
  dryRun: true,

  refs: {
    // crmWebhookUrl: 'https://hooks.zapier.com/...',
  },
  secretEnv: {
    twilioAccountSid: 'TWILIO_ACCOUNT_SID',
    twilioAuthToken: 'TWILIO_AUTH_TOKEN',
    openaiApiKey: 'OPENAI_API_KEY',
    resendApiKey: 'RESEND_API_KEY',
  },

  automations: [
    {
      id: 'missed-calls',
      blueprintId: 'missed-call-textback',
      enabled: true,
      settings: {},
    },
  ],

  branding: {
    signature: '— Owner, Business Name',
    smsOptOutNotice: 'Reply STOP to opt out.',
  },
};
