"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";

interface Member {
  id: string;
  name: string;
}

/**
 * Reassigns a lead to a team member, or unassigns it. Auto-assigned on
 * creation (see src/lib/assignment.ts); this is how it changes after
 * that. "Claim it" (shown only while unassigned) goes through a separate
 * /claim endpoint rather than the select's own change() — a claim is
 * conditional on the lead still being unassigned right now (see
 * claimLead() in src/lib/assignment.ts), unlike a manual reassignment via
 * the select, which always overwrites the current value outright. That
 * matters specifically for a lead a source rule left unassigned in the
 * shared pool (see routeToPool in src/lib/sourceRouting.ts, "Ponds"):
 * without it, two people clicking "Claim it" within the same second could
 * both get a success response, with the DB silently deciding the real
 * owner by whichever write landed last.
 */
export default function LeadAssignmentSelect({
  leadId,
  initialAssignedToId,
  initialAssignedToName,
}: {
  leadId: string;
  initialAssignedToId: string | null | undefined;
  initialAssignedToName: string;
}) {
  const { data: session } = useSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [current, setCurrent] = useState(initialAssignedToId ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((data: { success: boolean; members?: Member[] }) => {
        if (data.success) setMembers(data.members ?? []);
      });
  }, []);

  async function change(id: string) {
    const previous = current;
    setCurrent(id);
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/assign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assignedToId: id || null }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message ?? "Couldn't reassign — try again.");
    } catch (err) {
      setCurrent(previous);
      setError(err instanceof Error ? err.message : "Couldn't reassign — try again.");
    } finally {
      setSaving(false);
    }
  }

  async function claim() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/leads/${leadId}/claim`, { method: "POST" });
      const data = await res.json();
      if (!data.success) {
        // A lost race still tells us who actually got it (see claimLead())
        // — reflect that real state instead of just an error with the
        // select still showing "Unassigned".
        if (typeof data.assignedToId === "string") setCurrent(data.assignedToId);
        throw new Error(data.message ?? "Couldn't claim — try again.");
      }
      setCurrent(session!.user.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't claim — try again.");
    } finally {
      setSaving(false);
    }
  }

  // Until the member list loads, show the name the server already knows
  // rather than a select with only "Unassigned" in it.
  if (members.length === 0) {
    return <span>{initialAssignedToId ? initialAssignedToName : "Nobody"}</span>;
  }

  const canClaim = !current && !!session?.user?.id;

  return (
    <div className="flex flex-wrap items-center gap-x-1.5">
      {/* Quiet, as the PersonSide board draws it: "Nobody · Take it". */}
      <span className="relative inline-flex items-center">
      <select
        value={current}
        onChange={(e) => change(e.target.value)}
        disabled={saving}
        aria-label="Assigned to"
        className="cursor-pointer appearance-none bg-transparent pr-4 text-[14.5px] [field-sizing:content] disabled:opacity-60"
      >
        <option value="">Nobody</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      <span className="pointer-events-none absolute right-0 text-[12px] text-ink-faint" aria-hidden>
        ▾
      </span>
      </span>
      {canClaim && (
        <>
          <span className="text-ink-faint" aria-hidden>
            ·
          </span>
          <button onClick={claim} disabled={saving} className="text-[14.5px] underline underline-offset-2 disabled:opacity-60">
            Take it
          </button>
        </>
      )}
      {error && (
        <span className="basis-full text-[13px] mt-1" style={{ color: "var(--coral)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
