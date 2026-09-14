import { Engine } from '../src/engine/engine.js';
import { defaultRegistry } from '../src/blueprints/index.js';
import { fixedClock } from '../src/engine/clock.js';
import { MemoryStore } from '../src/engine/store.js';
import { RecordingProviders } from '../src/providers/recording.js';
import type { AutomationEvent, ClientConfig, TriggerKey } from '../src/types.js';

export const MONDAY_9AM = Date.parse('2026-09-14T13:00:00.000Z'); // 9am Toronto
export const MONDAY_2AM = Date.parse('2026-09-14T06:00:00.000Z'); // 2am Toronto

export function testClient(overrides: Partial<ClientConfig> = {}): ClientConfig {
  return {
    id: 'test-co',
    businessName: 'Test Co',
    ownerName: 'Sam',
    ownerPhone: '+14165550001',
    ownerEmail: 'sam@test.example',
    fromPhone: '+14165550002',
    fromEmail: 'hello@test.example',
    businessHours: {
      timezone: 'America/Toronto',
      startMinute: 8 * 60,
      endMinute: 18 * 60,
      days: [1, 2, 3, 4, 5],
    },
    enabled: true,
    dryRun: false,
    refs: { crmWebhookUrl: 'https://example.invalid/crm' },
    secretEnv: {},
    automations: [
      { id: 'missed-calls', blueprintId: 'missed-call-textback', enabled: true, settings: {} },
    ],
    branding: { signature: '— Sam, Test Co', smsOptOutNotice: 'Reply STOP to opt out.' },
    ...overrides,
  };
}

export function harness(start = MONDAY_9AM) {
  const clock = fixedClock(start);
  const store = new MemoryStore();
  const providers = new RecordingProviders();
  const engine = new Engine({
    store,
    registry: defaultRegistry(),
    providers,
    dryRunProviders: () => providers,
    clock,
  });
  return { clock, store, providers, engine };
}

export function event(
  trigger: TriggerKey,
  at: number,
  overrides: Partial<AutomationEvent> = {},
): AutomationEvent {
  return {
    clientId: 'test-co',
    trigger,
    contact: { name: 'Casey Doe', phone: '+14165550123' },
    data: {},
    occurredAt: at,
    ...overrides,
  };
}

export function smsBodies(providers: RecordingProviders): string[] {
  return providers.sent.filter((s) => s.kind === 'sms').map((s) => s.detail);
}
