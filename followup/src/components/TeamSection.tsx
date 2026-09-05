"use client";

/**
 * Real team management for the Settings page — replaces the old static
 * demo `team` array. Backed by src/lib/team.ts / /api/team*.
 *
 * SALES members see a read-only roster; ADMINs additionally get an invite
 * form, a role selector per member, pending-invite management, and a
 * remove button (never on themselves — see src/lib/team.ts's guardrails).
 */

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { UserPlus, X } from "lucide-react";

type TeamRole = "ADMIN" | "SALES";

interface Member {
  id: string;
  name: string;
  email: string;
  role: TeamRole;
  assignedLeads: number;
  followUpsCompleted: number;
  overdueFollowUps: number;
  revenueGenerated: number;
}

interface Invite {
  id: string;
  email: string;
  role: TeamRole;
  createdAt: string;
}

function formatCurrency(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
}

export default function TeamSection() {
  const { data: session } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [currentUserRole, setCurrentUserRole] = useState<TeamRole | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<TeamRole>("SALES");
  const [inviting, setInviting] = useState(false);
  const [inviteEmailSent, setInviteEmailSent] = useState<boolean | null>(null);

  function load() {
    fetch("/api/team")
      .then((r) => r.json())
      .then((data: { success: boolean; members?: Member[]; invites?: Invite[]; currentUserRole?: TeamRole }) => {
        if (data.success) {
          setMembers(data.members ?? []);
          setInvites(data.invites ?? []);
          setCurrentUserRole(data.currentUserRole ?? null);
        }
      })
      .finally(() => setLoaded(true));
  }

  useEffect(load, []);

  const isAdmin = currentUserRole === "ADMIN";
  const selfId = session?.user?.id;

  async function sendInvite() {
    setInviting(true);
    setError(null);
    setInviteEmailSent(null);
    try {
      const res = await fetch("/api/team/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: inviteEmail, role: inviteRole }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Couldn't send invite.");
      // `emailSent` is boolean | undefined — an undefined value (e.g. a stale
      // server) is treated the same as false, so we never claim an email
      // went out when we're not sure it did.
      setInviteEmailSent(data.emailSent === true);
      setInviteEmail("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send invite.");
    } finally {
      setInviting(false);
    }
  }

  async function cancelInvite(id: string) {
    setError(null);
    const res = await fetch(`/api/team/invites/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.success) {
      setError(data.message ?? "Couldn't cancel — try again.");
      return;
    }
    load();
  }

  async function changeRole(id: string, role: TeamRole) {
    setError(null);
    const res = await fetch(`/api/team/members/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (!data.success) {
      setError(data.message ?? "Couldn't update role — try again.");
      return;
    }
    load();
  }

  async function remove(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from the team? Their leads will be unassigned, not deleted.`)) return;
    setError(null);
    const res = await fetch(`/api/team/members/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!data.success) {
      setError(data.message ?? "Couldn't remove — try again.");
      return;
    }
    setNotice(data.warning ?? null);
    load();
  }

  if (!loaded) return null;

  return (
    <div>
      <div className="rounded-xl border border-line bg-card divide-y divide-line">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between px-5 py-3 text-sm gap-4">
            <div className="min-w-0">
              <p className="font-medium truncate">
                {m.name}
                {m.id === selfId && <span className="text-ink-soft font-normal"> (you)</span>}
              </p>
              <p className="text-xs text-ink-soft truncate">{m.email}</p>
            </div>
            <div className="hidden sm:flex gap-6 text-xs text-ink-soft shrink-0">
              <span>{m.assignedLeads} leads</span>
              <span>{m.followUpsCompleted} completed</span>
              <span>{m.overdueFollowUps} overdue</span>
            </div>
            <span className="font-medium shrink-0" style={{ color: "var(--gold)" }}>
              {formatCurrency(m.revenueGenerated)}
            </span>
            {isAdmin && m.id !== selfId ? (
              <div className="flex items-center gap-2 shrink-0">
                <select
                  value={m.role}
                  onChange={(e) => changeRole(m.id, e.target.value as TeamRole)}
                  className="rounded-lg border border-line bg-paper px-2 py-1 text-xs"
                >
                  <option value="ADMIN">Admin</option>
                  <option value="SALES">Sales</option>
                </select>
                <button onClick={() => remove(m.id, m.name)} className="text-xs" style={{ color: "var(--coral)" }}>
                  Remove
                </button>
              </div>
            ) : (
              <span className="text-xs text-ink-soft shrink-0 w-14 text-right">{m.role === "ADMIN" ? "Admin" : "Sales"}</span>
            )}
          </div>
        ))}
      </div>

      {isAdmin && invites.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-ink-soft">Pending invites</p>
          <div className="mt-2 rounded-xl border border-line bg-card divide-y divide-line">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between px-5 py-2.5 text-sm">
                <span className="text-ink-soft">
                  {inv.email} · <span className="text-xs">{inv.role === "ADMIN" ? "Admin" : "Sales"}</span>
                </span>
                <button onClick={() => cancelInvite(inv.id)} aria-label="Cancel invite" style={{ color: "var(--coral)" }}>
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="mt-4 flex items-center gap-2">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="teammate@company.com"
            className="flex-1 rounded-lg border border-line bg-paper px-3 py-2 text-sm"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value as TeamRole)}
            className="rounded-lg border border-line bg-paper px-2 py-2 text-sm"
          >
            <option value="SALES">Sales</option>
            <option value="ADMIN">Admin</option>
          </select>
          <button
            onClick={sendInvite}
            disabled={inviting || !inviteEmail.trim()}
            className="inline-flex items-center gap-1.5 text-sm font-medium rounded-lg px-3.5 py-2 disabled:opacity-60"
            style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
          >
            <UserPlus className="h-3.5 w-3.5" /> {inviting ? "Sending…" : "Invite"}
          </button>
        </div>
      )}
      {isAdmin && (
        <p className="text-xs text-ink-soft mt-2">
          They&apos;ll join automatically the next time they sign in with this email. If you have Gmail connected,
          we&apos;ll also send them a heads-up.
        </p>
      )}
      {isAdmin && inviteEmailSent !== null && (
        <p className="text-xs mt-1" style={{ color: inviteEmailSent ? "var(--sage)" : "var(--gold)" }}>
          {inviteEmailSent
            ? "Invite sent — they'll also join automatically the moment they sign in with this email."
            : "Invite created — no email could be sent (connect Gmail under Settings to enable that), so let them know to sign in with this email to join."}
        </p>
      )}

      {notice && (
        <p className="text-xs mt-3" style={{ color: "var(--gold)" }}>
          {notice}
        </p>
      )}
      {error && (
        <p className="text-xs mt-3" style={{ color: "var(--coral)" }}>
          {error}
        </p>
      )}
    </div>
  );
}
