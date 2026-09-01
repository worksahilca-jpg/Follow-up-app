"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { team, formatCurrency } from "@/lib/demo-data";
import { Mail, Calendar, Check, RefreshCw, Zap, CreditCard } from "lucide-react";

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}

function SettingsPageInner() {
  const searchParams = useSearchParams();

  const [gmailConnected, setGmailConnected] = useState(false);
  const [gmailEmail, setGmailEmail] = useState<string | undefined>();
  const [gmailStatusLoaded, setGmailStatusLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<string | null>(null);

  const [calendarConnected, setCalendarConnected] = useState(false);
  const [autoAfterDays, setAutoAfterDays] = useState(5);
  const [automationOn, setAutomationOn] = useState(false);
  const [automationLoaded, setAutomationLoaded] = useState(false);
  const [automationSaving, setAutomationSaving] = useState(false);
  const [runningNow, setRunningNow] = useState(false);
  const [runResult, setRunResult] = useState<string | null>(null);
  const [automationError, setAutomationError] = useState<string | null>(null);

  const [billingActive, setBillingActive] = useState(false);
  const [billingStatus, setBillingStatus] = useState<string | null>(null);
  const [billingPeriodEnd, setBillingPeriodEnd] = useState<string | null>(null);
  const [billingLoaded, setBillingLoaded] = useState(false);
  const [billingBusy, setBillingBusy] = useState(false);
  const [billingError, setBillingError] = useState<string | null>(null);

  // Real connection state, fetched from the DB via the API route — not
  // local/demo state.
  useEffect(() => {
    fetch("/api/integrations/gmail/status")
      .then((r) => r.json())
      .then((data: { connected: boolean; email?: string }) => {
        setGmailConnected(data.connected);
        setGmailEmail(data.email);
      })
      .finally(() => setGmailStatusLoaded(true));
  }, []);

  // Real automation settings (business-level master switch + delay).
  useEffect(() => {
    fetch("/api/automation/settings")
      .then((r) => r.json())
      .then((data: { enabled: boolean; triggerDays: number }) => {
        setAutomationOn(data.enabled);
        setAutoAfterDays(data.triggerDays);
      })
      .finally(() => setAutomationLoaded(true));
  }, []);

  async function saveAutomationSettings(enabled: boolean, triggerDays: number) {
    setAutomationSaving(true);
    setAutomationError(null);
    try {
      const res = await fetch("/api/automation/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled, triggerDays }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setAutomationOn(!enabled); // revert the optimistic flip
        setAutomationError(data.message ?? "Couldn't save — try again.");
      }
    } finally {
      setAutomationSaving(false);
    }
  }

  // Real subscription state, fetched from the DB via the API route.
  useEffect(() => {
    fetch("/api/billing/status")
      .then((r) => r.json())
      .then((data: { active: boolean; status: string | null; currentPeriodEnd: string | null }) => {
        setBillingActive(data.active);
        setBillingStatus(data.status);
        setBillingPeriodEnd(data.currentPeriodEnd);
      })
      .finally(() => setBillingLoaded(true));
  }, []);

  async function handleSubscribe() {
    setBillingBusy(true);
    setBillingError(null);
    try {
      const res = await fetch("/api/billing/checkout", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't start checkout.");
      window.location.href = data.url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Couldn't start checkout.");
      setBillingBusy(false);
    }
  }

  async function handleManageBilling() {
    setBillingBusy(true);
    setBillingError(null);
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't open billing portal.");
      window.location.href = data.url;
    } catch (err) {
      setBillingError(err instanceof Error ? err.message : "Couldn't open billing portal.");
      setBillingBusy(false);
    }
  }

  async function handleRunAutomationNow() {
    setRunningNow(true);
    setRunResult(null);
    try {
      const res = await fetch("/api/automation/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Automation run failed.");
      setRunResult(
        data.checked === 0
          ? "Checked — no leads are opted in and overdue right now."
          : `Checked ${data.checked} opted-in lead${data.checked === 1 ? "" : "s"}, sent ${data.sent}.`
      );
    } catch (err) {
      setRunResult(err instanceof Error ? err.message : "Automation run failed.");
    } finally {
      setRunningNow(false);
    }
  }

  // Surface the outcome of the OAuth redirect (?gmail=connected|error) —
  // pure derivation from the URL, no state needed.
  const gmailError =
    searchParams.get("gmail") === "error" ? searchParams.get("message") ?? "Couldn't connect Gmail." : null;
  const billingRedirect = searchParams.get("billing"); // "success" | "canceled" | null

  async function handleGmailSync() {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await fetch("/api/integrations/gmail/sync", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Sync failed");
      if (data.count === 0) {
        setSyncResult("Synced — no new sales conversations found in your recent inbox.");
      } else {
        const scoredNote = data.scored > 0 ? `, AI-scored ${data.scored}` : "";
        setSyncResult(`Synced ${data.count} lead${data.count === 1 ? "" : "s"} from your inbox${scoredNote}.`);
      }
    } catch (err) {
      setSyncResult(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-10">
      <div>
        <h1 className="font-display text-3xl">Settings</h1>
        <p className="text-ink-soft mt-1">Connect your inbox, set follow-up rules, and manage your team.</p>
      </div>

      <section>
        <h2 className="font-display text-xl">Integrations</h2>
        <div className="mt-4 space-y-3">
          <IntegrationRow
            icon={<Mail className="h-4 w-4" />}
            name="Gmail"
            description={
              gmailConnected && gmailEmail
                ? `Connected as ${gmailEmail}`
                : "Required — FollowUp reads sales conversations from your inbox to score leads and draft replies."
            }
            connected={gmailConnected}
            loading={!gmailStatusLoaded}
            href={gmailConnected ? undefined : "/api/integrations/gmail/connect"}
          />
          {gmailConnected && (
            <div className="ml-[52px] flex items-center gap-3">
              <button
                onClick={handleGmailSync}
                disabled={syncing}
                className="text-sm font-medium rounded-lg px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-60"
                style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
                {syncing ? "Syncing…" : "Sync now"}
              </button>
              {syncResult && <span className="text-xs text-ink-soft">{syncResult}</span>}
            </div>
          )}
          {gmailError && (
            <p className="text-xs" style={{ color: "var(--rust)" }}>
              {gmailError}
            </p>
          )}
          <IntegrationRow
            icon={<Calendar className="h-4 w-4" />}
            name="Google Calendar"
            description="Optional — lets FollowUp see scheduled calls and avoid suggesting follow-ups during meetings."
            connected={calendarConnected}
            onToggle={() => setCalendarConnected((v) => !v)}
          />
          <div className="rounded-lg border border-line px-4 py-3 text-sm text-ink-soft flex items-center justify-between opacity-60">
            <span>Outlook, Instagram, WhatsApp, SMS — coming soon</span>
          </div>
        </div>
        {!gmailConnected && (
          <p className="text-xs text-ink-soft mt-2">
            Connect Gmail to start pulling in your real leads — until then the dashboard stays empty.
          </p>
        )}
      </section>

      <section>
        <h2 className="font-display text-xl">Automation</h2>
        <div className="mt-4 rounded-xl border border-line bg-card p-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">Auto follow-up on silence</p>
              <p className="text-xs text-ink-soft mt-1">
                Master switch. When on, leads that are individually opted in (toggle on each lead&apos;s page) get an
                AI-drafted check-in sent automatically after this many days of no response.
              </p>
            </div>
            <button
              onClick={() => {
                const next = !automationOn;
                setAutomationOn(next);
                saveAutomationSettings(next, autoAfterDays);
              }}
              disabled={!automationLoaded || automationSaving}
              className="relative w-11 h-6 rounded-full transition-colors shrink-0 disabled:opacity-60"
              style={{ backgroundColor: automationOn ? "var(--rust)" : "var(--line)" }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
                style={{ transform: automationOn ? "translateX(22px)" : "translateX(2px)" }}
              />
            </button>
          </div>
          {automationError && (
            <p className="mt-3 text-xs" style={{ color: "var(--rust)" }}>
              {automationError}
            </p>
          )}
          {automationOn && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span>Follow up automatically after</span>
              <input
                type="number"
                min={1}
                max={30}
                value={autoAfterDays}
                onChange={(e) => setAutoAfterDays(Number(e.target.value))}
                onBlur={() => saveAutomationSettings(automationOn, autoAfterDays)}
                className="w-16 rounded-lg border border-line bg-paper px-2 py-1 text-center"
              />
              <span>days of no response</span>
            </div>
          )}
          <p className="text-xs text-ink-soft mt-3">
            Off by default for every lead. Every automated message is still logged in the lead&apos;s conversation
            history, and you can turn this off per-lead any time.
          </p>
          {automationOn && (
            <div className="mt-4 pt-4 border-t border-line flex items-center gap-3">
              <button
                onClick={handleRunAutomationNow}
                disabled={runningNow}
                className="text-sm font-medium rounded-lg px-3 py-1.5 flex items-center gap-1.5 disabled:opacity-60"
                style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
              >
                <Zap className={`h-3.5 w-3.5 ${runningNow ? "animate-pulse" : ""}`} />
                {runningNow ? "Checking…" : "Run automation check now"}
              </button>
              {runResult && <span className="text-xs text-ink-soft">{runResult}</span>}
            </div>
          )}
          {automationOn && (
            <p className="text-xs text-ink-soft mt-2">
              This button runs the check manually — nothing runs on a schedule yet. A production deploy needs a
              real scheduler (e.g. a daily Vercel Cron job) hitting this same check.
            </p>
          )}
        </div>
      </section>

      <section>
        <h2 className="font-display text-xl">Team</h2>
        <div className="mt-4 rounded-xl border border-line bg-card divide-y divide-line">
          {team.map((member) => (
            <div key={member.id} className="flex items-center justify-between px-5 py-3 text-sm">
              <div>
                <p className="font-medium">{member.name}</p>
                <p className="text-xs text-ink-soft">{member.role}</p>
              </div>
              <div className="hidden sm:flex gap-6 text-xs text-ink-soft">
                <span>{member.assignedLeads} leads</span>
                <span>{member.followUpsCompleted} completed</span>
                <span>{member.overdueFollowUps} overdue</span>
              </div>
              <span className="font-medium" style={{ color: "var(--gold)" }}>
                {formatCurrency(member.revenueGenerated)}
              </span>
            </div>
          ))}
        </div>
        <button className="mt-3 text-sm font-medium" style={{ color: "var(--rust)" }}>
          + Invite team member
        </button>
      </section>

      <section>
        <h2 className="font-display text-xl">Billing</h2>
        {billingRedirect === "success" && (
          <p className="mt-2 text-sm" style={{ color: "var(--sage)" }}>
            Subscription active — thanks! It may take a few seconds to reflect below.
          </p>
        )}
        {billingRedirect === "canceled" && (
          <p className="mt-2 text-sm text-ink-soft">Checkout canceled — no charge was made.</p>
        )}
        <div className="mt-4 rounded-xl border border-line bg-card p-5">
          <div className="flex items-center gap-4">
            <div
              className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}
            >
              <CreditCard className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">FollowUp — $29/month</p>
              <p className="text-xs text-ink-soft mt-0.5">
                {!billingLoaded
                  ? "Checking your subscription…"
                  : billingActive
                  ? billingPeriodEnd
                    ? `Active — renews ${new Date(billingPeriodEnd).toLocaleDateString()}.`
                    : "Active."
                  : billingStatus === "past_due"
                  ? "Payment failed — update your card to keep your account active."
                  : billingStatus === "canceled"
                  ? "Subscription canceled — resubscribe to unlock leads, sync, and sending again."
                  : "Not subscribed yet — you can view your existing data, but adding leads, syncing Gmail, and sending follow-ups are locked."}
              </p>
            </div>
            {billingLoaded && (
              <button
                onClick={billingActive || billingStatus ? handleManageBilling : handleSubscribe}
                disabled={billingBusy}
                className="shrink-0 text-sm font-medium rounded-lg px-3.5 py-2 text-white disabled:opacity-60"
                style={{ backgroundColor: "var(--ink)" }}
              >
                {billingBusy ? "One sec…" : billingActive || billingStatus ? "Manage billing" : "Subscribe"}
              </button>
            )}
          </div>
          {billingError && (
            <p className="mt-3 text-xs" style={{ color: "var(--rust)" }}>
              {billingError}
            </p>
          )}
        </div>
      </section>
    </div>
  );
}

function IntegrationRow({
  icon,
  name,
  description,
  connected,
  onToggle,
  href,
  loading,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  connected: boolean;
  onToggle?: () => void;
  /** When set, "Connect" is a real navigation (e.g. to kick off OAuth) instead of a local toggle. */
  href?: string;
  loading?: boolean;
}) {
  const buttonStyle = {
    backgroundColor: connected ? "var(--sage-soft)" : "var(--ink)",
    color: connected ? "var(--sage)" : "white",
  };
  const label = loading ? (
    "…"
  ) : connected ? (
    <span className="flex items-center gap-1">
      <Check className="h-3.5 w-3.5" /> Connected
    </span>
  ) : (
    "Connect"
  );

  return (
    <div className="rounded-lg border border-line px-4 py-3 flex items-center gap-4">
      <div className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: "var(--slate-soft)", color: "var(--slate)" }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-ink-soft mt-0.5">{description}</p>
      </div>
      {!connected && href ? (
        <a href={href} className="text-sm font-medium rounded-lg px-3 py-1.5 shrink-0" style={buttonStyle}>
          {label}
        </a>
      ) : (
        <button onClick={onToggle} disabled={!onToggle} className="text-sm font-medium rounded-lg px-3 py-1.5 shrink-0" style={buttonStyle}>
          {label}
        </button>
      )}
    </div>
  );
}
