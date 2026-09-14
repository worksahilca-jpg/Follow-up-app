import { defaultRegistry } from './blueprints/index.js';
import { clientMap, CLIENTS, getClient } from './clients/index.js';
import { formatIssues, validateClient } from './clients/validate.js';
import { fixedClock } from './engine/clock.js';
import { Engine } from './engine/engine.js';
import { MemoryStore } from './engine/store.js';
import { RecordingProviders } from './providers/recording.js';
import type { AutomationEvent, ClientConfig, TriggerKey } from './types.js';

/**
 * The demo. Runs a client's real configuration against a scripted week and
 * prints the exact messages their customers would receive, with the dates.
 *
 * This is the thing you put in front of a prospect. It costs nothing to run,
 * needs no credentials, and answers the only question they actually have:
 * "what would this have said to my customers?"
 *
 *   npm run simulate -- demo-plumbing
 */

interface Scenario {
  title: string;
  trigger: TriggerKey;
  event: Omit<AutomationEvent, 'clientId' | 'occurredAt'>;
  /** Minutes after the trigger at which the customer replies, if ever. */
  replyAfterMinutes?: number;
  /** Minutes past the 9am Monday baseline this scenario starts at. */
  startOffsetMinutes?: number;
}

const SCENARIOS: Scenario[] = [
  {
    title: 'A customer calls mid-morning and nobody picks up',
    trigger: 'call.missed',
    event: {
      trigger: 'call.missed',
      externalId: 'demo-call-1',
      contact: { name: 'Maria Alvarez', phone: '+14165550142' },
      data: { source: 'main line' },
    },
  },
  {
    // The objection every owner raises: "I don't want this texting people at
    // midnight." Showing the hold answers it before they have to ask.
    title: 'A customer calls at 11pm — the text waits for opening time',
    trigger: 'call.missed',
    startOffsetMinutes: 14 * 60,
    event: {
      trigger: 'call.missed',
      externalId: 'demo-call-2',
      contact: { name: 'Joe Kettering', phone: '+14165550155' },
      data: { source: 'main line' },
    },
  },
  {
    title: 'A lead comes in from the website form',
    trigger: 'lead.created',
    event: {
      trigger: 'lead.created',
      externalId: 'demo-lead-1',
      contact: { name: 'Tom Becker', phone: '+14165550177', email: 'tom@example.com' },
      data: { service: 'water heater replacement', source: 'website form' },
    },
    replyAfterMinutes: 90,
  },
  {
    title: 'A $2,400 quote goes out and the customer goes quiet',
    trigger: 'quote.sent',
    event: {
      trigger: 'quote.sent',
      externalId: 'demo-quote-1',
      contact: { name: 'Priya Raman', phone: '+14165550188' },
      data: { jobDescription: 'basement bathroom rough-in', quoteAmount: '$2,400' },
    },
  },
  {
    title: 'A job finishes and nobody remembers to ask for the review',
    trigger: 'job.completed',
    event: {
      trigger: 'job.completed',
      externalId: 'demo-job-1',
      contact: { name: 'Alan Whitfield', phone: '+14165550199' },
      data: { service: 'kitchen tap replacement' },
    },
  },
];

async function main(): Promise<void> {
  const clientId = process.argv[2] ?? CLIENTS[0]?.id;
  const client = clientId ? getClient(clientId) : undefined;
  if (!client) {
    console.error(`Unknown client "${clientId}". Known: ${CLIENTS.map((c) => c.id).join(', ')}`);
    process.exit(1);
  }

  const registry = defaultRegistry();
  const issues = validateClient(client, registry);
  if (issues.length > 0) {
    console.log(`Config check:\n${formatIssues(issues)}\n`);
  }

  // Start on a Monday morning so the printed dates read sensibly.
  const start = Date.parse('2026-09-14T13:00:00.000Z');

  for (const scenario of SCENARIOS) {
    const applicable = client.automations.some((a) => {
      const bp = registry.get(a.blueprintId);
      return a.enabled && bp?.trigger === scenario.trigger;
    });
    if (!applicable) continue;
    await runScenario(client, scenario, start + (scenario.startOffsetMinutes ?? 0) * 60_000);
  }
}

async function runScenario(client: ClientConfig, scenario: Scenario, start: number): Promise<void> {
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

  console.log(`\n${'='.repeat(72)}\n${scenario.title}\n${'='.repeat(72)}`);

  await engine.handleEvent(client, {
    ...scenario.event,
    clientId: client.id,
    occurredAt: clock.now(),
  });

  const clients = clientMap();
  clients.set(client.id, client);

  let replyDone = scenario.replyAfterMinutes === undefined;
  const replyAt = start + (scenario.replyAfterMinutes ?? 0) * 60_000;

  // Fast-forward through the scheduled follow-ups. 40 hops covers the longest
  // sequence we sell with room to spare.
  for (let hop = 0; hop < 40; hop++) {
    const runs = await store.listRuns(client.id);
    const next = runs
      .filter((r) => r.status === 'waiting')
      .map((r) => r.resumeAt ?? Infinity)
      .sort((a, b) => a - b)[0];
    if (next === undefined || !Number.isFinite(next)) break;

    if (!replyDone && replyAt <= next) {
      clock.advance(replyAt - clock.now());
      await engine.handleEvent(client, {
        clientId: client.id,
        trigger: 'message.inbound',
        contact: scenario.event.contact,
        data: { text: 'Yes please, when can you come by?' },
        occurredAt: clock.now(),
      });
      console.log(`\n  [${stamp(clock.now())}]  customer replies: "Yes please, when can you come by?"`);
      replyDone = true;
      continue;
    }

    clock.advance(next - clock.now());
    await engine.tick(clients);
  }

  for (const run of await store.listRuns(client.id)) {
    console.log(`\n  ${run.blueprintId}  (${run.status}${run.stoppedReason ? `: ${run.stoppedReason}` : ''})`);
    for (const action of run.actions) {
      console.log(`  [${stamp(action.at)}]  ${action.outcome.padEnd(9)} ${action.detail}`);
    }
  }
}

function stamp(at: number): string {
  return new Date(at).toISOString().replace('T', ' ').slice(0, 16);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
