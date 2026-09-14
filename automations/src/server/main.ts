import { Engine } from '../engine/engine.js';
import { defaultRegistry } from '../blueprints/index.js';
import { clientMap, CLIENTS } from '../clients/index.js';
import { JsonStore, defaultStorePath } from '../engine/store.js';
import {
  buildProviders,
  buildProvidersForClient,
  missingCredentials,
  RecordingProviders,
} from '../providers/index.js';
import { formatIssues, hasErrors, validateClient } from '../clients/validate.js';
import { createApp } from './http.js';

const PORT = Number(process.env.PORT ?? 3010);

async function main(): Promise<void> {
  const registry = defaultRegistry();

  // Refuse to start on a broken client config. A config error discovered at
  // boot is an annoyance; the same error discovered at 5pm on a Friday is a
  // customer who never got their text.
  let fatal = false;
  for (const client of CLIENTS) {
    const issues = validateClient(client, registry);
    if (issues.length > 0) {
      console.log(`\n[${client.id}]\n${formatIssues(issues)}`);
      if (hasErrors(issues)) fatal = true;
    }
  }
  if (fatal) {
    console.error('\nRefusing to start: fix the errors above.');
    process.exit(1);
  }

  for (const client of CLIENTS) {
    const missing = missingCredentials(client);
    if (missing.length > 0) {
      console.warn(
        `[automations] ${client.id}: no credentials for ${missing.join(', ')} — those sends will be recorded, not delivered.`,
      );
    }
  }

  const store = new JsonStore(process.env.STORE_PATH ?? defaultStorePath('all'));
  await store.load();

  const engine = new Engine({
    store,
    registry,
    providers: buildProviders(),
    providersFor: (client) => buildProvidersForClient(client),
    dryRunProviders: () => new RecordingProviders(),
  });

  const webhookSecret = process.env.AUTOMATION_WEBHOOK_SECRET ?? '';
  const dashboardSecret = process.env.AUTOMATION_DASHBOARD_SECRET ?? '';
  if (!webhookSecret || !dashboardSecret) {
    console.error('Set AUTOMATION_WEBHOOK_SECRET and AUTOMATION_DASHBOARD_SECRET before starting.');
    process.exit(1);
  }

  const app = createApp({ engine, store, clients: clientMap(), webhookSecret, dashboardSecret });
  app.listen(PORT, () => {
    console.log(`[automations] listening on :${PORT} for ${CLIENTS.length} client(s)`);
  });

  // A follow-up scheduled for "in 3 days" needs something to wake it up. An
  // in-process timer is enough for one box; on a platform with cron, POST
  // /cron/tick instead and set DISABLE_INTERNAL_TICK=1.
  if (process.env.DISABLE_INTERNAL_TICK !== '1') {
    const clients = clientMap();
    setInterval(() => {
      engine.tick(clients).catch((error: unknown) => console.error('[automations] tick failed', error));
    }, 60_000).unref();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
