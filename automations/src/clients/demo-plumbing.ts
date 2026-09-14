import type { ClientConfig } from '../types.js';

/**
 * A fully worked example — this is what a delivered client looks like.
 * Use it as the demo account when you are selling: run `npm run simulate`
 * and walk the prospect through the transcript it prints.
 */
export const demoPlumbing: ClientConfig = {
  id: 'demo-plumbing',
  businessName: "Dave's Plumbing",
  ownerName: 'Dave',
  ownerPhone: '+14165550111',
  ownerEmail: 'dave@davesplumbing.example',
  fromPhone: '+14165550100',
  fromEmail: 'dave@davesplumbing.example',

  businessHours: {
    timezone: 'America/Toronto',
    startMinute: 7 * 60 + 30,
    endMinute: 18 * 60,
    days: [1, 2, 3, 4, 5, 6],
  },

  enabled: true,
  dryRun: true,

  refs: {
    crmWebhookUrl: 'https://example.invalid/crm-intake',
  },
  secretEnv: {
    twilioAccountSid: 'TWILIO_ACCOUNT_SID',
    twilioAuthToken: 'TWILIO_AUTH_TOKEN',
    openaiApiKey: 'OPENAI_API_KEY',
  },

  automations: [
    {
      id: 'missed-calls',
      blueprintId: 'missed-call-textback',
      enabled: true,
      settings: {
        followUpHours: 3,
        notifyOwner: true,
      },
    },
    {
      id: 'new-leads',
      blueprintId: 'lead-intake-router',
      enabled: true,
      settings: {
        chaseHours: 18,
        pushToCrm: true,
        notifyOwner: true,
      },
    },
    {
      id: 'quotes',
      blueprintId: 'quote-followup',
      enabled: true,
      settings: {
        firstNudgeDays: 2,
        secondNudgeDays: 4,
        finalNudgeDays: 8,
        tone: 'straight to the point, friendly, no sales pressure',
      },
    },
    {
      id: 'reviews',
      blueprintId: 'review-request',
      enabled: true,
      settings: {
        reviewUrl: 'https://g.page/r/davesplumbing/review',
        delayHours: 3,
        reminderDays: 3,
      },
    },
  ],

  branding: {
    signature: "— Dave, Dave's Plumbing",
    smsOptOutNotice: 'Reply STOP to opt out.',
  },
};
