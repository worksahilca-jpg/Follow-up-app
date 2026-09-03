"use client";

import { useEffect, useState } from "react";

interface Member {
  id: string;
  name: string;
}

/** Reassigns a lead to a team member, or unassigns it. Auto-assigned on creation (see src/lib/assignment.ts); this is how it changes after that. */
export default function LeadAssignmentSelect({
  leadId,
  initialAssignedToId,
  initialAssignedToName,
}: {
  leadId: string;
  initialAssignedToId: string | null | undefined;
  initialAssignedToName: string;
}) {
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

  // Until the member list loads, show the name the server already knows
  // rather than a select with only "Unassigned" in it.
  if (members.length === 0) {
    return <span>{initialAssignedToName}</span>;
  }

  return (
    <div className="flex flex-col items-end">
      <select
        value={current}
        onChange={(e) => change(e.target.value)}
        disabled={saving}
        className="rounded-md border border-line bg-paper px-1.5 py-0.5 text-sm text-right disabled:opacity-60"
      >
        <option value="">Unassigned</option>
        {members.map((m) => (
          <option key={m.id} value={m.id}>
            {m.name}
          </option>
        ))}
      </select>
      {error && (
        <span className="text-xs mt-1" style={{ color: "var(--coral)" }}>
          {error}
        </span>
      )}
    </div>
  );
}
