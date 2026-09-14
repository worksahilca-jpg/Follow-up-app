import type { ClientConfig, Run } from '../types.js';

const OUTCOME_LABEL: Record<string, string> = {
  sent: 'sent',
  simulated: 'test mode',
  held: 'held until open',
  skipped: 'skipped',
  failed: 'failed',
};

/**
 * The owner-facing page. Deliberately one screen with no controls: the thing
 * a small-business owner wants from an automation is evidence it is working,
 * and every control we add is a support call waiting to happen.
 */
export function renderDashboard(client: ClientConfig, runs: Run[]): string {
  const sent = runs.flatMap((r) => r.actions).filter((a) => a.outcome === 'sent' || a.outcome === 'simulated');
  const replied = runs.filter((r) => r.status === 'stopped').length;
  const waiting = runs.filter((r) => r.status === 'waiting').length;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(client.businessName)} — automations</title>
<style>
  :root { color-scheme: light dark; --bg:#fbfaf9; --fg:#17161a; --muted:#6b6a72; --line:#e5e3e0; --card:#fff; --ok:#136f4f; --warn:#8a5a00; }
  @media (prefers-color-scheme: dark) {
    :root { --bg:#131215; --fg:#f2f1ef; --muted:#9c9aa3; --line:#2c2a30; --card:#1b1a1f; --ok:#4ec08e; --warn:#e0a94a; }
  }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--fg); font:15px/1.55 ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif; }
  .wrap { max-width: 860px; margin:0 auto; padding:32px 20px 64px; }
  h1 { font-size:1.5rem; margin:0 0 4px; letter-spacing:-0.01em; }
  .sub { color:var(--muted); margin:0 0 28px; }
  .stats { display:flex; flex-wrap:wrap; gap:12px; margin-bottom:32px; }
  .stat { flex:1 1 160px; background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px 18px; }
  .stat b { display:block; font-size:1.9rem; font-weight:650; letter-spacing:-0.02em; }
  .stat span { color:var(--muted); font-size:.85rem; }
  .banner { background:var(--card); border:1px solid var(--line); border-left:3px solid var(--warn); border-radius:8px; padding:12px 16px; margin-bottom:24px; color:var(--muted); }
  .run { background:var(--card); border:1px solid var(--line); border-radius:12px; padding:16px 18px; margin-bottom:12px; }
  .run header { display:flex; flex-wrap:wrap; gap:8px; align-items:baseline; justify-content:space-between; margin-bottom:10px; }
  .who { font-weight:600; }
  .tag { font-size:.75rem; color:var(--muted); border:1px solid var(--line); border-radius:99px; padding:2px 9px; }
  ul { list-style:none; margin:0; padding:0; }
  li { border-top:1px solid var(--line); padding:8px 0; display:flex; gap:10px; font-size:.9rem; }
  li .when { color:var(--muted); white-space:nowrap; font-variant-numeric:tabular-nums; }
  li .what { flex:1; }
  .outcome { color:var(--muted); font-size:.78rem; }
  .empty { color:var(--muted); padding:40px 0; text-align:center; }
</style>
</head>
<body>
<div class="wrap">
  <h1>${esc(client.businessName)}</h1>
  <p class="sub">What your automations did for you.</p>

  ${client.dryRun ? '<div class="banner">Test mode — messages are recorded here but nothing is sent to customers yet.</div>' : ''}
  ${!client.enabled ? '<div class="banner">Automations are paused.</div>' : ''}

  <div class="stats">
    <div class="stat"><b>${runs.length}</b><span>customers handled</span></div>
    <div class="stat"><b>${sent.length}</b><span>messages sent</span></div>
    <div class="stat"><b>${replied}</b><span>replied, so we stopped</span></div>
    <div class="stat"><b>${waiting}</b><span>follow-ups scheduled</span></div>
  </div>

  ${runs.length === 0 ? '<p class="empty">Nothing yet. As soon as a call is missed or a lead comes in, it shows up here.</p>' : runs.map(runCard).join('\n')}
</div>
</body>
</html>`;
}

function runCard(run: Run): string {
  const who = run.event.contact.name || run.event.contact.phone || run.event.contact.email || 'Unknown contact';
  return `<div class="run">
  <header>
    <span class="who">${esc(who)}</span>
    <span class="tag">${esc(run.blueprintId)} · ${esc(statusLabel(run))}</span>
  </header>
  <ul>
    ${run.actions.map(
      (a) => `<li><span class="when">${esc(time(a.at))}</span><span class="what">${esc(a.detail)}${
        a.error ? ` — ${esc(a.error)}` : ''
      }<br><span class="outcome">${esc(OUTCOME_LABEL[a.outcome] ?? a.outcome)}</span></span></li>`,
    ).join('')}
  </ul>
</div>`;
}

function statusLabel(run: Run): string {
  switch (run.status) {
    case 'stopped':
      return run.stoppedReason ?? 'stopped';
    case 'waiting':
      return 'follow-up scheduled';
    case 'done':
      return 'finished';
    case 'failed':
      return 'needs attention';
    default:
      return 'running';
  }
}

function time(at: number): string {
  return new Date(at).toISOString().replace('T', ' ').slice(0, 16);
}

function esc(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
