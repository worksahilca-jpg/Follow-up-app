"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { team, formatCurrency } from "@/lib/demo-data";
import { Mail, Calendar, Check, RefreshCw } from "lucide-react";

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

  // Surface the outcome of the OAuth redirect (?gmail=connected|error) —
  // pure derivation from the URL, no state needed.
  const gmailError =
    searchParams.get("gmail") === "error" ? searchParams.get("message") ?? "Couldn't connect Gmail." : null;

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
            Without Gmail connected, FollowUp runs in demo mode using sample leads so you can explore the product.
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
                When a lead hasn&apos;t responded for a set number of days, automatically send an AI-drafted check-in.
              </p>
            </div>
            <button
              onClick={() => setAutomationOn((v) => !v)}
              className="relative w-11 h-6 rounded-full transition-colors shrink-0"
              style={{ backgroundColor: automationOn ? "var(--rust)" : "var(--line)" }}
            >
              <span
                className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform"
                style={{ transform: automationOn ? "translateX(22px)" : "translateX(2px)" }}
              />
            </button>
          </div>
          {automationOn && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <span>Follow up automatically after</span>
              <input
                type="number"
                min={1}
                max={30}
                value={autoAfterDays}
                onChange={(e) => setAutoAfterDays(Number(e.target.value))}
                className="w-16 rounded-lg border border-line bg-paper px-2 py-1 text-center"
              />
              <span>days of no response</span>
            </div>
          )}
          <p className="text-xs text-ink-soft mt-3">
            Every automated message is still logged in the lead&apos;s conversation history, and you can turn this off per-lead any time.
          </p>
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
        <div className="mt-4 grid sm:grid-cols-3 gap-4">
          <PlanCard name="Free" price="$0" features={["20 conversations/mo", "Basic AI suggestions"]} />
          <PlanCard name="Pro" price="$19" features={["Unlimited conversations", "AI follow-ups & scoring", "Revenue tracking", "Weekly reports"]} current />
          <PlanCard name="Business" price="$49" features={["Multiple users", "Advanced automation", "Team analytics", "More integrations"]} />
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

function PlanCard({
  name,
  price,
  features,
  current,
}: {
  name: string;
  price: string;
  features: string[];
  current?: boolean;
}) {
  return (
    <div
      className="rounded-xl p-5"
      style={{
        border: current ? "2px solid var(--rust)" : "1px solid var(--line)",
        backgroundColor: "var(--card)",
      }}
    >
      <p className="text-sm font-semibold">{name}</p>
      <p className="font-display text-2xl mt-1">
        {price}
        <span className="text-sm text-ink-soft font-body">/mo</span>
      </p>
      <ul className="mt-3 space-y-1.5 text-xs text-ink-soft">
        {features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      {current && (
        <p className="mt-3 text-xs font-medium" style={{ color: "var(--rust)" }}>
          Current plan (demo)
        </p>
      )}
    </div>
  );
}
