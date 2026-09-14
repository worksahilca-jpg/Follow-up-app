import { randomUUID } from 'node:crypto';
import type {
  AutomationEvent,
  ClientConfig,
  InstalledAutomation,
  Run,
  RunAction,
  Step,
} from '../types.js';
import type { Providers } from '../providers/types.js';
import { evaluate } from './conditions.js';
import { contactKey } from './contactKey.js';
import { isWithinBusinessHours, nextOpening } from './hours.js';
import type { Clock } from './clock.js';
import { systemClock } from './clock.js';
import type { Store } from './store.js';
import type { TemplateScope } from './template.js';
import { buildScope, render } from './template.js';
import type { BlueprintRegistry } from './registry.js';

export interface EngineOptions {
  store: Store;
  /** Fallback providers, used when `providersFor` is not supplied. */
  providers: Providers;
  /** Per-client providers, so each client can run on their own Twilio
   *  subaccount rather than a shared one. */
  providersFor?: (client: ClientConfig) => Providers;
  registry: BlueprintRegistry;
  clock?: Clock;
  /** Providers used when a client is in dry run. */
  dryRunProviders?: () => Providers;
}

/** Keywords that mean "never text me again". Checked case-insensitively on
 *  the whole message, not as a substring, so "stopped by the shop" is a
 *  reply and not an opt-out. */
const OPT_OUT_WORDS = new Set(['stop', 'stopall', 'unsubscribe', 'cancel', 'end', 'quit']);

export class Engine {
  private readonly clock: Clock;

  constructor(private readonly opts: EngineOptions) {
    this.clock = opts.clock ?? systemClock;
  }

  /**
   * Entry point for everything that happens at a client's business. Returns
   * the runs it started — usually one, occasionally more when an owner bought
   * two automations off the same trigger.
   */
  async handleEvent(client: ClientConfig, event: AutomationEvent): Promise<Run[]> {
    if (event.trigger === 'message.inbound') {
      await this.recordInbound(client, event);
    }

    if (!client.enabled) return [];

    // Source systems retry webhooks. Without this the owner's customer gets
    // the same text twice and the owner calls us, not the vendor.
    if (event.externalId) {
      const fresh = await this.opts.store.claimOnce(
        `${client.id}:${event.trigger}:${event.externalId}`,
      );
      if (!fresh) return [];
    }

    const runs: Run[] = [];
    for (const installed of client.automations) {
      if (!installed.enabled) continue;
      const blueprint = this.opts.registry.get(installed.blueprintId);
      if (!blueprint || blueprint.trigger !== event.trigger) continue;

      const steps = blueprint.build({ client, settings: installed.settings, event });
      if (steps.length === 0) continue;

      const run = this.newRun(client, installed, steps, event);
      await this.opts.store.saveRun(run);
      runs.push(await this.advance(client, run));
    }
    return runs;
  }

  /** Resumes every run whose wait has elapsed. Call this from cron. */
  async tick(clients: Map<string, ClientConfig>): Promise<Run[]> {
    const due = await this.opts.store.dueRuns(this.clock.now());
    const resumed: Run[] = [];
    for (const run of due) {
      const client = clients.get(run.clientId);
      if (!client) continue;
      if (!client.enabled) continue;
      resumed.push(await this.advance(client, run));
    }
    return resumed;
  }

  // -------------------------------------------------------------------------

  private newRun(
    client: ClientConfig,
    installed: InstalledAutomation,
    steps: Step[],
    event: AutomationEvent,
  ): Run {
    const now = this.clock.now();
    return {
      id: randomUUID(),
      clientId: client.id,
      automationId: installed.id,
      blueprintId: installed.blueprintId,
      event,
      status: 'running',
      cursor: 0,
      steps,
      actions: [],
      drafts: {},
      createdAt: now,
      updatedAt: now,
    };
  }

  /** Executes steps until the run finishes, stops, or hits a wait. */
  private async advance(client: ClientConfig, run: Run): Promise<Run> {
    const providers = client.dryRun
      ? (this.opts.dryRunProviders?.() ?? this.opts.providers)
      : (this.opts.providersFor?.(client) ?? this.opts.providers);

    run.status = 'running';

    while (run.cursor < run.steps.length) {
      const step = run.steps[run.cursor];
      if (!step) break;

      let outcome: StepOutcome;
      try {
        outcome = await this.runStep(client, run, step, providers);
      } catch (error) {
        // One failing step must not take out the rest of the client's
        // automations, and the owner must be able to see what broke.
        this.log(run, {
          at: this.clock.now(),
          step: step.type,
          detail: describe(step),
          outcome: 'failed',
          error: error instanceof Error ? error.message : String(error),
        });
        run.status = 'failed';
        run.updatedAt = this.clock.now();
        await this.opts.store.saveRun(run);
        return run;
      }

      if (outcome.kind === 'stop') {
        run.status = 'stopped';
        run.stoppedReason = outcome.reason;
        run.updatedAt = this.clock.now();
        await this.opts.store.saveRun(run);
        return run;
      }

      if (outcome.kind === 'wait') {
        run.status = 'waiting';
        run.resumeAt = outcome.until;
        // `retry` means the step has not run yet (held outside business
        // hours); leave the cursor so it executes when we come back.
        if (!outcome.retry) run.cursor += 1;
        run.updatedAt = this.clock.now();
        await this.opts.store.saveRun(run);
        return run;
      }

      run.cursor += 1;
      run.updatedAt = this.clock.now();
      await this.opts.store.saveRun(run);
    }

    run.status = 'done';
    run.resumeAt = undefined;
    run.updatedAt = this.clock.now();
    await this.opts.store.saveRun(run);
    return run;
  }

  private async runStep(
    client: ClientConfig,
    run: Run,
    step: Step,
    providers: Providers,
  ): Promise<StepOutcome> {
    const now = this.clock.now();
    const scope = this.scope(client, run);

    switch (step.type) {
      case 'wait':
        return { kind: 'wait', until: now + step.minutes * 60_000, retry: false };

      case 'stop_if': {
        const key = contactKey(run.event.contact);
        const replied = key
          ? await this.opts.store.repliedSince(client.id, key, run.createdAt)
          : false;
        if (evaluate(step.condition, { contactReplied: replied, scope: buildScope(scope) })) {
          return { kind: 'stop', reason: step.reason };
        }
        return { kind: 'next' };
      }

      case 'ai_draft': {
        const text = await providers.ai.draft(render(step.prompt, scope), step.maxWords ?? 45);
        run.drafts[step.key] = text;
        this.log(run, {
          at: now,
          step: step.type,
          detail: `draft ${step.key}: ${text}`,
          outcome: client.dryRun ? 'simulated' : 'sent',
        });
        return { kind: 'next' };
      }

      case 'send_sms': {
        const to = run.event.contact.phone;
        if (!to || !client.fromPhone) {
          this.log(run, {
            at: now,
            step: step.type,
            label: step.label,
            detail: 'no phone number on the contact or no sending number configured',
            outcome: 'skipped',
          });
          return { kind: 'next' };
        }

        const key = contactKey(run.event.contact);
        if (key && (await this.opts.store.isOptedOut(client.id, key))) {
          return { kind: 'stop', reason: 'contact opted out of messages' };
        }

        const held = this.holdUntilOpen(client, run, step, now);
        if (held) return held;

        const body = this.withFirstMessageNotice(client, run, render(step.body, scope));
        await providers.sms.send({ to, from: client.fromPhone, body });
        this.log(run, {
          at: now,
          step: step.type,
          label: step.label,
          detail: `to ${to}: ${body}`,
          outcome: client.dryRun ? 'simulated' : 'sent',
        });
        return { kind: 'next' };
      }

      case 'send_email': {
        const to = run.event.contact.email;
        if (!to || !client.fromEmail) {
          this.log(run, {
            at: now,
            step: step.type,
            label: step.label,
            detail: 'no email on the contact or no sending address configured',
            outcome: 'skipped',
          });
          return { kind: 'next' };
        }
        const subject = render(step.subject, scope);
        const body = render(step.body, scope);
        await providers.email.send({ to, from: client.fromEmail, subject, body });
        this.log(run, {
          at: now,
          step: step.type,
          label: step.label,
          detail: `to ${to} — ${subject}`,
          outcome: client.dryRun ? 'simulated' : 'sent',
        });
        return { kind: 'next' };
      }

      case 'http_post': {
        const url = client.refs[step.urlRef];
        if (!url) {
          this.log(run, {
            at: now,
            step: step.type,
            label: step.label,
            detail: `no URL configured for refs.${step.urlRef}`,
            outcome: 'skipped',
          });
          return { kind: 'next' };
        }
        const body: Record<string, unknown> = {};
        for (const [k, template] of Object.entries(step.bodyTemplate ?? {})) {
          body[k] = render(template, scope);
        }
        await providers.http.post(url, {
          ...body,
          trigger: run.event.trigger,
          contact: run.event.contact,
        });
        this.log(run, {
          at: now,
          step: step.type,
          label: step.label,
          detail: `POST refs.${step.urlRef}`,
          outcome: client.dryRun ? 'simulated' : 'sent',
        });
        return { kind: 'next' };
      }

      case 'notify_owner': {
        const body = render(step.body, scope);
        if (client.ownerPhone && client.fromPhone) {
          await providers.sms.send({ to: client.ownerPhone, from: client.fromPhone, body });
        } else if (client.ownerEmail && client.fromEmail) {
          await providers.email.send({
            to: client.ownerEmail,
            from: client.fromEmail,
            subject: `${client.businessName}: automation alert`,
            body,
          });
        } else {
          this.log(run, {
            at: now,
            step: step.type,
            detail: 'no owner contact configured',
            outcome: 'skipped',
          });
          return { kind: 'next' };
        }
        this.log(run, {
          at: now,
          step: step.type,
          detail: body,
          outcome: client.dryRun ? 'simulated' : 'sent',
        });
        return { kind: 'next' };
      }
    }
  }

  /**
   * Owner-facing alerts go out whenever they fire — the owner asked to be
   * woken. Customer-facing sends wait for opening time.
   */
  private holdUntilOpen(
    client: ClientConfig,
    run: Run,
    step: Step,
    now: number,
  ): StepOutcome | undefined {
    if (isWithinBusinessHours(now, client.businessHours)) return undefined;
    const until = nextOpening(now, client.businessHours);
    if (until <= now) return undefined;
    // Log the hold once per step, not on every retry through it.
    const alreadyHeld = run.actions.some(
      (a) => a.outcome === 'held' && a.stepIndex === run.cursor,
    );
    if (!alreadyHeld) {
      this.log(run, {
        at: now,
        step: step.type,
        stepIndex: run.cursor,
        detail: `held until ${new Date(until).toISOString()} (outside business hours)`,
        outcome: 'held',
      });
    }
    return { kind: 'wait', until, retry: true };
  }

  /** The opt-out notice rides on the first message of a run only. Repeating
   *  it on every message costs a segment and reads as spam. */
  private withFirstMessageNotice(client: ClientConfig, run: Run, body: string): string {
    const alreadySent = run.actions.some(
      (a) => a.step === 'send_sms' && (a.outcome === 'sent' || a.outcome === 'simulated'),
    );
    if (alreadySent) return body;
    const notice = client.branding.smsOptOutNotice.trim();
    return notice ? `${body}\n${notice}` : body;
  }

  private async recordInbound(client: ClientConfig, event: AutomationEvent): Promise<void> {
    const key = contactKey(event.contact);
    if (!key) return;
    const text = String(event.data.text ?? '').trim();

    if (OPT_OUT_WORDS.has(text.toLowerCase())) {
      await this.opts.store.recordOptOut({ clientId: client.id, contactKey: key, at: this.clock.now() });
      return;
    }
    await this.opts.store.recordReply({ clientId: client.id, contactKey: key, at: this.clock.now() });
  }

  private scope(client: ClientConfig, run: Run): TemplateScope {
    return {
      client,
      event: run.event,
      contact: run.event.contact as unknown as Record<string, unknown>,
      data: run.event.data,
      drafts: run.drafts,
      settings:
        client.automations.find((a) => a.id === run.automationId)?.settings ??
        ({} as Record<string, unknown>),
    };
  }

  private log(run: Run, action: RunAction): void {
    run.actions.push(action);
  }
}

type StepOutcome =
  | { kind: 'next' }
  | { kind: 'stop'; reason: string }
  | { kind: 'wait'; until: number; retry: boolean };

function describe(step: Step): string {
  return step.type;
}
