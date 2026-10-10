"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import AppWindow from "@/components/app/AppWindow";

const inputClass = "w-full rounded-[11px] border border-line bg-card px-3.5 py-2.5 text-[15px]";
const labelClass = "mb-1.5 block text-[13.5px] text-ink-soft";

export default function AddLeadForm({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [source, setSource] = useState("");
  const [dealValue, setDealValue] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Company, deal value and where they came from fold away (A-213): most owners only need the first three.
  const [more, setMore] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Give this customer a name to continue.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          company,
          email,
          phone,
          source,
          notes,
          dealValue: dealValue ? Number(dealValue) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.message ?? "Couldn't save — try again.");
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save — try again.");
      setSaving(false);
    }
  }

  return (
    <AppWindow label="Add a customer" onClose={onClose} size="small">
      <div className="px-1 pb-1 lg:px-8 lg:pb-7 lg:pt-7">
        <h2 className="title-serif text-[28px] leading-tight">Add a customer</h2>
        <p className="mt-1 text-[14.5px] text-ink-faint">Someone who called or walked in. FollowUp takes it from here.</p>

        <form onSubmit={handleSubmit} className="mt-5 grid gap-3.5">
          <div>
            <label htmlFor="add-name" className={labelClass}>Name</label>
            <input id="add-name" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Their name" autoFocus />
          </div>

          <div className="grid gap-3.5 sm:grid-cols-2">
            <div>
              <label htmlFor="add-email" className={labelClass}>Email</label>
              <input id="add-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} placeholder="name@example.com" />
            </div>
            <div>
              <label htmlFor="add-phone" className={labelClass}>Phone</label>
              <input id="add-phone" value={phone} onChange={(e) => setPhone(e.target.value)} className={inputClass} placeholder="Their number" />
            </div>
          </div>

          <div>
            <label htmlFor="add-notes" className={labelClass}>Notes</label>
            <textarea id="add-notes" value={notes} onChange={(e) => setNotes(e.target.value)} className={inputClass} rows={3} placeholder="What they asked about" />
          </div>

          <button
            type="button"
            onClick={() => setMore((v) => !v)}
            aria-expanded={more}
            className="flex items-center gap-1.5 justify-self-start text-left text-[14px] text-ink-soft hover:text-ink"
          >
            More details: company, deal value, where they came from
            <ChevronDown className={"h-3.5 w-3.5 transition-transform " + (more ? "rotate-180" : "")} strokeWidth={2} />
          </button>
          {more && (
            <div className="grid gap-3.5 sm:grid-cols-2">
              <div>
                <label htmlFor="add-company" className={labelClass}>Company</label>
                <input id="add-company" value={company} onChange={(e) => setCompany(e.target.value)} className={inputClass} placeholder="Optional" />
              </div>
              <div>
                <label htmlFor="add-deal" className={labelClass}>Deal value</label>
                <input id="add-deal" type="number" min={0} value={dealValue} onChange={(e) => setDealValue(e.target.value)} className={inputClass} placeholder="$0" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="add-source" className={labelClass}>Where they came from</label>
                <input id="add-source" value={source} onChange={(e) => setSource(e.target.value)} className={inputClass} placeholder="e.g. Referral, a call (blank means you added them)" />
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm" style={{ color: "var(--coral)" }}>
              {error}
            </p>
          )}

          <div className="mt-1 flex items-center justify-end gap-5">
            <button type="button" onClick={onClose} className="text-[14.5px] text-ink-soft hover:text-ink">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-[11px] px-5 py-2.5 text-[15px] font-semibold disabled:opacity-60"
              style={{ backgroundColor: "var(--ink)", color: "var(--paper)" }}
            >
              {saving ? "Saving…" : "Add customer"}
            </button>
          </div>
        </form>
      </div>
    </AppWindow>
  );
}
