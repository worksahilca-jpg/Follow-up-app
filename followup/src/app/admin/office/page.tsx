import Link from "next/link";
import { ArrowLeft, Users, Clock, Receipt, ShieldCheck } from "lucide-react";
import { syncRoles } from "@/lib/office/roles";
import { getFloor, type DeskView, type RunView } from "@/lib/office/floor";
import StatCard from "@/components/StatCard";
import { requirePlatformAdmin } from "@/lib/platformAdmin";
import RunNowButton from "@/components/office/RunNowButton";

export const dynamic = "force-dynamic";

// Gating is the /admin layout's job (requirePlatformAdmin → notFound), the
// same guard the rest of the founder-only surface runs. Nothing extra here.

// Status uses the four semantic tokens as a severity ramp, and `--gold` is
// deliberately absent: it means "going cold" and nothing else now (see
// design-brain/decisions/approved.md A-005). A shift the office refused is
// informational, not a warning — the system working, not an incident — so
// it reads slate. A running shift gets an outline instead of a fill rather
// than inventing a fifth meaning for a color that already has one.
const STATUS: Record<string, { label: string; fg: string; bg: string; outline?: boolean }> = {
  RUNNING: { label: "On shift", fg: "var(--ink)", bg: "transparent", outline: true },
  SUCCEEDED: { label: "Done", fg: "var(--sage)", bg: "var(--sage-soft)" },
  BLOCKED: { label: "Stopped itself", fg: "var(--slate)", bg: "var(--slate-soft)" },
  FAILED: { label: "Failed", fg: "var(--coral)", bg: "var(--coral-soft)" },
};

function StatusPill({ status }: { status: string }) {
  const s = STATUS[status] ?? { label: status, fg: "var(--slate)", bg: "var(--slate-soft)" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0"
      style={{
        backgroundColor: s.bg,
        color: s.fg,
        boxShadow: s.outline ? "inset 0 0 0 1px var(--line)" : undefined,
      }}
    >
      {s.label}
    </span>
  );
}

function when(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return date.toLocaleDateString();
}

// Sub-cent figures are the norm here, so the usual two-decimal currency
// format would print "$0.00" for most real shifts and teach you nothing.
function money(usd: number): string {
  if (usd === 0) return "$0";
  if (usd < 0.01) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function Desk({ desk }: { desk: DeskView }) {
  const atCeiling = desk.spentTodayUsd >= desk.dailyCostCeilingUsd;
  return (
    <div className="box p-5 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-lg leading-tight">{desk.title}</h3>
          <p className="text-xs text-ink-soft mt-0.5">{desk.key}</p>
        </div>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0"
          style={
            desk.live && desk.enabled
              ? { backgroundColor: "var(--sage-soft)", color: "var(--sage)" }
              : { backgroundColor: "var(--slate-soft)", color: "var(--slate)" }
          }
        >
          {desk.live && desk.enabled ? "On staff" : desk.enabled ? "Roster only" : "Switched off"}
        </span>
      </div>

      <p className="text-sm text-ink-soft leading-relaxed">{desk.brief}</p>

      <dl className="text-sm grid gap-1.5">
        <div className="flex gap-2">
          <dt className="shrink-0 flex items-center gap-1 text-ink-soft">
            <Clock className="h-3.5 w-3.5" aria-hidden /> Wakes on
          </dt>
          <dd>{desk.wakesOn}</dd>
        </div>
        <div className="flex gap-2">
          <dt className="shrink-0 flex items-center gap-1 text-ink-soft">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Unsupervised
          </dt>
          <dd>{desk.gate}</dd>
        </div>
      </dl>

      <div className="border-t border-line pt-3 mt-auto">
        {desk.lastRun ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusPill status={desk.lastRun.status} />
              <span className="text-xs text-ink-soft">
                {when(desk.lastRun.startedAt)} ·{" "}
                {desk.lastRun.trigger.startsWith("manual") ? "you asked" : "on the clock"} ·{" "}
                {money(desk.lastRun.costUsd)}
              </span>
            </div>
            {desk.lastRun.summary && <p className="text-sm leading-relaxed">{desk.lastRun.summary}</p>}
          </div>
        ) : (
          <p className="text-sm text-ink-soft">Has never worked a shift.</p>
        )}
      </div>

      {desk.live && desk.enabled && (
        <div className="flex flex-col gap-1.5">
          <RunNowButton roleKey={desk.key} />
          <p className="text-xs text-ink-soft">
            {money(desk.spentTodayUsd)} of {money(desk.dailyCostCeilingUsd)} spent today
            {atCeiling ? " — at its ceiling until midnight UTC" : ""}
          </p>
        </div>
      )}
    </div>
  );
}

function Shift({ run }: { run: RunView }) {
  return (
    <div className="py-4">
      <div className="flex items-center gap-2 flex-wrap">
        <StatusPill status={run.status} />
        <span className="text-sm font-medium">{run.roleTitle}</span>
        <span className="text-xs text-ink-soft">
          {when(run.startedAt)} · {run.trigger} · {money(run.costUsd)}
        </span>
      </div>
      {run.summary && <p className="text-sm mt-1.5 leading-relaxed">{run.summary}</p>}
      {run.error && run.status === "FAILED" && (
        <p className="text-xs mt-1" style={{ color: "var(--coral)" }}>
          {run.error}
        </p>
      )}
      {run.output && (
        <details className="mt-2">
          <summary className="text-sm cursor-pointer" style={{ color: "var(--rust)" }}>
            Read the note
          </summary>
          <div className="text-sm text-ink-soft mt-2 whitespace-pre-wrap leading-relaxed border-l-2 border-line pl-3">
            {run.output}
          </div>
        </details>
      )}
    </div>
  );
}

export default async function OfficePage() {
  // The /admin layout's guard is NOT enough on its own. Next renders a page
  // alongside its layout rather than after it, and a client navigation
  // (an RSC request whose router-state header says the /admin layout is
  // already on screen) renders this segment WITHOUT running the layout at
  // all — so a request crafted that way reached getFloor() with no session
  // and streamed the office's notes and spend back (security audit
  // 2026-09-26, A-1). Checked here, first, before any query or write.
  await requirePlatformAdmin();

  // Keeps the floor in step with src/lib/office/roles.ts without waiting
  // for a cron tick, so a lane you just wrote shows up on reload.
  await syncRoles();
  const floor = await getFloor();

  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-1.5 text-sm text-ink-soft">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Platform admin
      </Link>

      <h1 className="font-display text-3xl mt-4">The office</h1>
      <p className="text-ink-soft mt-1 max-w-2xl">
        Five lanes live in <code>.claude/agents/</code>, but until now they only existed while you had a session open.
        This is the part that keeps working when you close the laptop: who is on staff, what they did while you
        weren&apos;t watching, and what it cost.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6">
        <StatCard
          label="Desks on staff"
          value={`${floor.liveDesks} of ${floor.totalDesks}`}
          icon={Users}
          accent={floor.liveDesks > 0 ? "var(--sage)" : "var(--slate)"}
          accentSoft={floor.liveDesks > 0 ? "var(--sage-soft)" : "var(--slate-soft)"}
        />
        <StatCard
          label="Shifts worked today"
          value={String(floor.runsToday)}
          icon={Clock}
          accent="var(--slate)"
          accentSoft="var(--slate-soft)"
        />
        <StatCard label="Spent today" value={money(floor.spentTodayUsd)} icon={Receipt} />
      </div>
      <p className="text-xs text-ink-soft mt-3 max-w-2xl">
        A desk opens when it has a runner, not when its job description is written. Every shift is bounded: one desk at
        a time, a hard daily ceiling each, and a shift with nothing new to read costs nothing and calls no model.
      </p>

      <section className="mt-10">
        <h2 className="font-display text-xl">The floor</h2>
        <div className="grid gap-4 md:grid-cols-2 mt-4">
          {floor.desks.map((desk) => (
            <Desk key={desk.key} desk={desk} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl">Latest shifts</h2>
        <div className="mt-4 box px-5">
          {floor.recent.length === 0 ? (
            <p className="text-sm text-ink-soft py-8 text-center">
              Nobody has worked a shift yet. Press <span className="font-medium">Run now</span> on a staffed desk, or
              wait for the office to open on Monday.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {floor.recent.map((run) => (
                <Shift key={run.id} run={run} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
