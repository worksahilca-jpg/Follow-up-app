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
  /** The link the teammate opens to join; admins only (src/lib/inviteToken.ts). */
  link?: string | null;
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
  // Whether an invite alone lets the teammate in — see inviteAloneIsEnough
  // in src/lib/auth.ts. While the beta allowlist is set, it does not.
  const [inviteAloneIsEnough, setInviteAloneIsEnough] = useState(false);

  function load() {
    fetch("/api/team")
      .then((r) => r.json())
      .then(
        (data: {
          success: boolean;
          members?: Member[];
          invites?: Invite[];
          currentUserRole?: TeamRole;
          inviteAloneIsEnough?: boolean;
        }) => {
          if (data.success) {
            setMembers(data.members ?? []);
            setInvites(data.invites ?? []);
            setCurrentUserRole(data.currentUserRole ?? null);
            // Defaults to false, the cautious side: an older deployment
            // that doesn't send this field shows the extra step rather
            // than the promise that may not hold.
            setInviteAloneIsEnough(Boolean(data.inviteAloneIsEnough));
          }
        }
      )
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

  // Which invite's link was just copied, for the two-second "Copied".
  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  async function copyInviteLink(inv: Invite) {
    if (!inv.link) return;
    try {
      await navigator.clipboard.writeText(inv.link);
      setCopiedInviteId(inv.id);
      setTimeout(() => setCopiedInviteId((cur) => (cur === inv.id ? null : cur)), 2000);
    } catch {
      // Clipboard can be refused (permissions, insecure context) — same
      // fallback as the booking-link button, so the link is never lost.
      window.prompt(`Copy ${inv.email}'s invite link:`, inv.link);
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
      <div className="box divide-y divide-line">
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
            <span className="font-medium shrink-0">
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
          <div className="mt-2 box divide-y divide-line">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
                <span className="text-ink-soft min-w-0 truncate">
                  {inv.email} · <span className="text-xs">{inv.role === "ADMIN" ? "Admin" : "Sales"}</span>
                </span>
                <div className="flex items-center gap-3 shrink-0">
                  {inv.link && (
                    <button onClick={() => copyInviteLink(inv)} className="text-xs font-medium underline underline-offset-2">
                      {copiedInviteId === inv.id ? "Copied" : "Copy invite link"}
                    </button>
                  )}
                  <button onClick={() => cancelInvite(inv.id)} aria-label="Cancel invite" style={{ color: "var(--coral)" }}>
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
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
          {inviteAloneIsEnough ? (
            /* Joining needs the invite link since 2026-09-26 (security
               audit H-2): an address alone used to pull its owner into
               this team the first time they signed in, whether or not
               they meant to join. */
            <>
              They join by opening their invite link and signing in with this email. If you have Gmail
              connected, we&apos;ll email the link to them; otherwise copy it from the list above and send it
              yourself.
            </>
          ) : (
            /* The truth while the beta allowlist is on: sign-in checks
               that list BEFORE it looks for the invite, so an invited
               teammate is turned away and the invite is never consumed.
               The old sentence promised the opposite, and the owner found
               out by watching a colleague fail to get in. */
            <>
              While FollowUp is in beta, your teammate also has to be let into the beta itself — email{" "}
              <a href="mailto:contact@followupbase.io" className="underline">
                contact@followupbase.io
              </a>{" "}
              with their address and we&apos;ll add them, usually the same day. The invite waits for them until
              then. If you have Gmail connected, we&apos;ll also send them a heads-up.
            </>
          )}
        </p>
      )}
      {isAdmin && inviteEmailSent !== null && (
        <p className="text-xs mt-1" style={{ color: inviteEmailSent ? "var(--sage)" : "var(--coral)" }}>
          {inviteEmailSent
            ? inviteAloneIsEnough
              ? "Invite sent — we emailed them their link."
              : "Invite sent — it's saved and waiting for them, once they've been let into the beta."
            : inviteAloneIsEnough
              ? "Invite created, but no email could be sent (connect Gmail under Settings to enable that). Copy their invite link above and send it to them."
              : "Invite created — no email could be sent (connect Gmail under Settings to enable that), so let them know yourself."}
        </p>
      )}

      {notice && (
        <p className="text-xs mt-3" style={{ color: "var(--coral)" }}>
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
